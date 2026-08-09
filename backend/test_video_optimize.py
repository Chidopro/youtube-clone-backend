from utils.video_optimize import (
    _already_web_url,
    _is_web_ready,
    _web_output_path,
    public_videos2_path,
    row_needs_optimize,
)


def test_public_videos2_path():
    url = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/user1/clip.mov"
    assert public_videos2_path(url) == "user1/clip.mov"
    assert public_videos2_path("https://youtube.com/watch?v=abc") is None


def test_web_output_path():
    assert _web_output_path("user1/clip.mov") == "user1/clip_w720.mp4"
    assert _web_output_path("user1/clip_web.mp4") == "user1/clip_w720.mp4"
    assert _web_output_path("user1/clip_w720.mp4") == "user1/clip_w720.mp4"


def test_already_web_url():
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720.mp4")
    assert not _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_web.mp4")
    assert not _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b.mp4")


def test_row_needs_optimize():
    base = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/clip.mp4"
    assert row_needs_optimize({"id": "1", "video_url": base})
    assert not row_needs_optimize({"id": "1", "video_url": base.replace("clip.mp4", "clip_w720.mp4")})
    assert not row_needs_optimize({"id": "1", "video_url": "https://youtube.com/watch?v=abc"})


def test_is_web_ready():
    assert _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 0})
    assert not _is_web_ready({"codec": "hevc", "height": 720, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 2160, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 1080, "bit_rate": 2_000_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 12_000_000})
