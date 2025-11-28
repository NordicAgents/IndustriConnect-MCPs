"""EtherCAT MCP tool definitions."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .ec_master import EthercatMaster, EthercatMasterError
from .esi_parser import ESIParser


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    state_change_enabled: bool = False
    slave_map_path: Optional[Path] = None
    esi_base_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        slave_path = os.getenv("SLAVE_MAP_FILE")
        esi_path = os.getenv("ETHERCAT_ESI_PATH")
        return cls(
            writes_enabled=_env_bool("ETHERCAT_WRITES_ENABLED", True),
            state_change_enabled=_env_bool("ETHERCAT_STATE_CHANGE_ENABLED", False),
            slave_map_path=Path(slave_path).expanduser() if slave_path else None,
            esi_base_path=Path(esi_path).expanduser() if esi_path else None,
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
                "position": spec.get("position"),
                "description": spec.get("description"),
                "vendor_id": spec.get("vendor_id"),
            }
            for alias, spec in self._slaves.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._slaves)


@dataclass(slots=True)
class ToolResources:
    master: EthercatMaster
    config: ToolConfig
    slave_map: SlaveMap
    esi_parser: ESIParser


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _master(ctx: Context) -> EthercatMaster:
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

    def _ensure_state_changes(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.state_change_enabled:
            return _err("State changes are disabled (set ETHERCAT_STATE_CHANGE_ENABLED=true)", {"tool": tool})
        return None

    @server.tool()
    async def scan_network(ctx: Context) -> Dict[str, Any]:
        try:
            devices, meta = await _master(ctx).scan_slaves()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"slaves": devices}, meta=meta)

    @server.tool()
    async def get_slave_info(ctx: Context, slave_position: int) -> Dict[str, Any]:
        try:
            devices, _ = await _master(ctx).scan_slaves()
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        if slave_position >= len(devices):
            return _err("Slave position out of range", {"slave_position": slave_position})
        return _ok(data=devices[slave_position])

    @server.tool()
    async def read_pdo(ctx: Context, slave_position: int, offset: int, length: int) -> Dict[str, Any]:
        try:
            payload, meta = await _master(ctx).read_pdo(slave_position, offset, length)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(
            data={"slave_position": slave_position, "offset": offset, "raw_data_hex": payload.hex()},
            meta=meta,
        )

    @server.tool()
    async def write_pdo(ctx: Context, slave_position: int, offset: int, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_pdo")
        if guard:
            return guard
        payload = bytes(int(b) & 0xFF for b in data)
        try:
            meta = await _master(ctx).write_pdo(slave_position, offset, payload)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(data={"slave_position": slave_position, "written_bytes": len(payload)}, meta=meta)

    @server.tool()
    async def read_sdo(ctx: Context, slave_position: int, index: str, subindex: int) -> Dict[str, Any]:
        idx_int = int(index, 0)
        try:
            value, meta = await _master(ctx).read_sdo(slave_position, idx_int, subindex)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(data=value, meta=meta)

    @server.tool()
    async def write_sdo(ctx: Context, slave_position: int, index: str, subindex: int, value: Any) -> Dict[str, Any]:
        guard = _ensure_writes("write_sdo")
        if guard:
            return guard
        idx_int = int(index, 0)
        try:
            meta = await _master(ctx).write_sdo(slave_position, idx_int, subindex, value)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(data={"written": value, "index": index, "subindex": subindex}, meta=meta)

    @server.tool()
    async def set_slave_state(ctx: Context, slave_position: int, state: str) -> Dict[str, Any]:
        guard = _ensure_state_changes("set_slave_state")
        if guard:
            return guard
        state_map = {"INIT": 1, "PREOP": 2, "SAFEOP": 4, "OP": 8}
        desired = state_map.get(state.upper())
        if desired is None:
            return _err("Invalid state (expected INIT, PREOP, SAFEOP, OP)", {"state": state})
        try:
            meta = await _master(ctx).set_slave_state(slave_position, desired)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(data={"slave_position": slave_position, "state": state.upper()}, meta=meta)

    @server.tool()
    async def load_esi_file(ctx: Context, filepath: str) -> Dict[str, Any]:  # noqa: ARG001
        try:
            data = resources.esi_parser.load_cached(filepath)
        except Exception as exc:
            return _err(str(exc), {"filepath": filepath})
        return _ok(data=data)

    @server.tool()
    async def list_slaves(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"slaves": resources.slave_map.list(), "count": resources.slave_map.count()})

    @server.tool()
    async def read_slave_by_alias(ctx: Context, alias: str, length: int = 8) -> Dict[str, Any]:
        spec = resources.slave_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        position = int(spec.get("position", 0))
        offset = int(spec.get("offset", 0))
        return await read_pdo(ctx, position, offset, length)

    @server.tool()
    async def write_slave_by_alias(ctx: Context, alias: str, data: List[int]) -> Dict[str, Any]:
        guard = _ensure_writes("write_slave_by_alias")
        if guard:
            return guard
        spec = resources.slave_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        position = int(spec.get("position", 0))
        offset = int(spec.get("offset", 0))
        return await write_pdo(ctx, position, offset, data)

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _master(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "state_change_enabled": resources.config.state_change_enabled,
                "slave_aliases": resources.slave_map.count(),
            }
        )

    @server.tool()
    async def get_master_status(ctx: Context) -> Dict[str, Any]:
        return _ok(data=_master(ctx).connection_status())

    @server.tool()
    async def test_slave_communication(ctx: Context, slave_position: int) -> Dict[str, Any]:
        try:
            payload, meta = await _master(ctx).read_pdo(slave_position, 0, 4)
        except Exception as exc:
            return _err(str(exc), {"slave_position": slave_position})
        return _ok(data={"slave_position": slave_position, "bytes": payload.hex()}, meta=meta)
