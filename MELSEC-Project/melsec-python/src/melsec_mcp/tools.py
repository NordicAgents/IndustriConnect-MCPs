"""MELSEC MC MCP tool definitions."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .mc_client import MCClient


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    device_map_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        map_path = os.getenv("DEVICE_MAP_FILE")
        return cls(
            writes_enabled=_env_bool("MC_WRITES_ENABLED", True),
            device_map_path=Path(map_path).expanduser() if map_path else None,
        )


class DeviceMap:
    def __init__(self, path: Optional[Path]) -> None:
        self.path = path
        self._devices: Dict[str, Dict[str, Any]] = {}
        self._mtime: Optional[float] = None
        self.refresh()

    def refresh(self) -> None:
        if not self.path:
            self._devices = {}
            self._mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._devices = {}
            self._mtime = None
            return
        if self._mtime and stat.st_mtime <= self._mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                self._devices = {str(alias): spec for alias, spec in data.items()}
                self._mtime = stat.st_mtime
        except Exception:
            self._devices = {}
            self._mtime = stat.st_mtime

    def get(self, alias: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._devices.get(alias)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        return [
            {
                "alias": alias,
                "device_type": spec.get("device_type"),
                "address": spec.get("address"),
                "description": spec.get("description"),
            }
            for alias, spec in self._devices.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._devices)


@dataclass(slots=True)
class ToolResources:
    client: MCClient
    config: ToolConfig
    device_map: DeviceMap


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _client(ctx: Context) -> MCClient:
        return ctx.request_context.lifespan_context.client

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
    async def read_devices(device_type: str, start_address: int, count: int, ctx: Context) -> Dict[str, Any]:
        try:
            values, meta = await _client(ctx).read_devices(device_type, start_address, count)
        except Exception as exc:
            return _err(str(exc), {"device_type": device_type})
        return _ok(data={"device_type": device_type, "start_address": start_address, "values": values}, meta=meta)

    @server.tool()
    async def write_devices(device_type: str, start_address: int, values: List[int], ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes("write_devices")
        if guard:
            return guard
        try:
            meta = await _client(ctx).write_devices(device_type, start_address, values)
        except Exception as exc:
            return _err(str(exc), {"device_type": device_type})
        return _ok(data={"device_type": device_type, "start_address": start_address, "written": len(values)}, meta=meta)

    @server.tool()
    async def list_devices(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"devices": resources.device_map.list(), "count": resources.device_map.count()})

    @server.tool()
    async def read_device_by_alias(alias: str, ctx: Context) -> Dict[str, Any]:
        spec = resources.device_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        return await read_devices(
            spec.get("device_type", "D"),
            int(spec.get("address", 0)),
            int(spec.get("word_count", spec.get("bit_count", 1))),
            ctx,
        )

    @server.tool()
    async def write_device_by_alias(alias: str, values: List[int], ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes("write_device_by_alias")
        if guard:
            return guard
        spec = resources.device_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        return await write_devices(
            spec.get("device_type", "D"),
            int(spec.get("address", 0)),
            values,
            ctx,
        )

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _client(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "device_aliases": resources.device_map.count(),
            }
        )
