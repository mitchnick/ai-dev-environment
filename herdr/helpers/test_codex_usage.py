import importlib.machinery
import importlib.util
from pathlib import Path
import unittest

loader = importlib.machinery.SourceFileLoader(
    "codex_usage", str(Path(__file__).with_name("herdr-codex-usage")),
)
spec = importlib.util.spec_from_loader(loader.name, loader)
usage = importlib.util.module_from_spec(spec)
loader.exec_module(usage)


class CodexUsageTest(unittest.TestCase):
    def test_uses_codex_bucket_instead_of_another_models_quota(self):
        result = {
            "rateLimits": {"primary": {"usedPercent": 99}},
            "rateLimitsByLimitId": {"codex": {
                "primary": {"usedPercent": 0, "resetsAt": 123, "windowDurationMins": 300},
                "secondary": {"usedPercent": 49, "resetsAt": 456, "windowDurationMins": 10080},
            }},
        }
        self.assertEqual(usage.cache_payload(result), {
            "source": "codex-app-server",
            "rate_limit": {
                "primary_window": {"used_percent": 0, "reset_at": 123, "limit_window_seconds": 18000},
                "secondary_window": {"used_percent": 49, "reset_at": 456, "limit_window_seconds": 604800},
            },
        })

    def test_accepts_single_bucket_and_missing_reset(self):
        self.assertEqual(usage.cache_payload({
            "rateLimits": {"primary": {"usedPercent": 49}},
            "rateLimitsByLimitId": None,
        })["rate_limit"]["primary_window"], {
            "used_percent": 49, "reset_at": None, "limit_window_seconds": 0,
        })

    def test_missing_or_invalid_usage_cannot_replace_cache(self):
        for primary in (None, {}, {"usedPercent": "unavailable"}):
            with self.subTest(primary=primary), self.assertRaises(RuntimeError):
                usage.cache_payload({"rateLimits": {"primary": primary}})


if __name__ == "__main__":
    unittest.main()
