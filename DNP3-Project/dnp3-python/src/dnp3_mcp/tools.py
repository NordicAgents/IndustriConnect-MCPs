"""DNP3 MCP tool definitions."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .dnp3_master import DNP3Master


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    point_map_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        map_path = os.getenv("POINT_MAP_FILE")
        return cls(
            writes_enabled=_env_bool("DNP3_WRITES_ENABLED", True),
            point_map_path=Path(map_path).expanduser() if map_path else None,
        )


class PointMap:
    def __init__(self, path: Optional[Path]) -> None:
        self.path = path
        self._points: Dict[str, Dict[str, Any]] = {}
        self._mtime: Optional[float] = None
        self.refresh()

    def refresh(self) -> None:
        if not self.path:
            self._points = {}
            self._mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._points = {}
            self._mtime = None
            return
        if self._mtime and stat.st_mtime <= self._mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                self._points = {str(alias): spec for alias, spec in data.items()}
                self._mtime = stat.st_mtime
        except Exception:
            self._points = {}
            self._mtime = stat.st_mtime

    def get(self, alias: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._points.get(alias)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        return [
            {
                "alias": alias,
                "outstation": spec.get("outstation"),
                "type": spec.get("type"),
                "index": spec.get("index"),
                "description": spec.get("description"),
            }
            for alias, spec in self._points.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._points)


@dataclass(slots=True)
class ToolResources:
    master: DNP3Master
    config: ToolConfig
    point_map: PointMap


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _master(ctx: Context) -> DNP3Master:
        return ctx.request_context.lifespan_context.master

    def _result(success: bool, data: Any = None, error: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {"success": success, "data": data, "error": error, "meta": meta or {}}

    def _ok(data: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(True, data=data, meta=meta)

    def _err(message: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(False, error=message, meta=meta)

    def _ensure_writes(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.writes_enabled:
            return _err("Write operations are disabled by configuration", {"tool": tool})
        return None

    @server.tool()
    async def read_binary_inputs(outstation_address: int, start_index: int, count: int, ctx: Context) -> Dict[str, Any]:
        try:
            points, meta = await _master(ctx).read_binary_inputs(outstation_address, start_index, count)
        except Exception as exc:
            return _err(str(exc), {"outstation_address": outstation_address})
        return _ok(data={"outstation": outstation_address, "points": points}, meta=meta)

    @server.tool()
    async def read_analog_inputs(outstation_address: int, start_index: int, count: int, ctx: Context) -> Dict[str, Any]:
        try:
            points, meta = await _master(ctx).read_analog_inputs(outstation_address, start_index, count)
        except Exception as exc:
            return _err(str(exc), {"outstation_address": outstation_address})
        return _ok(data={"outstation": outstation_address, "points": points}, meta=meta)

    @server.tool()
    async def write_binary_output(outstation_address: int, index: int, value: bool, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes("write_binary_output")
        if guard:
            return guard
        try:
            meta = await _master(ctx).write_binary_output(outstation_address, index, value)
        except Exception as exc:
            return _err(str(exc), {"outstation_address": outstation_address})
        return _ok(data={"outstation": outstation_address, "index": index, "value": value}, meta=meta)

    @server.tool()
    async def poll_class(outstation_address: int, event_class: int, ctx: Context) -> Dict[str, Any]:
        try:
            meta = await _master(ctx).poll_class(outstation_address, event_class)
        except Exception as exc:
            return _err(str(exc), {"outstation_address": outstation_address})
        return _ok(data={"outstation": outstation_address, "class": event_class}, meta=meta)

    @server.tool()
    async def list_points(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"points": resources.point_map.list(), "count": resources.point_map.count()})

    @server.tool()
    async def read_point_by_alias(alias: str, ctx: Context) -> Dict[str, Any]:
        spec = resources.point_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        p_type = spec.get("type")
        outstation = int(spec.get("outstation", 0))
        index = int(spec.get("index", 0))
        if p_type == "binary_input":
            return await read_binary_inputs(outstation, index, 1, ctx)
        if p_type == "analog_input":
            return await read_analog_inputs(outstation, index, 1, ctx)
        return _err(f"Unsupported point type '{p_type}' for alias '{alias}'")

    @server.tool()
    async def write_point_by_alias(alias: str, value: Any, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes("write_point_by_alias")
        if guard:
            return guard
        spec = resources.point_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        p_type = spec.get("type")
        outstation = int(spec.get("outstation", 0))
        index = int(spec.get("index", 0))
        if p_type == "binary_output":
            return await write_binary_output(outstation, index, bool(value), ctx)
        return _err(f"Point type '{p_type}' not writable via alias")

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _master(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "point_aliases": resources.point_map.count(),
            }
        )
