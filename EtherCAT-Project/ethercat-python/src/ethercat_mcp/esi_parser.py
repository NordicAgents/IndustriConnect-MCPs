"""ESI (EtherCAT Slave Information) parser helpers."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from lxml import etree


class ESIParserError(RuntimeError):
    """Raised when an ESI file cannot be parsed."""


class ESIParser:
    def __init__(self, base_path: Optional[Path | str] = None) -> None:
        self.base_path = Path(base_path).expanduser() if base_path else None

    def _resolve(self, filepath: str | Path) -> Path:
        path = Path(filepath).expanduser()
        if path.is_file():
            return path
        if self.base_path:
            candidate = self.base_path / path.name
            if candidate.is_file():
                return candidate
        raise FileNotFoundError(f"ESI file not found: {filepath}")

    def load(self, filepath: str | Path) -> Dict[str, Any]:
        path = self._resolve(filepath)
        try:
            tree = etree.parse(str(path))
        except Exception as exc:
            raise ESIParserError(f"Failed to parse ESI file {path}: {exc}") from exc
        root = tree.getroot()
        metadata = {
            "vendor": root.attrib.get("Vendor"),
            "name": root.attrib.get("Name"),
            "revision": root.attrib.get("Revision"),
        }
        object_dictionary = self._parse_object_dictionary(root)
        pdos = self._parse_pdos(root)
        return {
            "filepath": str(path),
            "metadata": metadata,
            "object_dictionary": object_dictionary,
            "pdos": pdos,
        }

    def _parse_object_dictionary(self, root: etree._Element) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        for obj in root.findall(".//Object"):
            entries.append(
                {
                    "index": obj.attrib.get("Index"),
                    "name": obj.attrib.get("Name"),
                    "type": obj.attrib.get("Type"),
                    "subindexes": [
                        {
                            "subindex": sub.attrib.get("SubIndex"),
                            "name": sub.attrib.get("Name"),
                            "bit_length": sub.attrib.get("BitLen"),
                        }
                        for sub in obj.findall(".//SubItem")
                    ],
                }
            )
        return entries

    def _parse_pdos(self, root: etree._Element) -> Dict[str, List[Dict[str, Any]]]:
        pdos = {"tx": [], "rx": []}
        for direction, key in [("TxPdo", "tx"), ("RxPdo", "rx")]:
            entries = root.findall(f".//{direction}")
            parsed: List[Dict[str, Any]] = []
            for pdo in entries:
                mapped = [
                    {
                        "index": entry.attrib.get("Index"),
                        "subindex": entry.attrib.get("SubIndex"),
                        "bit_length": entry.attrib.get("BitLen"),
                        "name": entry.attrib.get("Name"),
                    }
                    for entry in pdo.findall(".//Entry")
                ]
                parsed.append(
                    {
                        "index": pdo.attrib.get("Index"),
                        "name": pdo.attrib.get("Name"),
                        "entries": mapped,
                    }
                )
            pdos[key] = parsed
        return pdos

    @lru_cache(maxsize=64)
    def load_cached(self, filepath: str | Path) -> Dict[str, Any]:
        return self.load(filepath)
