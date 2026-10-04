"""Replace collect_usage() with your HTTP API mapping; stdout is one JSON value."""
from datetime import datetime, timezone
import json


def collect_usage():
    return {
        "schemaVersion": 1,
        "source": {"id": "sample-account", "label": "自定义用量示例", "scope": "account"},
        "observedAt": datetime.now(timezone.utc).isoformat(),
        "metrics": [
            {"id": "monthly", "label": "本月额度", "kind": "quota", "used": 42.5, "limit": 100, "unit": "USD"},
            {"id": "window", "label": "当前窗口", "kind": "percentage", "usedPercent": 35},
            {"id": "tokens", "label": "累计用量", "kind": "amount", "value": 123456, "unit": "tokens"},
        ],
    }


if __name__ == "__main__":
    print(json.dumps(collect_usage(), ensure_ascii=False, allow_nan=False))
