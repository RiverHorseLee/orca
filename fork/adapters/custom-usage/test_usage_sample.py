from contextlib import redirect_stdout
from datetime import datetime
import io
import json
from pathlib import Path
import runpy
import unittest
from usage_sample import collect_usage


class UsageSampleTests(unittest.TestCase):
    def test_fixed_values_and_three_metric_types(self):
        result = collect_usage()
        self.assertEqual(result["schemaVersion"], 1)
        self.assertEqual([m["kind"] for m in result["metrics"]], ["quota", "percentage", "amount"])
        self.assertEqual(result["metrics"][0]["used"], 42.5)
        self.assertEqual(result["metrics"][1]["usedPercent"], 35)
        self.assertEqual(result["metrics"][2]["value"], 123456)

    def test_timestamp_is_timezone_aware(self):
        self.assertIsNotNone(datetime.fromisoformat(collect_usage()["observedAt"]).tzinfo)

    def test_entrypoint_prints_one_json_value_and_exits(self):
        output = io.StringIO()
        with redirect_stdout(output):
            runpy.run_path(str(Path(__file__).with_name("usage_sample.py")), run_name="__main__")
        result = json.loads(output.getvalue())
        self.assertEqual(len(result["metrics"]), 3)
        self.assertEqual(len(output.getvalue().splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
