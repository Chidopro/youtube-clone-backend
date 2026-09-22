"""Printful dashboard customizer URLs for the print-quality admin button."""
import unittest

from printful_catalog import (
    PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME,
    PRINTFUL_DASHBOARD_URLS_BY_CATALOG_ID,
    printful_dashboard_url_for_product_name,
    printful_dashboard_urls_by_product_name,
)


class TestPrintfulDashboardUrls(unittest.TestCase):
    def test_womens_shirt_opens_bella_canvas_6400(self):
        url = printful_dashboard_url_for_product_name("Women's Shirt")
        self.assertEqual(
            url,
            "https://www.printful.com/dashboard/custom/womens/t-shirts/womens-relaxed-t-shirt-bella-canvas-6400",
        )

    def test_womens_heavyweight_opens_comfort_colors_1717_womens(self):
        url = printful_dashboard_url_for_product_name("Heavyweight T-Shirt")
        self.assertEqual(
            url,
            "https://www.printful.com/dashboard/custom/womens/t-shirts/unisex-garment-dyed-heavyweight-shirt-comfort-colors-1717",
        )

    def test_every_catalog_product_has_dashboard_url(self):
        missing = []
        for name, cid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
            if int(cid) not in PRINTFUL_DASHBOARD_URLS_BY_CATALOG_ID:
                missing.append((name, cid))
        self.assertEqual(missing, [])

    def test_name_map_includes_storefront_aliases(self):
        urls = printful_dashboard_urls_by_product_name()
        self.assertIn("T-Shirt", urls)
        self.assertIn("Unisex T-Shirt", urls)
        self.assertEqual(urls["T-Shirt"], urls["Unisex T-Shirt"])

    def test_womens_ribbed_neck_opens_satu001_womens(self):
        self.assertEqual(PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME["Women's Ribbed Neck"], 818)
        self.assertEqual(
            printful_dashboard_url_for_product_name("Women's Ribbed Neck"),
            "https://www.printful.com/dashboard/custom/womens/t-shirts/unisex-organic-ribbed-neck-t-shirt-stanley-stella-satu001",
        )

    def test_womens_pullover_hoodie_opens_bella_3719_womens(self):
        self.assertEqual(PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME["Pullover Hoodie"], 294)
        self.assertEqual(
            printful_dashboard_url_for_product_name("Pullover Hoodie"),
            "https://www.printful.com/dashboard/custom/womens/hoodies/unisex-pullover-hoodie-bella-canvas-3719",
        )

    def test_oversized_tshirt_maps_to_bella_3010(self):
        self.assertEqual(PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME["Oversized T-Shirt"], 1592)
        self.assertEqual(PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME["Unisex Oversized T-Shirt"], 1592)
        self.assertEqual(
            printful_dashboard_url_for_product_name("Oversized T-Shirt"),
            "https://www.printful.com/dashboard/custom/womens/shirts/unisex-oversized-boxy-tee-bella-canvas-3010",
        )


if __name__ == "__main__":
    unittest.main()
