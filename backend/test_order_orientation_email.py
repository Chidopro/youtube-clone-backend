"""Portrait/landscape order choice should drive email layout."""
import base64
import importlib.util
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image

_MODULE_PATH = Path(__file__).with_name("services") / "order_email.py"
_spec = importlib.util.spec_from_file_location("order_email_under_test", _MODULE_PATH)
order_email = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(order_email)

_cover_crop_pil_image = order_email._cover_crop_pil_image
get_item_image_orientation = order_email.get_item_image_orientation
item_has_baked_edits = order_email.item_has_baked_edits
layout_screenshot_for_orientation = order_email.layout_screenshot_for_orientation
orientation_display_label = order_email.orientation_display_label
orientation_layout_aspect = order_email.orientation_layout_aspect


def _solid_data_url(width, height, color=(20, 80, 160)):
    img = Image.new("RGB", (width, height), color)
    buf = BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


class TestItemImageOrientation(unittest.TestCase):
    def test_tool_settings_win_over_stale_top_level_portrait(self):
        item = {
            "imageOrientation": "portrait",
            "image_orientation": "portrait",
            "toolSettings": {"imageOrientation": "landscape"},
        }
        self.assertEqual(get_item_image_orientation(item), "landscape")

    def test_top_level_landscape_when_tools_missing(self):
        item = {"image_orientation": "landscape"}
        self.assertEqual(get_item_image_orientation(item), "landscape")
        self.assertEqual(orientation_display_label("landscape"), "Landscape")

    def test_defaults_to_portrait(self):
        self.assertEqual(get_item_image_orientation({}), "portrait")
        self.assertEqual(orientation_display_label("portrait"), "Portrait")


class TestOrientationEmailLayout(unittest.TestCase):
    def test_cover_crop_wide_image_to_portrait(self):
        img = Image.new("RGB", (300, 150), (10, 10, 10))
        cropped = _cover_crop_pil_image(img, orientation_layout_aspect("portrait"))
        w, h = cropped.size
        self.assertGreater(h, w)
        self.assertAlmostEqual(w / float(h), 11.5 / 13.8, delta=0.04)

    def test_layout_screenshot_makes_landscape_wider_than_tall(self):
        data = _solid_data_url(200, 300)
        out = layout_screenshot_for_orientation(data, "landscape")
        header, b64 = out.split(",", 1)
        img = Image.open(BytesIO(base64.b64decode(b64)))
        self.assertGreater(img.size[0], img.size[1])


class TestBakedEditEmailSkip(unittest.TestCase):
    def test_frame_enabled_counts_as_baked(self):
        self.assertTrue(item_has_baked_edits({"toolSettings": {"frameEnabled": True}}))

    def test_plain_item_is_not_baked(self):
        self.assertFalse(item_has_baked_edits({"screenshot": "data:image/png;base64,abc"}))

    def test_original_vs_edited_screenshot_counts(self):
        self.assertTrue(item_has_baked_edits({
            "originalScreenshot": "data:image/png;base64,orig",
            "screenshot": "data:image/png;base64,edited",
        }))


class TestEditLog(unittest.TestCase):
    def test_edit_log_html_includes_percent_and_px(self):
        item = {
            "toolSettings": {
                "featherEdge": 40,
                "cornerRadius": 25,
                "frameEnabled": True,
                "frameColor": "#FF0000",
                "frameWidth": 10,
                "imageOrientation": "portrait",
                "editLog": {
                    "imageWidth": 800,
                    "imageHeight": 960,
                    "printWidth": 3450,
                    "printHeight": 4140,
                    "featherPercent": 40,
                    "featherPxX": 160,
                    "featherPxY": 192,
                    "featherPrintPxX": 690,
                    "featherPrintPxY": 828,
                    "cornerRadiusPercent": 25,
                    "cornerRadiusPx": 100,
                    "cornerRadiusPrintPx": 431.2,
                    "frameEnabled": True,
                    "frameColor": "#FF0000",
                    "frameWidthPx": 10,
                    "frameWidthPrintPx": 43.1,
                    "imageOrientation": "portrait",
                    "printAreaFit": "product",
                },
            }
        }
        html = order_email.format_item_edit_log_html(item)
        self.assertIn("Edit log", html)
        self.assertIn("40%", html)
        self.assertIn("160px", html)
        self.assertIn("25%", html)
        self.assertIn("100px", html)
        self.assertIn("300 DPI", html)
        self.assertIn("#FF0000", html)

    def test_plain_item_has_empty_edit_log_html(self):
        self.assertEqual(order_email.format_item_edit_log_html({"screenshot": "data:image/png;base64,abc"}), "")

    def test_fallback_from_flat_tool_settings(self):
        item = {"toolSettings": {"featherEdge": 12, "cornerRadius": 0}}
        html = order_email.format_item_edit_log_html(item)
        self.assertIn("12%", html)


if __name__ == "__main__":
    unittest.main()
