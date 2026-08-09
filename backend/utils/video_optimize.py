"""Transcode creator uploads to a web-friendly H.264 MP4 for smoother playback."""
from __future__ import annotations

import json
import logging
import os
import queue
import subprocess
import tempfile
import threading
from urllib.parse import unquote, urlparse

import requests

logger = logging.getLogger(__name__)

MAX_HEIGHT = 720
MAX_VIDEO_BITRATE = 2_500_000
FFMPEG_TIMEOUT_SEC = 240
DOWNLOAD_TIMEOUT_SEC = 120
MAX_DOWNLOAD_BYTES = 220 * 1024 * 1024
PLAYBACK_MARK = "_w720."
PLAYBACK_MARK_TRANSCODED = "_w720t."
CACHE_CONTROL = "31536000"

_lock = threading.Lock()
_in_flight = set()
_queued = set()
_job_queue = queue.Queue()
_worker_started = False


def public_videos2_path(video_url):
    """Return storage object path if this is our public videos2 URL."""
    if not video_url or not isinstance(video_url, str):
        return None
    try:
        parsed = urlparse(video_url.strip())
    except Exception:
        return None
    host = (parsed.netloc or "").lower()
    if "supabase.co" not in host:
        return None
    marker = "/storage/v1/object/public/videos2/"
    path = unquote(parsed.path or "")
    idx = path.find(marker)
    if idx < 0:
        return None
    rel = path[idx + len(marker) :].lstrip("/")
    if not rel or ".." in rel:
        return None
    return rel


def _web_output_path(rel_path):
    base, ext = os.path.splitext(rel_path)
    for suffix in ("_w720t", "_w720", "_web"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    return f"{base}_w720t.mp4"


def _already_web_url(video_url):
    url = str(video_url or "")
    return bool(url) and (PLAYBACK_MARK_TRANSCODED in url or PLAYBACK_MARK in url)


def _is_youtube_url(video_url):
    url = str(video_url or "").lower()
    return "youtube.com" in url or "youtu.be" in url


def row_needs_optimize(row):
    if not row:
        return False
    playback = (row.get("video_url") or "").strip()
    source = (row.get("source_video_url") or playback).strip()
    if not source or _already_web_url(playback) or _is_youtube_url(source):
        return False
    return bool(public_videos2_path(source))


def _probe(path):
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_name,height,bit_rate:format=bit_rate,size,duration",
                "-of",
                "json",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        data = json.loads(result.stdout or "{}")
        stream = (data.get("streams") or [{}])[0]
        fmt = data.get("format") or {}
        info = {"codec": "", "height": 0, "bit_rate": 0}
        info["codec"] = str(stream.get("codec_name") or "").strip().lower()
        try:
            info["height"] = int(float(stream.get("height") or 0))
        except (TypeError, ValueError):
            info["height"] = 0
        bit_rate = stream.get("bit_rate") or fmt.get("bit_rate") or 0
        try:
            info["bit_rate"] = int(float(bit_rate))
        except (TypeError, ValueError):
            info["bit_rate"] = 0
        return info
    except Exception as exc:
        logger.warning("ffprobe failed: %s", exc)
        return None


def _is_web_ready(probe):
    """Kept for tests; playback copies are always transcoded for browser compatibility."""
    if not probe:
        return False
    if probe.get("codec") not in ("h264", "avc1"):
        return False
    height = probe.get("height") or 0
    if height > MAX_HEIGHT:
        return False
    bit_rate = probe.get("bit_rate") or 0
    if not bit_rate or bit_rate > MAX_VIDEO_BITRATE:
        return False
    return True


def _download(url, dest_path):
    with requests.get(url, stream=True, timeout=DOWNLOAD_TIMEOUT_SEC) as resp:
        resp.raise_for_status()
        written = 0
        with open(dest_path, "wb") as handle:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if not chunk:
                    continue
                written += len(chunk)
                if written > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Video is too large to optimize on this server")
                handle.write(chunk)
    return written


def _run_ffmpeg(cmd, dest_path):
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=FFMPEG_TIMEOUT_SEC,
        check=False,
    )
    if result.returncode != 0 or not os.path.exists(dest_path) or os.path.getsize(dest_path) < 1000:
        err = (result.stderr or result.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err[:500])


def _remux_faststart(src_path, dest_path):
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            src_path,
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            dest_path,
        ],
        dest_path,
    )


def _transcode(src_path, dest_path):
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-threads",
            "1",
            "-i",
            src_path,
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-vf",
            "scale=-2:'min(720,ih)'",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-profile:v",
            "main",
            "-level",
            "3.1",
            "-crf",
            "26",
            "-maxrate",
            "2M",
            "-bufsize",
            "4M",
            "-g",
            "60",
            "-keyint_min",
            "60",
            "-sc_threshold",
            "0",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            dest_path,
        ],
        dest_path,
    )


