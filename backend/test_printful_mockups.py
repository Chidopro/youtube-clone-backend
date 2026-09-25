"""Unit tests for mug wrap mockup helpers (no live Printful calls)."""
import unittest

from printful_mockups import (
    _merge_mockup_results,
    _pick_placement,
    artwork_position_for_catalog,
    collect_mockup_views,
    compose_tote_wrap_bytes,
    contain_in_print_area,
    cover_in_print_area,
    image_pixel_size,
    is_bag_product_name,
    is_mug_product_name,
    is_accessory_product_name,
    is_pet_product_name,
    is_public_https_url,
    mockup_task_payloads,
    mug_preview_object_path,
    pick_mockup_url,
    public_image_url_for_printful,
    resolve_bag_catalog_id,
    resolve_mug_catalog_id,
    resolve_accessory_catalog_id,
    resolve_pet_catalog_id,
    resolve_wrap_catalog_id,
    tote_front_artwork_position,
    tote_wrap_panels,
)


class TestMugMockupHelpers(unittest.TestCase):
    def test_is_mug_from_category_or_name(self):
        self.assertTrue(is_mug_product_name("Canvas Tote", "mugs"))
        self.assertTrue(is_mug_product_name("White Glossy Mug", "mens"))
        self.assertFalse(is_mug_product_name("T-Shirt", "mens"))

    def test_resolve_catalog_ids(self):
        self.assertEqual(resolve_mug_catalog_id("White Glossy Mug"), 19)
        self.assertEqual(resolve_mug_catalog_id("Travel Mug"), 663)
        self.assertEqual(resolve_mug_catalog_id("Enamel Mug"), 407)
        self.assertEqual(resolve_mug_catalog_id("Colored Mug"), 403)
        self.assertIsNone(resolve_mug_catalog_id("T-Shirt"))
        self.assertEqual(resolve_bag_catalog_id("All-Over Print Drawstring"), 262)
        self.assertEqual(resolve_bag_catalog_id("All Over Print Tote Pocket"), 274)
        self.assertEqual(resolve_bag_catalog_id("Laptop Sleeve"), 394)
        self.assertIsNone(resolve_bag_catalog_id("All-Over Print Utility Bag"))
        self.assertIsNone(resolve_wrap_catalog_id("All-Over Print Utility Bag"))
        self.assertIsNone(resolve_bag_catalog_id("Canvas Tote"))
        self.assertIsNone(resolve_bag_catalog_id("T-Shirt"))
        self.assertEqual(resolve_wrap_catalog_id("Laptop Sleeve"), 394)
        self.assertEqual(resolve_wrap_catalog_id("White Glossy Mug"), 19)
        self.assertEqual(resolve_pet_catalog_id("Pet Bowl All-Over Print"), 678)
        self.assertEqual(resolve_pet_catalog_id("Pet Bandana Collar"), 902)
        self.assertEqual(resolve_wrap_catalog_id("Pet Bowl All-Over Print"), 678)
        self.assertEqual(resolve_wrap_catalog_id("Pet Bandana Collar"), 902)
        self.assertTrue(is_pet_product_name("Pet Bowl All-Over Print", "pets"))
        self.assertTrue(is_pet_product_name("Pet Bandana Collar", "mens"))
        self.assertFalse(is_pet_product_name("T-Shirt", "pets"))
        self.assertEqual(resolve_accessory_catalog_id("Greeting Card"), 568)
        self.assertEqual(resolve_accessory_catalog_id("Hardcover Bound Notebook"), 682)
        self.assertEqual(resolve_accessory_catalog_id("Apron"), 894)
        self.assertEqual(resolve_accessory_catalog_id("Jigsaw Puzzle with Tin"), 906)
        self.assertEqual(resolve_wrap_catalog_id("Greeting Card"), 568)
        self.assertEqual(resolve_wrap_catalog_id("Hardcover Bound Notebook"), 682)
        self.assertEqual(resolve_wrap_catalog_id("Apron"), 894)
        self.assertEqual(resolve_wrap_catalog_id("Jigsaw Puzzle with Tin"), 906)
        self.assertTrue(is_accessory_product_name("Greeting Card", "misc"))
        self.assertTrue(is_accessory_product_name("Hardcover Bound Notebook", "misc"))
        self.assertTrue(is_accessory_product_name("Apron", "hats"))
        self.assertTrue(is_accessory_product_name("Jigsaw Puzzle with Tin", "misc"))
        self.assertFalse(is_accessory_product_name("T-Shirt", "misc"))
        self.assertTrue(is_bag_product_name("Laptop Sleeve", "bags"))
        self.assertFalse(is_bag_product_name("All-Over Print Utility Bag", "bags"))
        self.assertFalse(is_bag_product_name("Canvas Tote", "bags"))

    def test_bag_requests_front_and_back_options(self):
        self.assertEqual(
            mockup_task_payloads(262),
            [{}, {"options": ["Front", "Back"]}],
        )
        self.assertEqual(
            mockup_task_payloads(274),
            [{}, {"options": ["Front", "Back"]}],
        )
        self.assertEqual(
            mockup_task_payloads(394),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(678),
            [{}, {"options": ["Front", "Left", "Right"]}],
        )
        self.assertEqual(
            mockup_task_payloads(902),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(568),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(682),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(894),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(906),
            [{"options": ["Front"]}],
        )
        self.assertEqual(
            mockup_task_payloads(744),
            [{}, {"option_groups": ["Flat"]}],
        )

    def test_tote_prefers_default_over_pocket(self):
        placement, printfile_id = _pick_placement(
            274,
            {"pocket": 12, "default": 7, "front": 8},
        )
        self.assertEqual(placement, "default")
        self.assertEqual(printfile_id, 7)

    def test_colored_and_travel_request_left_right_options(self):
        self.assertEqual(
            mockup_task_payloads(403),
            [{}, {"options": ["Front", "Left", "Right"]}],
        )
        self.assertEqual(
            mockup_task_payloads(663),
            [{}, {"options": ["Front", "Left", "Right"]}],
        )
        self.assertEqual(
            mockup_task_payloads(19),
            [{}, {"option_groups": ["Flat"]}],
        )

    def test_contain_square_in_wrap(self):
        pos = contain_in_print_area(520, 202, 700, 700)
        self.assertEqual(pos["area_width"], 520)
        self.assertEqual(pos["area_height"], 202)
        self.assertEqual(pos["width"], 202)
        self.assertEqual(pos["height"], 202)
        self.assertEqual(pos["left"], 159)
        self.assertEqual(pos["top"], 0)

    def test_cover_fills_laptop_sleeve_and_crops_portrait(self):
        pos = cover_in_print_area(2250, 1725, 3000, 4000)
        self.assertEqual(pos["area_width"], 2250)
        self.assertEqual(pos["area_height"], 1725)
        self.assertEqual(pos["width"], 2250)
        self.assertEqual(pos["height"], 3000)
        self.assertEqual(pos["left"], 0)
        self.assertEqual(pos["top"], -638)

    def test_tote_panels_are_front_top_and_back_bottom(self):
        front, back = tote_wrap_panels(3150, 5550)
        self.assertEqual(front[0], 0)
        self.assertEqual(front[1], 0)
        self.assertEqual(front[2], 3150)
        self.assertLess(front[3], 5550 * 0.55)
        self.assertGreater(back[1], 5550 * 0.45)
        self.assertEqual(back[1] + back[3], 5550)

    def test_tote_positions_photo_on_front_panel_only(self):
        pos = artwork_position_for_catalog(274, 3150, 5550, 3000, 4000)
        self.assertEqual(pos["area_width"], 3150)
        self.assertEqual(pos["area_height"], 5550)
        self.assertLessEqual(pos["top"] + pos["height"], int(round(5550 * 0.48)) + 1)
        self.assertGreater(pos["height"], 2000)
        fallback = tote_front_artwork_position(3150, 5550, 3000, 4000)
        self.assertEqual(pos, fallback)

    def test_compose_tote_keeps_front_upright_and_back_on_bottom(self):
        from io import BytesIO
        from PIL import Image

        front = Image.new("RGB", (40, 60), (255, 0, 0))
        back = Image.new("RGB", (40, 60), (0, 0, 255))
        blob = compose_tote_wrap_bytes(front, back, 3150, 5550)
        out = Image.open(BytesIO(blob)).convert("RGB")
        self.assertEqual(out.size, (3150, 5550))
        def near(pixel, color, slack=4):
            return all(abs(int(a) - int(b)) <= slack for a, b in zip(pixel, color))
        self.assertTrue(near(out.getpixel((1575, int(5550 * 0.24))), (255, 0, 0)))
        self.assertTrue(near(out.getpixel((1575, int(5550 * 0.76))), (0, 0, 255)))
        self.assertTrue(near(out.getpixel((1575, 2775)), (0, 0, 0)))

    def test_compose_tote_copies_front_onto_back_when_back_missing(self):
        from io import BytesIO
        from PIL import Image

        front = Image.new("RGB", (40, 60), (255, 0, 0))
        blob = compose_tote_wrap_bytes(front, None, 3150, 5550)
        out = Image.open(BytesIO(blob)).convert("RGB")

        def near(pixel, color, slack=4):
            return all(abs(int(a) - int(b)) <= slack for a, b in zip(pixel, color))

        self.assertTrue(near(out.getpixel((1575, int(5550 * 0.24))), (255, 0, 0)))
        self.assertTrue(near(out.getpixel((1575, int(5550 * 0.76))), (255, 0, 0)))

    def test_compose_tote_keeps_art_off_opening_and_gusset(self):
        from io import BytesIO
        from PIL import Image

        front = Image.new("RGB", (40, 60), (255, 0, 0))
        blob = compose_tote_wrap_bytes(front, None, 3150, 5550)
        out = Image.open(BytesIO(blob)).convert("RGB")

        def near(pixel, color, slack=8):
            return all(abs(int(a) - int(b)) <= slack for a, b in zip(pixel, color))

        self.assertTrue(near(out.getpixel((1575, 6)), (0, 0, 0)))
        front_h = int(round(5550 * 0.48))
        self.assertTrue(near(out.getpixel((1575, front_h - 6)), (0, 0, 0)))
        self.assertTrue(near(out.getpixel((1575, int(5550 * 0.24))), (255, 0, 0)))

    def test_compose_tote_mirrors_front_onto_back_when_back_missing(self):
        from io import BytesIO
        from PIL import Image

        front = Image.new("RGB", (40, 60), (255, 0, 0))
        for x in range(20, 40):
            for y in range(60):
                front.putpixel((x, y), (0, 0, 255))
        blob = compose_tote_wrap_bytes(front, None, 3150, 5550)
        out = Image.open(BytesIO(blob)).convert("RGB")
        _front_box, back_box = tote_wrap_panels(3150, 5550)
        _bl, back_top, bw, bh = back_box
        on_bag = out.crop((0, back_top, bw, back_top + bh)).rotate(180)

        def near(pixel, color, slack=8):
            return all(abs(int(a) - int(b)) <= slack for a, b in zip(pixel, color))

        mid_y = bh // 2
        self.assertTrue(near(on_bag.getpixel((int(bw * 0.28), mid_y)), (0, 0, 255)))
        self.assertTrue(near(on_bag.getpixel((int(bw * 0.72), mid_y)), (255, 0, 0)))
        self.assertTrue(near(out.getpixel((int(3150 * 0.28), int(5550 * 0.24))), (255, 0, 0)))
        self.assertTrue(near(out.getpixel((int(3150 * 0.72), int(5550 * 0.24))), (0, 0, 255)))

    def test_catalog_cover_vs_contain(self):
        cover = artwork_position_for_catalog(394, 2250, 1725, 3000, 4000)
        contain = artwork_position_for_catalog(262, 2400, 2850, 3000, 4000)
        self.assertEqual(cover["width"], 2250)
        self.assertLess(contain["width"], 2400)
        bandana = artwork_position_for_catalog(902, 3060, 1875, 3000, 4000)
        bowl = artwork_position_for_catalog(678, 6496, 803, 3000, 4000)
        self.assertEqual(bandana["width"], 3060)
        self.assertEqual(bowl["width"], 6496)
        self.assertGreater(bowl["height"], 803)
        self.assertLess(bowl["top"], 0)
        notebook = artwork_position_for_catalog(682, 900, 1500, 3000, 4000)
        apron = artwork_position_for_catalog(894, 4350, 4783, 3000, 4000)
        card = artwork_position_for_catalog(568, 1842, 1240, 3000, 4000)
        puzzle = artwork_position_for_catalog(906, 2953, 2350, 3000, 4000)
        self.assertEqual(notebook["height"], 1500)
        self.assertGreater(notebook["width"], 900)
        self.assertLess(notebook["left"], 0)
        self.assertEqual(apron["width"], 4350)
        self.assertGreater(apron["height"], 4783)
        self.assertLess(apron["top"], 0)
        self.assertEqual(card["width"], 1842)
        self.assertGreater(card["height"], 1240)
        self.assertLess(card["top"], 0)
        self.assertEqual(puzzle["width"], 2953)
        self.assertGreater(puzzle["height"], 2350)
        self.assertLess(puzzle["top"], 0)

    def test_contain_portrait_keeps_aspect_in_wide_wrap(self):
        pos = contain_in_print_area(520, 202, 3000, 4000)
        self.assertEqual(pos["height"], 202)
        self.assertEqual(pos["width"], 152)
        self.assertGreater(pos["left"], 0)
        self.assertEqual(pos["top"], 0)

    def test_contain_without_image_size_uses_min_side(self):
        pos = contain_in_print_area(520, 202)
        self.assertEqual(pos["width"], 202)
        self.assertEqual(pos["height"], 202)

    def test_image_pixel_size_reads_png_blob(self):
        from io import BytesIO
        from PIL import Image

        buf = BytesIO()
        Image.new("RGB", (8, 12), (255, 0, 0)).save(buf, format="PNG")
        self.assertEqual(image_pixel_size(blob=buf.getvalue()), (8, 12))

    def test_public_https(self):
        self.assertTrue(is_public_https_url("https://files.cdn.printful.com/foo.jpg"))
        self.assertFalse(is_public_https_url("http://example.com/x.jpg"))
        self.assertFalse(is_public_https_url("https://localhost/x.jpg"))
        self.assertFalse(is_public_https_url("data:image/jpeg;base64,xx"))

    def test_pick_mockup_url_prefers_primary(self):
        url = pick_mockup_url(
            {
                "mockups": [
                    {"mockup_url": "https://files.cdn.printful.com/wrap.jpg", "extra": []},
                ]
            }
        )
        self.assertEqual(url, "https://files.cdn.printful.com/wrap.jpg")

    def test_collect_views_ranks_front_before_handle(self):
        views = collect_mockup_views(
            {
                "mockups": [
                    {
                        "mockup_url": "https://files.cdn.printful.com/white-glossy-mug-handle-on-right.jpg",
                        "extra": [
                            {"title": "Front", "url": "https://files.cdn.printful.com/white-glossy-mug-front.jpg"},
                            {"title": "Handle on left", "url": "https://files.cdn.printful.com/white-glossy-mug-handle-on-left.jpg"},
                        ],
                    }
                ]
            }
        )
        self.assertEqual(
            [v["title"] for v in views],
            ["Front", "Handle on left", "Handle right"],
        )
        self.assertEqual(views[0]["url"], "https://files.cdn.printful.com/white-glossy-mug-front.jpg")

    def test_merge_combines_front_and_handle_views(self):
        merged = _merge_mockup_results(
            [
                {
                    "mockup_url": "https://files.cdn.printful.com/handle-on-right.jpg",
                    "mockup_urls": [
                        {"title": "Handle right", "url": "https://files.cdn.printful.com/handle-on-right.jpg"},
                        {"title": "Handle left", "url": "https://files.cdn.printful.com/handle-on-left.jpg"},
                    ],
                },
                {
                    "mockup_url": "https://files.cdn.printful.com/front-view.jpg",
                    "mockup_urls": [
                        {"title": "default", "url": "https://files.cdn.printful.com/front-view.jpg"},
                    ],
                },
            ]
        )
        self.assertEqual(merged["mockup_url"], "https://files.cdn.printful.com/front-view.jpg")
        self.assertEqual(len(merged["mockup_urls"]), 3)

    def test_unique_angles_drop_duplicate_front_and_right(self):
        merged = _merge_mockup_results(
            [
                {
                    "mockup_url": "https://files.cdn.printful.com/colored-front-a.jpg",
                    "mockup_urls": [
                        {"title": "Front", "url": "https://files.cdn.printful.com/colored-front-a.jpg"},
                        {"title": "Right", "url": "https://files.cdn.printful.com/colored-right-a.jpg"},
                    ],
                },
                {
                    "mockup_url": "https://files.cdn.printful.com/colored-front-b.jpg",
                    "mockup_urls": [
                        {"title": "Front", "url": "https://files.cdn.printful.com/colored-front-b.jpg"},
                        {"title": "Right", "url": "https://files.cdn.printful.com/colored-right-b.jpg"},
                        {"title": "Left", "url": "https://files.cdn.printful.com/colored-left.jpg"},
                    ],
                },
            ]
        )
        titles = [v["title"] for v in merged["mockup_urls"]]
        self.assertEqual(titles, ["Front", "Left", "Right"])
        self.assertEqual(merged["mockup_url"], "https://files.cdn.printful.com/colored-front-a.jpg")

    def test_unique_angles_keep_one_travel_right(self):
        merged = _merge_mockup_results(
            [
                {
                    "mockup_urls": [
                        {"title": "Right", "url": "https://files.cdn.printful.com/travel-right-a.jpg"},
                        {"title": "Front", "url": "https://files.cdn.printful.com/travel-front.jpg"},
                        {"title": "Right", "url": "https://files.cdn.printful.com/travel-right-b.jpg"},
                    ]
                }
            ]
        )
        titles = [v["title"] for v in merged["mockup_urls"]]
        self.assertEqual(titles, ["Front", "Right"])
        self.assertEqual(len(merged["mockup_urls"]), 2)

    def test_unique_angles_keep_bag_front_and_back(self):
        merged = _merge_mockup_results(
            [
                {
                    "mockup_urls": [
                        {"title": "Front", "url": "https://files.cdn.printful.com/drawstring-front.jpg"},
                        {"title": "Back", "url": "https://files.cdn.printful.com/drawstring-back.jpg"},
                        {"title": "Front", "url": "https://files.cdn.printful.com/drawstring-front-b.jpg"},
                    ]
                }
            ]
        )
        titles = [v["title"] for v in merged["mockup_urls"]]
        self.assertEqual(titles, ["Front", "Back"])
        self.assertEqual(merged["mockup_url"], "https://files.cdn.printful.com/drawstring-front.jpg")

    def test_mug_preview_object_path_is_content_addressed(self):
        path, ctype = mug_preview_object_path(b"abc", "image/jpeg")
        self.assertTrue(path.startswith("mug-preview/"))
        self.assertTrue(path.endswith(".jpg"))
        self.assertEqual(ctype, "image/jpeg")
        path_png, ctype_png = mug_preview_object_path(b"abc", "image/png")
        self.assertTrue(path_png.endswith(".png"))
        self.assertEqual(ctype_png, "image/png")
        self.assertNotEqual(path, path_png)
        again, _ = mug_preview_object_path(b"abc", "image/jpeg")
        self.assertEqual(path, again)

    def test_public_https_passthrough_for_printful(self):
        url = "https://sojxbydpcdcdzfdtbypd.supabase.co/storage/v1/object/public/thumbnails/x.jpg"
        self.assertEqual(public_image_url_for_printful(url, "unused"), url)


if __name__ == "__main__":
    unittest.main()
