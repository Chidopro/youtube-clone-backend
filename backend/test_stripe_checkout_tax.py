"""Stripe checkout helpers used for automatic tax."""
import unittest

from utils.stripe_checkout import build_stripe_customer_shipping_for_tax
from utils.stripe_tax_checkout import shipping_usable_for_stripe_tax_customer


class TestStripeCustomerShippingForTax(unittest.TestCase):
    def test_builds_from_norm_and_raw(self):
        norm = {"zip": "94501", "country_code": "US", "state_code": "CA"}
        raw = {"line1": "1711 Sherman St", "city": "Alameda", "name": "Alan A"}
        out = build_stripe_customer_shipping_for_tax(norm, raw)
        self.assertIsNotNone(out)
        self.assertEqual(out["name"], "Alan A")
        self.assertEqual(out["address"]["postal_code"], "94501")
        self.assertEqual(out["address"]["country"], "US")
        self.assertEqual(out["address"]["state"], "CA")
        self.assertEqual(out["address"]["city"], "Alameda")
        self.assertEqual(out["address"]["line1"], "1711 Sherman St")
        self.assertTrue(shipping_usable_for_stripe_tax_customer(out))

    def test_placeholder_line1_when_missing(self):
        norm = {"zip": "80202", "country_code": "US", "state_code": "CO"}
        out = build_stripe_customer_shipping_for_tax(norm, {})
        self.assertIsNotNone(out)
        self.assertEqual(out["address"]["line1"], "\u2014")
        self.assertFalse(shipping_usable_for_stripe_tax_customer(out))
        self.assertFalse(shipping_usable_for_stripe_tax_customer(None))


class TestCustomerInfoFromOrder(unittest.TestCase):
    def test_printful_paste_from_stripe_shipping(self):
        from utils.stripe_checkout import customer_info_from_order
        info = customer_info_from_order({
            "customer_email": "screenmerch@proton.me",
            "customer_phone": "(510) 993-8024",
            "shipping_address": {
                "name": "Customer",
                "line1": "1711 Sherman Street",
                "city": "Alameda",
                "state": "CA",
                "zip": "94501",
                "country_code": "US",
            },
        })
        self.assertTrue(info["has_street"])
        self.assertIn("1711 Sherman Street", info["paste_text"])
        self.assertIn("Alameda, CA 94501", info["paste_text"])
        self.assertIn("screenmerch@proton.me", info["paste_text"])

    def test_promotes_street_from_line2(self):
        from utils.stripe_checkout import customer_info_from_order
        info = customer_info_from_order({
            "shipping_address": {
                "name": "Customer",
                "line1": "\u2014",
                "line2": "1711 Sherman Street",
                "city": "Alameda",
                "state": "CA",
                "zip": "94501",
                "country_code": "US",
            },
        })
        self.assertTrue(info["has_street"])
        self.assertEqual(info["line1"], "1711 Sherman Street")
        self.assertEqual(info["line2"], "")
        self.assertTrue(info["paste_text"].startswith("Customer\n1711 Sherman Street\n"))


if __name__ == "__main__":
    unittest.main()
