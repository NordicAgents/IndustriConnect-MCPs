"""MCP tool definitions for PROFINET interactions."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .gsd_parser import GSDCacheEntry, GSDParser
from .pn_client import ProfinetClient, ProfinetClientError


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    config_cmds_enabled: bool = False
    device_map_path: Optional[Path] = None
    gsd_base_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        device_path = os.getenv("DEVICE_MAP_FILE")
        gsd_path = os.getenv("PROFINET_GSD_PATH")
        return cls(
            writes_enabled=_env_bool("PROFINET_WRITES_ENABLED", True),
            config_cmds_enabled=_env_bool("PROFINET_CONFIG_CMDS_ENABLED", False),
            device_map_path=Path(device_path).expanduser() if device_path else None,
            gsd_base_path=Path(gsd_path).expanduser() if gsd_path else None,
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
                    self._devices = {str(name): spec for name, spec in data.items()}
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
                "device_name": spec.get("device_name"),
                "ip_address": spec.get("ip_address"),
                "description": spec.get("description"),
            }
            for alias, spec in self._devices.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._devices)


@dataclass(slots=True)
class ToolResources:
    client: ProfinetClient
    config: ToolConfig
    device_map: DeviceMap
    gsd_parser: GSDParser


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _client(ctx: Context) -> ProfinetClient:
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

    def _ensure_config(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.config_cmds_enabled:
            return _err("Configuration commands are disabled (set PROFINET_CONFIG_CMDS_ENABLED=true)", {"tool": tool})
        return None

    @server.tool()
    async def discover_devices(ctx: Context, timeout: Optional[int] = None) -> Dict[str, Any]:
        try:
            devices, meta = await _client(ctx).discover_devices(timeout)
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"devices": devices}, meta=meta)

    @server.tool()
    async def get_device_info(ctx: Context, device_name: str) -> Dict[str, Any]:
        # For now, rely on cached discovery results
        try:
            devices, meta = await _client(ctx).discover_devices()
        except Exception as exc:
            return _err(str(exc), {"device_name": device_name})
        for device in devices:
            if device.get("device_name") == device_name or device.get("ip_address") == device_name:
                return _ok(data=device, meta=meta)
        return _err("Device not found", {"device_name": device_name})

    @server.tool()
    async def set_device_name(ctx: Context, device_mac: str, name: str) -> Dict[str, Any]:
        guard = _ensure_config("set_device_name")
        if guard:
            return guard
        try:
            meta = await _client(ctx).set_device_name(device_mac, name)
        except Exception as exc:
            return _err(str(exc), {"device_mac": device_mac})
        return _ok(data={"device_mac": device_mac, "name": name}, meta=meta)

    @server.tool()
    async def set_device_ip(ctx: Context, device_mac: str, ip_address: str, subnet_mask: str, gateway: Optional[str] = None) -> Dict[str, Any]:
        guard = _ensure_config("set_device_ip")
        if guard:
            return guard
        try:
            meta = await _client(ctx).set_device_ip(device_mac, ip_address, subnet_mask, gateway)
        except Exception as exc:
            return _err(str(exc), {"device_mac": device_mac})
        return _ok(data={"device_mac": device_mac, "ip_address": ip_address}, meta=meta)

    @server.tool()
    async def identify_device(ctx: Context, device_mac: str, duration_s: int = 5) -> Dict[str, Any]:
        try:
            meta = await _client(ctx).identify_device(device_mac, duration_s)
        except Exception as exc:
            return _err(str(exc), {"device_mac": device_mac})
        return _ok(data={"device_mac": device_mac, "identify_duration_s": duration_s}, meta=meta)

    @server.tool()
    async def read_io_data(ctx: Context, device_name: str, slot: int, subslot: int, data_length: int) -> Dict[str, Any]:
        try:
            payload, meta = await _client(ctx).read_io_data(device_name, slot, subslot, data_length)
        except Exception as exc:
            return _err(str(exc), {"device_name": device_name})
        return _ok(
            data={"device_name": device_name, "slot": slot, "subslot": subslot, "raw_data_hex": payload.hex()},
            meta=meta,
        )

    @server.tool()
    async def write_io_data(ctx: Context, device_name: str, slot: int, subslot: int, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_io_data")
        if guard:
            return guard
        payload = bytes(int(b) & 0xFF for b in data)
        try:
            meta = await _client(ctx).write_io_data(device_name, slot, subslot, payload)
        except Exception as exc:
            return _err(str(exc), {"device_name": device_name})
        return _ok(data={"device_name": device_name, "written_bytes": len(payload)}, meta=meta)

    @server.tool()
    async def load_gsd_file(ctx: Context, filepath: str) -> Dict[str, Any]:  # noqa: ARG001
        try:
            entry = resources.gsd_parser.load_cached(filepath)
        except Exception as exc:
            return _err(str(exc), {"filepath": filepath})
        return _ok(data={"filepath": str(entry.path), "modules": entry.modules, "metadata": entry.metadata})

    @server.tool()
    async def list_devices(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"devices": resources.device_map.list(), "count": resources.device_map.count()})

    @server.tool()
    async def read_device_by_alias(ctx: Context, alias: str) -> Dict[str, Any]:
        spec = resources.device_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        device_name = spec.get("device_name") or alias
        return await read_io_data(ctx, device_name, spec.get("slot", 0), spec.get("subslot", 1), spec.get("data_length", 8))

    @server.tool()
    async def write_device_by_alias(ctx: Context, alias: str, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_device_by_alias")
        if guard:
            return guard
        spec = resources.device_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        return await write_io_data(ctx, spec.get("device_name") or alias, spec.get("slot", 0), spec.get("subslot", 1), data)

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _client(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "config_cmds_enabled": resources.config.config_cmds_enabled,
                "device_aliases": resources.device_map.count(),
            }
        )

    @server.tool()
    async def get_connection_status(ctx: Context) -> Dict[str, Any]:
        return _ok(data=_client(ctx).connection_status())

    @server.tool()
    async def test_device_communication(ctx: Context, device_name: str) -> Dict[str, Any]:
        try:
            payload, meta = await _client(ctx).read_io_data(device_name, 0, 1, 4)
        except Exception as exc:
            return _err(str(exc), {"device_name": device_name})
        return _ok(data={"device_name": device_name, "bytes": payload.hex()}, meta=meta)
