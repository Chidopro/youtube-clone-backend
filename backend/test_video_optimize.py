from utils.video_optimize import (
    _already_web_url,
    _is_web_ready,
    _web_output_path,
    candidate_web_urls,
    public_url_for_rel,
    public_videos2_path,
    row_needs_optimize,
    transcode_and_source_urls,
)


def test_public_videos2_path():
    url = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/user1/clip.mov"
    assert public_videos2_path(url) == "user1/clip.mov"
    assert public_videos2_path("https://youtube.com/watch?v=abc") is None


def test_web_output_path():
    assert _web_output_path("user1/clip.mov") == "user1/clip_w720t.mp4"
    assert _web_output_path("user1/clip_web.mp4") == "user1/clip_w720t.mp4"
    assert _web_output_path("user1/clip_w720.mp4") == "user1/clip_w720t.mp4"
    assert _web_output_path("user1/clip_w720t.mp4") == "user1/clip_w720t.mp4"
    assert _web_output_path("user1/videos/clip.mp4") == "user1/videos/clip_w720t.mp4"


def test_already_web_url():
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720.mp4")
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720t.mp4")
    assert not _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_web.mp4")
    assert not _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b.mp4")


def test_row_needs_optimize():
    base = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/clip.mp4"
    assert row_needs_optimize({"id": "1", "video_url": base})
    assert not row_needs_optimize({"id": "1", "video_url": base.replace("clip.mp4", "clip_w720.mp4")})
    assert not row_needs_optimize({"id": "1", "video_url": base.replace("clip.mp4", "clip_w720t.mp4")})
    assert not row_needs_optimize({"id": "1", "video_url": "https://youtube.com/watch?v=abc"})
    replacement = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/videos/new.mp4"
    assert row_needs_optimize({"id": "1", "video_url": replacement, "source_video_url": base})


def test_transcode_replacement_keeps_caroline_original():
    source = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/old.mp4"
    playback = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/videos/new.mp4"
    to_transcode, screenshot_source = transcode_and_source_urls({
        "video_url": playback,
        "source_video_url": source,
    })
    assert to_transcode == source
    assert screenshot_source == source


def test_candidate_web_urls():
    src = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/videos/clip.mp4"
    urls = candidate_web_urls(src)
    assert urls[0].endswith("/u/videos/clip_w720.mp4")
    assert urls[1].endswith("/u/videos/clip_w720t.mp4")
    assert public_url_for_rel(src, "u/videos/clip_w720.mp4") == urls[0]


def test_is_web_ready():
    assert _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 0})
    assert not _is_web_ready({"codec": "hevc", "height": 720, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 2160, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 1080, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 12_000_000})
