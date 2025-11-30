"""GSD file parser utilities."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from lxml import etree


class GSDParserError(RuntimeError):
    """Raised when a GSD file cannot be parsed."""


class GSDParser:
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
        raise FileNotFoundError(f"GSD file not found: {filepath}")

    def load(self, filepath: str | Path) -> Dict[str, Any]:
        path = self._resolve(filepath)
        try:
            tree = etree.parse(str(path))
        except Exception as exc:
            raise GSDParserError(f"Failed to parse GSD file {path}: {exc}") from exc
        root = tree.getroot()
        metadata = {
            "manufacturer": root.attrib.get("Manufacturer"),
            "type": root.attrib.get("Type"),
            "ident_number": root.attrib.get("IdentNumber"),
        }
        io_config = self._parse_io(root)
        return {
            "filepath": str(path),
            "metadata": metadata,
            "io_config": io_config,
        }

    def _parse_io(self, root: etree._Element) -> Dict[str, Any]:
        inputs = root.findall(".//Input")
        outputs = root.findall(".//Output")
        return {
            "input_length": sum(int(item.attrib.get("Len", 0)) for item in inputs),
            "output_length": sum(int(item.attrib.get("Len", 0)) for item in outputs),
        }

    @lru_cache(maxsize=64)
    def load_cached(self, filepath: str | Path) -> Dict[str, Any]:
        return self.load(filepath)
