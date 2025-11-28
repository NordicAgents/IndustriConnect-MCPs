"""GSD/GSDML parser utilities."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from lxml import etree


@dataclass(slots=True)
class GSDCacheEntry:
    path: Path
    modules: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class GSDParser:
    """Loads and caches GSDML files for module metadata."""

    def __init__(self, base_path: Optional[Path | str] = None) -> None:
        self.base_path = Path(base_path).expanduser() if base_path else None

    def load(self, filepath: str | Path) -> GSDCacheEntry:
        path = Path(filepath).expanduser()
        if not path.is_file():
            # allow lookup relative to base path
            if self.base_path:
                candidate = self.base_path / path.name
                if candidate.is_file():
                    path = candidate
            if not path.is_file():
                raise FileNotFoundError(f"GSD file not found: {filepath}")
        tree = etree.parse(str(path))
        root = tree.getroot()
        modules = self._parse_modules(root)
        metadata = {
            "device_id": root.attrib.get("ID"),
            "vendor": root.attrib.get("Vendor"),
            "name": root.attrib.get("Name"),
            "version": root.attrib.get("Version"),
        }
        return GSDCacheEntry(path=path, modules=modules, metadata=metadata)

    def _parse_modules(self, root: etree._Element) -> List[Dict[str, Any]]:
        modules: List[Dict[str, Any]] = []
        for module in root.findall(".//Module"):
            slots = []
            for subslot in module.findall(".//Subslot"):
                slots.append(
                    {
                        "subslot_number": subslot.attrib.get("Number"),
                        "input_size": subslot.attrib.get("InputSize"),
                        "output_size": subslot.attrib.get("OutputSize"),
                    }
                )
            modules.append(
                {
                    "id": module.attrib.get("ID"),
                    "name": module.attrib.get("Name"),
                    "slots": slots,
                }
            )
        return modules

    @lru_cache(maxsize=64)
    def load_cached(self, filepath: str | Path) -> GSDCacheEntry:
        return self.load(filepath)
