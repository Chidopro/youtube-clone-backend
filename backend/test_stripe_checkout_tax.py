"""Stripe checkout helpers used for automatic tax."""
import unittest

from utils.stripe_checkout import build_stripe_customer_shipping_for_tax


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

    def test_placeholder_line1_when_missing(self):
        norm = {"zip": "80202", "country_code": "US", "state_code": "CO"}
        out = build_stripe_customer_shipping_for_tax(norm, {})
        self.assertIsNotNone(out)
        self.assertEqual(out["address"]["line1"], "\u2014")


if __name__ == "__main__":
    unittest.main()