def _upload_web_file(admin_client, rel_path, file_path):
    with open(file_path, "rb") as handle:
        data = handle.read()
    admin_client.storage.from_("videos2").upload(
        rel_path,
        data,
        {
            "content-type": "video/mp4",
            "cacheControl": CACHE_CONTROL,
            "cache-control": CACHE_CONTROL,
            "upsert": "true",
        },
    )
    public_url = admin_client.storage.from_("videos2").get_public_url(rel_path)
    if isinstance(public_url, dict):
        public_url = public_url.get("publicUrl") or public_url.get("public_url") or ""
    return public_url


def _update_video_row(admin_client, video_id, playback_url, source_url):
    if not video_id or not admin_client:
        return False
    try:
        admin_client.table("videos2").update(
            {
                "video_url": playback_url,
                "source_video_url": source_url,
            }
        ).eq("id", video_id).execute()
        return True
    except Exception as exc:
        logger.warning(
            "Could not save optimized playback URL. Run backend/sql/video_source_url.sql first: %s",
            exc,
        )
        return False


def optimize_video_url(admin_client, video_url, video_id=None, source_url=None, force=False):
    """
    Create a web playback MP4 when needed.
    Returns dict: {ok, skipped, playback_url, source_url, error}
    """
    source_url = (source_url or video_url or "").strip()
    rel = public_videos2_path(source_url)
    if not rel:
        return {"ok": False, "skipped": True, "error": "Only ScreenMerch Supabase videos can be optimized"}

    if _already_web_url(source_url) and not force:
        return {"ok": True, "skipped": True, "playback_url": source_url, "source_url": source_url}

    key = str(video_id or source_url)
    with _lock:
        if key in _in_flight:
            return {"ok": True, "skipped": True, "playback_url": source_url, "source_url": source_url, "error": "already running"}
        _in_flight.add(key)
        _queued.discard(key)

    tmp_in = tmp_out = None
    try:
        suffix = os.path.splitext(rel)[1] or ".mp4"
        fd_in, tmp_in = tempfile.mkstemp(prefix="smvid_", suffix=suffix)
        os.close(fd_in)
        fd_out, tmp_out = tempfile.mkstemp(prefix="smvid_web_", suffix=".mp4")
        os.close(fd_out)

        logger.info("Optimizing video %s (%s)", video_id or "", rel)
        _download(source_url, tmp_in)
        _transcode(tmp_in, tmp_out)
        web_rel = _web_output_path(rel)
        playback_url = _upload_web_file(admin_client, web_rel, tmp_out)
        if isinstance(playback_url, str):
            playback_url = playback_url.split("?")[0]
        if video_id:
            _update_video_row(admin_client, video_id, playback_url, source_url)
        logger.info("Optimized video %s -> %s", video_id or rel, playback_url)
        return {"ok": True, "skipped": False, "playback_url": playback_url, "source_url": source_url}
    except Exception as exc:
        logger.error("Video optimize failed for %s: %s", video_id or source_url, exc)
        return {"ok": False, "skipped": False, "error": str(exc)[:400], "playback_url": source_url, "source_url": source_url}
    finally:
        for path in (tmp_in, tmp_out):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass
        with _lock:
            _in_flight.discard(key)


def _optimize_worker():
    while True:
        admin_client, video_url, video_id, source_url, key, force = _job_queue.get()
        try:
            optimize_video_url(admin_client, video_url, video_id, source_url, force=force)
        except Exception as exc:
            logger.error("Queued optimize crashed for %s: %s", key, exc)
        finally:
            with _lock:
                _queued.discard(key)
            _job_queue.task_done()


def _ensure_worker():
    global _worker_started
    with _lock:
        if _worker_started:
            return
        thread = threading.Thread(target=_optimize_worker, daemon=True, name="video-optimize-worker")
        thread.start()
        _worker_started = True


def enqueue_optimize(admin_client, video_url, video_id=None, source_url=None, force=False):
    """Queue one video. Only one transcode runs at a time on this machine."""
    if not admin_client:
        return False
    source_url = (source_url or video_url or "").strip()
    if not source_url or _is_youtube_url(source_url):
        return False
    if _already_web_url(source_url) and not force:
        return False
    if not public_videos2_path(source_url):
        return False
    key = str(video_id or source_url)
    _ensure_worker()
    with _lock:
        if key in _in_flight or key in _queued:
            return False
        _queued.add(key)
    _job_queue.put((admin_client, video_url, video_id, source_url, key, force))
    return True


def enqueue_video_row(admin_client, row):
    if not row_needs_optimize(row):
        return False
    playback = (row.get("video_url") or "").strip()
    source = (row.get("source_video_url") or playback).strip()
    return enqueue_optimize(admin_client, source, row.get("id"), source)


def start_optimize_background(admin_client, video_url, video_id=None, source_url=None, force=False):
    enqueue_optimize(admin_client, video_url, video_id, source_url, force=force)
    return None
