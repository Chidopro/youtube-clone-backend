from utils.video_optimize import (
    _already_web_url,
    _fps_from_rate,
    _is_web_ready,
    _web_output_path,
    candidate_web_urls,
    is_first_pass_playback_url,
    is_gated_playback_url,
    is_timestamped_playback_url,
    playback_is_phone_safe,
    public_url_for_rel,
    public_videos2_path,
    row_needs_optimize,
    row_needs_safer_playback,
    transcode_and_source_urls,
    parse_cropdetect_log,
    MAX_PLAYBACK_BYTES,
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
    assert _web_output_path("user1/clip_w720t.mp4", generation="2") == "user1/clip_w720t2.mp4"
    assert _web_output_path("user1/clip.mp4", generation="2") == "user1/clip_w720t2.mp4"


def test_already_web_url():
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720.mp4")
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720t.mp4")
    assert _already_web_url("https://x.supabase.co/storage/v1/object/public/videos2/a/b_w720t2.mp4")
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
    assert urls[0].endswith("/u/videos/clip_w720t2.mp4")
    assert urls[1].endswith("/u/videos/clip_w720t.mp4")
    assert urls[2].endswith("/u/videos/clip_w720.mp4")
    assert public_url_for_rel(src, "u/videos/clip_w720.mp4") == urls[2]


def test_is_web_ready():
    assert _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 800_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 0})
    assert not _is_web_ready({"codec": "hevc", "height": 720, "bit_rate": 800_000})
    assert not _is_web_ready({"codec": "h264", "height": 2160, "bit_rate": 800_000})
    assert not _is_web_ready({"codec": "h264", "height": 1080, "bit_rate": 800_000})
    assert not _is_web_ready({"codec": "h264", "height": 720, "bit_rate": 12_000_000})


def test_playback_path_kinds():
    t = "https://x.supabase.co/storage/v1/object/public/videos2/a/clip_w720t.mp4"
    t2 = "https://x.supabase.co/storage/v1/object/public/videos2/a/clip_w720t2.mp4?v=9"
    ts = "https://x.supabase.co/storage/v1/object/public/videos2/a/clip_w720t1790169241.mp4"
    assert is_first_pass_playback_url(t)
    assert not is_gated_playback_url(t)
    assert is_gated_playback_url(t2)
    assert not is_first_pass_playback_url(t2)
    assert is_timestamped_playback_url(ts)
    assert not is_first_pass_playback_url(ts)
    assert not is_gated_playback_url(ts)


def test_fps_from_rate():
    assert abs(_fps_from_rate("30/1") - 30) < 0.01
    assert abs(_fps_from_rate("15360/1000") - 15.36) < 0.01
    assert _fps_from_rate("0/0") == 0


def test_playback_is_phone_safe():
    jenny = {"codec": "h264", "height": 720, "fps": 30, "bit_rate": 800_000}
    assert playback_is_phone_safe(jenny, 2_215_000)
    assert not playback_is_phone_safe(jenny, 6_500_000)
    assert not playback_is_phone_safe({"codec": "h264", "height": 720, "fps": 15.36}, 1_900_000)
    assert not playback_is_phone_safe({"codec": "hevc", "height": 720, "fps": 30}, 2_000_000)
    assert not playback_is_phone_safe({"codec": "h264", "height": 1080, "fps": 30}, 2_000_000)
    assert MAX_PLAYBACK_BYTES >= 2_800_000


def test_row_needs_safer_playback():
    base = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/videos2/u/"
    jenny = {"id": "1", "video_url": base + "clip_w720t.mp4"}
    assert not row_needs_safer_playback(jenny, content_length=2_215_000)
    oversized = {"id": "2", "video_url": base + "clip_w720t.mp4"}
    assert row_needs_safer_playback(oversized, content_length=7_000_000)
    gated = {"id": "3", "video_url": base + "clip_w720t2.mp4?v=2696"}
    assert not row_needs_safer_playback(gated, content_length=9_000_000)
    stamped = {"id": "4", "video_url": base + "clip_w720t1790169241.mp4"}
    assert row_needs_safer_playback(stamped, content_length=1_900_000)
    assert not row_needs_safer_playback({"id": "5", "video_url": "https://youtube.com/watch?v=abc"})


def test_parse_cropdetect_log_clipchamp_letterbox():
    log = "[Parsed_cropdetect_0 @ 0] x1:0 x2:1919 y1:128 y2:951 w:1920 h:824 x:0 y:128 pts:1 t:0.03 crop=1920:824:0:128"
    assert parse_cropdetect_log(log, 1920, 1080) == "crop=1920:824:0:128"
    assert parse_cropdetect_log("", 1920, 1080) is None
    assert parse_cropdetect_log("crop=1920:1080:0:0", 1920, 1080) is None
    assert parse_cropdetect_log("crop=1920:200:0:400", 1920, 1080) is None
