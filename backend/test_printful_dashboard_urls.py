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


if __name__ == "__main__":
    unittest.main()
