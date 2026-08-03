"""VinFast Hà Nội — curated public seed (SPA official page không có API công khai ổn định).

Nguồn tham chiếu trang chính thức:
https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac

Khi phát hiện XHR/JSON ổn định, thay fetch_vinfast_locations() bằng HTTP client.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

SEED_PATH = Path(__file__).parent / "data" / "vinfast_hanoi_seed.json"
OFFICIAL_URL = "https://vinfastauto.com/vn_vi/tim-kiem-showroom-tram-sac"


def fetch_vinfast_locations() -> list[dict[str, Any]]:
    if not SEED_PATH.exists():
        log.error("Missing seed file %s", SEED_PATH)
        return []
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    for item in data:
        item.setdefault("source_url", OFFICIAL_URL)
        # Curated HN seed — stamp city so validate/upsert stay city-aware
        item.setdefault("city", "hanoi")
    log.info("VinFast seed loaded: %s records", len(data))
    return data
