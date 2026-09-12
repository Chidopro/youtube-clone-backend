import unittest

from utils.payout import payout_list_key, umbrella_payout_balance_fields


class PayoutListKeyTests(unittest.TestCase):
    def test_strips_dashes_and_case(self):
        dashed = "550e8400-e29b-41d4-a716-446655440000"
        compact = "550E8400E29B41D4A716446655440000"
        self.assertEqual(payout_list_key(dashed), payout_list_key(compact))


class UmbrellaPayoutBalanceTests(unittest.TestCase):
    def test_full_payment_is_paid_up(self):
        result = umbrella_payout_balance_fields(108, [{"amount": 108}])
        self.assertTrue(result["is_paid_up"])
        self.assertEqual(result["balance_owed"], 0)
        self.assertFalse(result["can_record_payout"])
        self.assertFalse(result["payout_stale"])
        self.assertIsNotNone(result["last_payout"])

    def test_one_cent_overpay_still_paid_up(self):
        result = umbrella_payout_balance_fields(108, [{"amount": 108.01}])
        self.assertTrue(result["is_paid_up"])
        self.assertEqual(result["balance_owed"], 0)
        self.assertFalse(result["payout_stale"])

    def test_overpayment_stays_paid_up(self):
        result = umbrella_payout_balance_fields(90, [{"amount": 108}])
        self.assertTrue(result["is_paid_up"])
        self.assertEqual(result["balance_owed"], 0)
        self.assertFalse(result["can_record_payout"])
        self.assertTrue(result["payout_stale"])
        self.assertIsNotNone(result["last_payout"])

    def test_unpaid_balance_keeps_record_button(self):
        result = umbrella_payout_balance_fields(108, [])
        self.assertFalse(result["is_paid_up"])
        self.assertEqual(result["balance_owed"], 108)
        self.assertTrue(result["can_record_payout"])

    def test_last_payout_prefers_newest_created_at(self):
        result = umbrella_payout_balance_fields(180, [
            {"amount": 222, "created_at": "2026-09-10T00:00:00Z", "paid_at": "2026-09-11"},
            {"amount": 180, "created_at": "2026-09-11T18:00:00Z", "paid_at": "2026-09-11"},
        ])
        self.assertEqual(result["last_payout"]["amount"], 180)

    def test_last_payout_prefers_newer_paid_at_when_created_at_missing(self):
        result = umbrella_payout_balance_fields(180, [
            {"amount": 222, "paid_at": "2026-08-01"},
            {"amount": 180, "paid_at": "2026-09-11"},
        ])
        self.assertEqual(result["last_payout"]["amount"], 180)


class SalesRowsMatchingListsTests(unittest.TestCase):
    def test_keeps_rows_for_any_matching_list(self):
        from utils.payout import sales_rows_matching_lists

        pom = "c2f6598d-ec9c-4daf-b01c-96a951502ac3"
        gee = "eb2ad543-7bde-4d0c-ad51-8cd20d8968e7"
        rows = [
            {"id": 1, "favorite_list_id": pom},
            {"id": 2, "favorite_list_id": gee},
            {"id": 3, "favorite_list_id": None},
            {"id": 4, "favorite_list_id": pom.replace("-", "").upper()},
        ]
        matched = sales_rows_matching_lists(rows, [pom])
        self.assertEqual([1, 4], [r["id"] for r in matched])


if __name__ == "__main__":
    unittest.main()
