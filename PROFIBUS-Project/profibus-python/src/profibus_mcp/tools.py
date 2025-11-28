"""PROFIBUS MCP tool definitions."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .gsd_parser import GSDParser
from .pb_master import ProfibusMaster


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    config_cmds_enabled: bool = False
    slave_map_path: Optional[Path] = None
    gsd_base_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        slave_path = os.getenv("SLAVE_MAP_FILE")
        gsd_path = os.getenv("PROFIBUS_GSD_PATH")
        return cls(
            writes_enabled=_env_bool("PROFIBUS_WRITES_ENABLED", True),
            config_cmds_enabled=_env_bool("PROFIBUS_CONFIG_CMDS_ENABLED", False),
            slave_map_path=Path(slave_path).expanduser() if slave_path else None,
            gsd_base_path=Path(gsd_path).expanduser() if gsd_path else None,
        )


class SlaveMap:
    def __init__(self, path: Optional[Path]) -> None:
        self.path = path
        self._slaves: Dict[str, Dict[str, Any]] = {}
        self._mtime: Optional[float] = None
        self.refresh()

    def refresh(self) -> None:
        if not self.path:
            self._slaves = {}
            self._mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._slaves = {}
            self._mtime = None
            return
        if self._mtime and stat.st_mtime <= self._mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                self._slaves = {str(alias): spec for alias, spec in data.items()}
                self._mtime = stat.st_mtime
        except Exception:
            self._slaves = {}
            self._mtime = stat.st_mtime

    def get(self, alias: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._slaves.get(alias)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        return [
            {
                "alias": alias,
                "address": spec.get("address"),
                "description": spec.get("description"),
            }
            for alias, spec in self._slaves.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._slaves)


@dataclass(slots=True)
class ToolResources:
    master: ProfibusMaster
    config: ToolConfig
    slave_map: SlaveMap
    gsd_parser: GSDParser


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _master(ctx: Context) -> ProfibusMaster:
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
    async def scan_bus(ctx: Context) -> Dict[str, Any]:
        try:
            devices, meta = await _master(ctx).scan_bus()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"slaves": devices}, meta=meta)

    @server.tool()
    async def read_inputs(ctx: Context, slave_address: int, length: int) -> Dict[str, Any]:
        try:
            payload, meta = await _master(ctx).read_inputs(slave_address, length)
        except Exception as exc:
            return _err(str(exc), {"slave_address": slave_address})
        return _ok(
            data={"slave_address": slave_address, "raw_data_hex": payload.hex()},
            meta=meta,
        )

    @server.tool()
    async def write_outputs(ctx: Context, slave_address: int, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_outputs")
        if guard:
            return guard
        payload = bytes(int(b) & 0xFF for b in data)
        try:
            meta = await _master(ctx).write_outputs(slave_address, payload)
        except Exception as exc:
            return _err(str(exc), {"slave_address": slave_address})
        return _ok(data={"slave_address": slave_address, "written_bytes": len(payload)}, meta=meta)

    @server.tool()
    async def read_diagnosis(ctx: Context, slave_address: int) -> Dict[str, Any]:
        try:
            diag, meta = await _master(ctx).read_diagnosis(slave_address)
        except Exception as exc:
            return _err(str(exc), {"slave_address": slave_address})
        return _ok(data=diag, meta=meta)

    @server.tool()
    async def load_gsd_file(ctx: Context, filepath: str) -> Dict[str, Any]:  # noqa: ARG001
        try:
            data = resources.gsd_parser.load_cached(filepath)
        except Exception as exc:
            return _err(str(exc), {"filepath": filepath})
        return _ok(data=data)

    @server.tool()
    async def list_slaves(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"slaves": resources.slave_map.list(), "count": resources.slave_map.count()})

    @server.tool()
    async def read_slave_by_alias(ctx: Context, alias: str, length: int = 4) -> Dict[str, Any]:
        spec = resources.slave_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        address = int(spec.get("address", 0))
        return await read_inputs(ctx, address, length)

    @server.tool()
    async def write_slave_by_alias(ctx: Context, alias: str, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_slave_by_alias")
        if guard:
            return guard
        spec = resources.slave_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        address = int(spec.get("address", 0))
        return await write_outputs(ctx, address, data)

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _master(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "config_cmds_enabled": resources.config.config_cmds_enabled,
                "slave_aliases": resources.slave_map.count(),
            }
        )

    @server.tool()
    async def get_master_status(ctx: Context) -> Dict[str, Any]:
        return _ok(data=_master(ctx).connection_status())

    @server.tool()
    async def test_slave_communication(ctx: Context, slave_address: int) -> Dict[str, Any]:
        try:
            payload, meta = await _master(ctx).read_inputs(slave_address, 4)
        except Exception as exc:
            return _err(str(exc), {"slave_address": slave_address})
        return _ok(data={"slave_address": slave_address, "bytes": payload.hex()}, meta=meta)
