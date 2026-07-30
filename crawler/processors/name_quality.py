"""POI display-name quality rules (reject synthetic OSM placeholders)."""

from __future__ import annotations

import re
from typing import Any

_SYNTHETIC_OSM_RE = re.compile(r" OSM #\d+$", re.IGNORECASE)


def resolve_osm_display_name(tags: dict[str, Any]) -> str | None:
    """Real display name from OSM tags; None if only coords/tags without a label."""
    for key in ("name", "name:vi", "brand", "operator"):
        val = tags.get(key)
        if val is not None:
            text = str(val).strip()
            if text:
                return text
    return None


def is_synthetic_osm_name(name: str | None) -> bool:
    if not name:
        return False
    return bool(_SYNTHETIC_OSM_RE.search(str(name).strip()))


def is_real_poi_name(name: str | None) -> bool:
    if not name or not str(name).strip():
        return False
    n = str(name).strip()
    if is_synthetic_osm_name(n):
        return False
    if len(n) < 4:
        return False
    if len(n) == 1 and n.isalpha():
        return False
    return True
