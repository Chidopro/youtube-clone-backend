"""Print-quality feather should match Tools: inward linear fade, full edge amount."""
import unittest

import cv2
import numpy as np

from screenshot_capture import (
    _composite_on_white,
    _distance_inside_including_canvas_border,
    _draw_rounded_rect_filled,
    _flatten_alpha_to_white_inside_shape,
    _needs_alpha_pipeline,
    _tools_matching_feather_factor,
    process_thumbnail_for_print,
)


class TestCanvasBorderFeatherDistance(unittest.TestCase):
    def test_straight_edge_distance_is_near_zero(self):
        size = 200
        radius = 40
        mask = np.zeros((size, size), dtype=np.uint8)
        _draw_rounded_rect_filled(mask, 0, 0, size, size, radius, 255)

        naive = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
        fixed = _distance_inside_including_canvas_border(mask)

        mid = size // 2
        self.assertGreater(float(naive[0, mid]), 20)
        self.assertLess(float(fixed[0, mid]), 1.5)
        self.assertLess(float(fixed[mid, 0]), 1.5)
        self.assertGreater(float(fixed[mid, mid]), 40)


class TestToolsMatchingFeather(unittest.TestCase):
    def test_inward_linear_fade_uses_each_axis(self):
        width, height = 200, 400
        percent = 20
        fade_x = (percent / 100.0) * (width * 0.5)
        fade_y = (percent / 100.0) * (height * 0.5)
        factor = _tools_matching_feather_factor(width, height, percent)
        mid_x, mid_y = width // 2, height // 2

        self.assertLess(float(factor[0, mid_x]), 0.05)
        self.assertLess(float(factor[mid_y, 0]), 0.05)
        half_y = int(round(fade_y / 2))
        self.assertAlmostEqual(float(factor[half_y, mid_x]), 0.5, delta=0.08)
        self.assertGreater(float(factor[int(fade_y) + 2, mid_x]), 0.95)
        half_x = int(round(fade_x / 2))
        self.assertAlmostEqual(float(factor[mid_y, half_x]), 0.5, delta=0.08)
        self.assertGreater(float(factor[mid_y, mid_x]), 0.99)

    def test_inner_feather_corner_is_rounded_not_square(self):
        size = 200
        percent = 20
        fade = (percent / 100.0) * (size * 0.5)
        factor = _tools_matching_feather_factor(size, size, percent)
        fi = int(round(fade))
        # Axis-aligned X*Y ramps go fully opaque at (fade, fade), leaving a square.
        self.assertLess(float(factor[fi, fi]), 0.85)
        self.assertGreater(float(factor[int(fade) + 2, size // 2]), 0.95)
        inset = int(round(fade + fade * 0.75))
        self.assertGreater(float(factor[inset, inset]), 0.95)

    def test_feather_follows_stadium_curve(self):
        width, height = 200, 400
        percent = 20
        radius = 100
        fade_x = (percent / 100.0) * (width * 0.5)
        factor = _tools_matching_feather_factor(
            width, height, percent, corner_radius_px=radius
        )
        # Outer stadium arc through (fade_x, 2*fade_x) is near the boundary,
        # not a fully opaque square inner corner.
        sample_y = int(round(2 * fade_x))
        sample_x = int(round(fade_x))
        self.assertLess(float(factor[sample_y, sample_x]), 0.35)
        self.assertLess(float(factor[2, width // 2]), 0.15)
        self.assertGreater(float(factor[height // 2, width // 2]), 0.99)


class TestCompositeOnWhite(unittest.TestCase):
    def test_opaque_bgra_drops_alpha(self):
        img = np.zeros((4, 4, 4), dtype=np.uint8)
        img[:, :] = (10, 20, 30, 255)
        out = _composite_on_white(img)
        self.assertEqual(out.shape, (4, 4, 3))
        self.assertEqual(tuple(out[0, 0]), (10, 20, 30))

    def test_transparent_becomes_white(self):
        img = np.zeros((8, 8, 4), dtype=np.uint8)
        out = _composite_on_white(img)
        self.assertEqual(out.shape, (8, 8, 3))
        self.assertEqual(tuple(out[0, 0]), (255, 255, 255))

    def test_bgr_passthrough(self):
        img = np.zeros((2, 2, 3), dtype=np.uint8)
        img[:] = (1, 2, 3)
        out = _composite_on_white(img)
        self.assertTrue(np.array_equal(out, img))

    def test_half_alpha_blends_toward_white(self):
        img = np.zeros((2, 2, 4), dtype=np.uint8)
        img[:] = (0, 0, 0, 128)
        out = _composite_on_white(img)
        self.assertGreater(int(out[0, 0, 0]), 120)
        self.assertLess(int(out[0, 0, 0]), 140)


class TestAlphaPipelineFlag(unittest.TestCase):
    def test_generate_300_dpi_skips_alpha(self):
        self.assertFalse(_needs_alpha_pipeline(
            add_white_background=True,
            soft_corners=False,
            edge_feather=False,
            corner_radius_percent=0,
            feather_edge_percent=0,
        ))

    def test_feather_requires_alpha(self):
        self.assertTrue(_needs_alpha_pipeline(
            add_white_background=True,
            feather_edge_percent=25,
        ))


class TestProcessThumbnailBgrPath(unittest.TestCase):
    def test_print_area_upscale_returns_expected_size(self):
        src = np.zeros((120, 100, 3), dtype=np.uint8)
        src[:] = (40, 80, 160)
        ok, buf = cv2.imencode('.png', src)
        self.assertTrue(ok)
        import base64
        data_url = 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode('ascii')
        result = process_thumbnail_for_print(
            data_url,
            print_dpi=300,
            add_white_background=True,
            print_area_width=2,
            print_area_height=3,
            image_orientation='portrait',
            fit_mode='cover',
        )
        self.assertTrue(result.get('success'), result.get('error'))
        self.assertEqual(result['dimensions']['width'], 600)
        self.assertEqual(result['dimensions']['height'], 900)
        self.assertTrue(result['screenshot'].startswith('data:image/png;base64,'))


class TestRoundedCornersStayTransparent(unittest.TestCase):
    def test_corner_pixels_are_transparent_even_if_white_bg_requested(self):
        import base64
        import io
        from PIL import Image

        src = np.zeros((100, 80, 3), dtype=np.uint8)
        src[:] = (40, 80, 160)
        ok, buf = cv2.imencode('.png', src)
        self.assertTrue(ok)
        data_url = 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode('ascii')
        result = process_thumbnail_for_print(
            data_url,
            print_dpi=72,
            corner_radius_percent=80,
            add_white_background=True,
            preserve_edits=True,
            fit_mode='preserve',
        )
        self.assertTrue(result.get('success'), result.get('error'))
        raw = result['screenshot'].split(',', 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(raw)))
        self.assertEqual(img.mode, 'RGBA')
        self.assertEqual(img.getpixel((0, 0))[3], 0)
        self.assertEqual(img.getpixel((img.width - 1, 0))[3], 0)
        self.assertEqual(img.getpixel((0, img.height - 1))[3], 0)
        self.assertEqual(img.getpixel((img.width - 1, img.height - 1))[3], 0)
        center = img.getpixel((img.width // 2, img.height // 2))
        self.assertEqual(center[3], 255)
        self.assertGreater(center[2], 100)

    def test_feather_inside_shape_is_opaque_white_fade(self):
        import base64
        import io
        from PIL import Image

        src = np.zeros((100, 80, 3), dtype=np.uint8)
        src[:] = (40, 80, 160)
        ok, buf = cv2.imencode('.png', src)
        self.assertTrue(ok)
        data_url = 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode('ascii')
        result = process_thumbnail_for_print(
            data_url,
            print_dpi=72,
            corner_radius_percent=80,
            feather_edge_percent=30,
            add_white_background=True,
            preserve_edits=True,
            fit_mode='preserve',
        )
        self.assertTrue(result.get('success'), result.get('error'))
        raw = result['screenshot'].split(',', 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(raw)))
        self.assertEqual(img.mode, 'RGBA')
        self.assertEqual(img.getpixel((0, 0))[3], 0)
        center = img.getpixel((img.width // 2, img.height // 2))
        self.assertEqual(center[3], 255)
        edge = img.getpixel((img.width // 2, 2))
        self.assertEqual(edge[3], 255)
        self.assertGreater(edge[0], 180)
        self.assertGreater(edge[1], 180)
        self.assertGreater(edge[2], 180)

    def test_feather_inside_shape_is_opaque_black_fade(self):
        import base64
        import io
        from PIL import Image

        src = np.zeros((100, 80, 3), dtype=np.uint8)
        src[:] = (200, 200, 200)
        ok, buf = cv2.imencode('.png', src)
        self.assertTrue(ok)
        data_url = 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode('ascii')
        result = process_thumbnail_for_print(
            data_url,
            print_dpi=72,
            corner_radius_percent=80,
            feather_edge_percent=30,
            add_white_background=True,
            feather_fade_color='black',
            preserve_edits=True,
            fit_mode='preserve',
        )
        self.assertTrue(result.get('success'), result.get('error'))
        raw = result['screenshot'].split(',', 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(raw)))
        self.assertEqual(img.mode, 'RGBA')
        self.assertEqual(img.getpixel((0, 0))[3], 0)
        center = img.getpixel((img.width // 2, img.height // 2))
        self.assertEqual(center[3], 255)
        edge = img.getpixel((img.width // 2, 2))
        self.assertEqual(edge[3], 255)
        self.assertLess(edge[0], 80)
        self.assertLess(edge[1], 80)
        self.assertLess(edge[2], 80)


class TestFlattenInsideShape(unittest.TestCase):
    def test_partial_alpha_inside_becomes_opaque_white_blend(self):
        img = np.zeros((8, 8, 4), dtype=np.uint8)
        img[:] = (0, 0, 0, 128)
        mask = np.zeros((8, 8), dtype=np.uint8)
        mask[2:6, 2:6] = 255
        out = _flatten_alpha_to_white_inside_shape(img, mask)
        self.assertEqual(int(out[0, 0, 3]), 0)
        self.assertEqual(tuple(out[0, 0, :3]), (0, 0, 0))
        self.assertEqual(int(out[4, 4, 3]), 255)
        self.assertGreater(int(out[4, 4, 0]), 120)
        self.assertLess(int(out[4, 4, 0]), 140)

    def test_partial_alpha_inside_becomes_opaque_black_blend(self):
        img = np.zeros((8, 8, 4), dtype=np.uint8)
        img[:] = (255, 255, 255, 128)
        mask = np.zeros((8, 8), dtype=np.uint8)
        mask[2:6, 2:6] = 255
        out = _flatten_alpha_to_white_inside_shape(img, mask, fill=0)
        self.assertEqual(int(out[0, 0, 3]), 0)
        self.assertEqual(int(out[4, 4, 3]), 255)
        self.assertGreater(int(out[4, 4, 0]), 120)
        self.assertLess(int(out[4, 4, 0]), 140)


if __name__ == "__main__":
    unittest.main()
