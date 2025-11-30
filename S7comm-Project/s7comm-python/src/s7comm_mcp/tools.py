"""MCP tool definitions for the S7comm server."""

from __future__ import annotations

import json
import os
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from mcp.server.fastmcp import Context, FastMCP

from .s7_client import OperationMeta, S7Client, S7ClientError


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    system_cmds_enabled: bool = False
    tag_map_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        tag_path = os.getenv("TAG_MAP_FILE")
        return cls(
            writes_enabled=_env_bool("S7_WRITES_ENABLED", True),
            system_cmds_enabled=_env_bool("S7_SYSTEM_CMDS_ENABLED", False),
            tag_map_path=Path(tag_path).expanduser() if tag_path else None,
        )


class TagMap:
    """Simple JSON-backed tag registry."""

    def __init__(self, path: Optional[Path | str]) -> None:
        self.path = Path(path).expanduser() if path else None
        self._tags: Dict[str, Dict[str, Any]] = {}
        self._last_mtime: Optional[float] = None
        if self.path:
            self.refresh()

    def refresh(self) -> None:
        """Reload the tag file if it changed."""
        if not self.path:
            self._tags = {}
            self._last_mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._tags = {}
            self._last_mtime = None
            return
        if self._last_mtime and stat.st_mtime <= self._last_mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception:
            self._tags = {}
            self._last_mtime = stat.st_mtime
            return
        if isinstance(data, dict):
            self._tags = {str(name): spec for name, spec in data.items()}
            self._last_mtime = stat.st_mtime

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._tags.get(name)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        items: List[Dict[str, Any]] = []
        for name, spec in self._tags.items():
            items.append(
                {
                    "name": name,
                    "area": spec.get("area"),
                    "description": spec.get("description"),
                    "meta": {k: v for k, v in spec.items() if k not in {"area", "description"}},
                }
            )
        return items

    def __len__(self) -> int:
        return len(self._tags)


@dataclass(slots=True)
class ToolResources:
    client: S7Client
    config: ToolConfig
    tag_map: TagMap


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    """Register all MCP tools on the provided server."""

    def _client(ctx: Context) -> S7Client:
        return ctx.request_context.lifespan_context.client

    def _result(success: bool, data: Any = None, error: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "success": success,
            "data": data,
            "error": error,
            "meta": meta or {},
        }

    def _ok(data: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(True, data=data, meta=meta)

    def _err(message: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(False, error=message, meta=meta)

    def _merge_meta(meta: OperationMeta, extra: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(meta)
        merged.update(extra)
        return merged

    def _ensure_writes_allowed(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.writes_enabled:
            return _err("Write operations are disabled by configuration", {"tool": tool})
        return None

    def _ensure_system_cmds(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.system_cmds_enabled:
            return _err("System commands are disabled (set S7_SYSTEM_CMDS_ENABLED=true to allow)", {"tool": tool})
        return None

    @server.tool()
    async def read_db(
        db_number: int,
        start_offset: int,
        size: int,
        ctx: Context,
    ) -> Dict[str, Any]:
        """Read raw bytes from a Siemens data block (DB)."""
        meta_extra = {"db_number": db_number, "start_offset": start_offset, "size": size}
        try:
            payload, meta = await _client(ctx).read_db(db_number, start_offset, size)
        except Exception as exc:
            return _err(str(exc), meta_extra)
        return _ok(
            data={
                "raw_bytes_hex": payload.hex(),
                "byte_count": len(payload),
            },
            meta=_merge_meta(meta, meta_extra),
        )

    @server.tool()
    async def write_db(
        db_number: int,
        start_offset: int,
        value: Any,
        ctx: Context,
        data_type: Optional[str] = None,
        size: Optional[int] = None,
        bit_index: Optional[int] = None,
        string_length: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Write bytes (raw or typed) into a Siemens data block."""
        guard = _ensure_writes_allowed("write_db")
        if guard:
            return guard
        try:
            payload = _coerce_payload(value, data_type, size, bit_index, string_length)
        except ValueError as exc:
            return _err(str(exc))
        try:
            meta = await _client(ctx).write_db(db_number, start_offset, payload)
        except Exception as exc:
            return _err(str(exc), {"db_number": db_number, "start_offset": start_offset})
        return _ok(
            data={"written_bytes": len(payload)},
            meta=_merge_meta(meta, {"db_number": db_number, "start_offset": start_offset}),
        )

    @server.tool()
    async def read_db_typed(
        db_number: int,
        start_offset: int,
        data_type: str,
        ctx: Context,
        size: Optional[int] = None,
        bit_index: Optional[int] = None,
        string_length: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Read and decode typed data from a data block."""
        dtype = _normalize_dtype(data_type)
        try:
            read_size = _calc_size(dtype, size, string_length)
        except ValueError as exc:
            return _err(str(exc))
        try:
            payload, meta = await _client(ctx).read_db(db_number, start_offset, read_size)
            value = _decode_typed(payload, dtype, bit_index, string_length or size)
        except Exception as exc:
            return _err(str(exc), {"db_number": db_number, "start_offset": start_offset})
        return _ok(
            data={"value": value, "data_type": dtype, "raw_bytes_hex": payload.hex()},
            meta=_merge_meta(meta, {"db_number": db_number, "start_offset": start_offset}),
        )

    # -----------------------------
    # I/O Areas
    # -----------------------------

    async def _read_area_tool(ctx: Context, area: str, start: int, size: int) -> Tuple[bytes, Dict[str, Any]]:
        payload, meta = await _client(ctx).read_area(area, start, size)
        return payload, meta

    async def _write_area_tool(ctx: Context, area: str, start: int, payload: bytes) -> Dict[str, Any]:
        meta = await _client(ctx).write_area(area, start, payload)
        return meta

    @server.tool()
    async def read_input(start_byte: int, size: int, ctx: Context) -> Dict[str, Any]:
        """Read process inputs (PI)."""
        try:
            payload, meta = await _read_area_tool(ctx, "input", start_byte, size)
        except Exception as exc:
            return _err(str(exc), {"start_byte": start_byte, "size": size})
        return _ok(
            data={"raw_bytes_hex": payload.hex()},
            meta=_merge_meta(meta, {"area": "input", "start_byte": start_byte, "size": size}),
        )

    @server.tool()
    async def read_output(start_byte: int, size: int, ctx: Context) -> Dict[str, Any]:
        """Read process outputs (PQ)."""
        try:
            payload, meta = await _read_area_tool(ctx, "output", start_byte, size)
        except Exception as exc:
            return _err(str(exc), {"start_byte": start_byte, "size": size})
        return _ok(
            data={"raw_bytes_hex": payload.hex()},
            meta=_merge_meta(meta, {"area": "output", "start_byte": start_byte, "size": size}),
        )

    @server.tool()
    async def write_output(
        start_byte: int,
        value: Any,
        ctx: Context,
        data_type: Optional[str] = None,
        size: Optional[int] = None,
        bit_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_output")
        if guard:
            return guard
        try:
            payload = _coerce_payload(value, data_type, size, bit_index, None)
        except ValueError as exc:
            return _err(str(exc))
        try:
            meta = await _write_area_tool(ctx, "output", start_byte, payload)
        except Exception as exc:
            return _err(str(exc), {"start_byte": start_byte})
        return _ok(
            data={"written_bytes": len(payload)},
            meta=_merge_meta(meta, {"area": "output", "start_byte": start_byte}),
        )

    @server.tool()
    async def read_marker(start_byte: int, size: int, ctx: Context) -> Dict[str, Any]:
        """Read marker memory (M)."""
        try:
            payload, meta = await _read_area_tool(ctx, "marker", start_byte, size)
        except Exception as exc:
            return _err(str(exc), {"start_byte": start_byte, "size": size})
        return _ok(
            data={"raw_bytes_hex": payload.hex()},
            meta=_merge_meta(meta, {"area": "marker", "start_byte": start_byte, "size": size}),
        )

    @server.tool()
    async def write_marker(
        start_byte: int,
        value: Any,
        ctx: Context,
        data_type: Optional[str] = None,
        size: Optional[int] = None,
        bit_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_marker")
        if guard:
            return guard
        try:
            payload = _coerce_payload(value, data_type, size, bit_index, None)
        except ValueError as exc:
            return _err(str(exc))
        try:
            meta = await _write_area_tool(ctx, "marker", start_byte, payload)
        except Exception as exc:
            return _err(str(exc), {"start_byte": start_byte})
        return _ok(
            data={"written_bytes": len(payload)},
            meta=_merge_meta(meta, {"area": "marker", "start_byte": start_byte}),
        )

    # -----------------------------
    # PLC Information
    # -----------------------------

    @server.tool()
    async def read_plc_info(ctx: Context) -> Dict[str, Any]:
        try:
            data, meta = await _client(ctx).read_plc_info()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data=data, meta=meta)

    @server.tool()
    async def read_cpu_state(ctx: Context) -> Dict[str, Any]:
        try:
            state, meta = await _client(ctx).read_cpu_state()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"state": state}, meta=meta)

    @server.tool()
    async def set_cpu_state(state: str, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_system_cmds("set_cpu_state")
        if guard:
            return guard
        try:
            meta = await _client(ctx).set_cpu_state(state)
        except Exception as exc:
            return _err(str(exc), {"requested_state": state})
        return _ok(data={"state": state.upper()}, meta=meta)

    @server.tool()
    async def read_system_time(ctx: Context) -> Dict[str, Any]:
        try:
            timestamp, meta = await _client(ctx).read_system_time()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"system_time": timestamp}, meta=meta)

    @server.tool()
    async def read_szl(szl_id: int, szl_index: int, ctx: Context) -> Dict[str, Any]:
        try:
            data, meta = await _client(ctx).read_szl(szl_id, szl_index)
        except Exception as exc:
            return _err(str(exc), {"szl_id": szl_id, "szl_index": szl_index})
        return _ok(data={"szl": data}, meta=_merge_meta(meta, {"szl_id": szl_id, "szl_index": szl_index}))

    # -----------------------------
    # Advanced operations
    # -----------------------------

    def _area_from_spec(spec: Dict[str, Any]) -> str:
        return str(spec.get("area") or spec.get("table") or "db").lower()

    async def _read_single_var(ctx: Context, spec: Dict[str, Any]) -> Tuple[str, Any]:
        area = _area_from_spec(spec)
        dtype = spec.get("data_type")
        bit_index = spec.get("bit") or spec.get("bit_index")
        string_length = spec.get("string_length")
        if area == "db":
            db_number = int(spec.get("db_number", 1))
            offset = int(spec.get("offset", 0))
            size = spec.get("size")
            if dtype:
                dtype = _normalize_dtype(dtype)
                read_size = _calc_size(dtype, size, string_length)
                payload, _meta = await _client(ctx).read_db(db_number, offset, read_size)
                value = _decode_typed(payload, dtype, bit_index, string_length or size)
                return area, {"value": value, "raw_bytes_hex": payload.hex(), "data_type": dtype}
            payload, _meta = await _client(ctx).read_db(db_number, offset, int(size or 1))
            return area, {"raw_bytes_hex": payload.hex()}
        start_byte = int(spec.get("byte", spec.get("start_byte", 0)))
        size = int(spec.get("size", 1))
        payload, _meta = await _client(ctx).read_area(area, start_byte, size)
        if dtype:
            value = _decode_typed(payload, _normalize_dtype(dtype), bit_index, string_length or size)
            return area, {"value": value, "raw_bytes_hex": payload.hex()}
        return area, {"raw_bytes_hex": payload.hex()}

    @server.tool()
    async def read_multiple_vars(variables: List[Dict[str, Any]], ctx: Context) -> Dict[str, Any]:
        """Batch read multiple descriptors."""
        results = []
        for spec in variables:
            try:
                area, data = await _read_single_var(ctx, spec)
                results.append({"area": area, "spec": spec, "data": data, "success": True})
            except Exception as exc:
                results.append({"area": spec.get("area"), "spec": spec, "success": False, "error": str(exc)})
        return _ok(data={"results": results})

    async def _write_single_var(ctx: Context, spec: Dict[str, Any]) -> Dict[str, Any]:
        area = _area_from_spec(spec)
        value = spec.get("value")
        dtype = spec.get("data_type")
        bit_index = spec.get("bit") or spec.get("bit_index")
        string_length = spec.get("string_length")
        size = spec.get("size")
        payload = _coerce_payload(value, dtype, size, bit_index, string_length)
        if area == "db":
            db_number = int(spec.get("db_number", 1))
            offset = int(spec.get("offset", 0))
            await _client(ctx).write_db(db_number, offset, payload)
            return {"area": "db", "db_number": db_number, "offset": offset, "written_bytes": len(payload)}
        start_byte = int(spec.get("byte", spec.get("start_byte", 0)))
        await _client(ctx).write_area(area, start_byte, payload)
        return {"area": area, "start_byte": start_byte, "written_bytes": len(payload)}

    @server.tool()
    async def write_multiple_vars(variables: List[Dict[str, Any]], ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_multiple_vars")
        if guard:
            return guard
        results = []
        for spec in variables:
            try:
                entry = await _write_single_var(ctx, spec)
                results.append({"success": True, "entry": entry})
            except Exception as exc:
                results.append({"success": False, "spec": spec, "error": str(exc)})
        return _ok(data={"results": results})

    # -----------------------------
    # Tag map tools
    # -----------------------------

    @server.tool()
    async def list_tags(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001 - ctx for signature parity
        return _ok(data={"tags": resources.tag_map.list()})

    @server.tool()
    async def read_tag(name: str, ctx: Context) -> Dict[str, Any]:
        spec = resources.tag_map.get(name)
        if not spec:
            return _err(f"Unknown tag '{name}'")
        try:
            _, data = await _read_single_var(ctx, spec)
        except Exception as exc:
            return _err(str(exc), {"tag": name})
        data["tag"] = name
        return _ok(data=data)

    @server.tool()
    async def write_tag(name: str, value: Any, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_tag")
        if guard:
            return guard
        spec = resources.tag_map.get(name)
        if not spec:
            return _err(f"Unknown tag '{name}'")
        spec = dict(spec)
        spec["value"] = value
        try:
            entry = await _write_single_var(ctx, spec)
        except Exception as exc:
            return _err(str(exc), {"tag": name})
        entry["tag"] = name
        return _ok(data=entry)

    # -----------------------------
    # Health & diagnostics
    # -----------------------------

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        client = _client(ctx)
        return _ok(
            data={
                "connection": client.connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "system_cmds_enabled": resources.config.system_cmds_enabled,
                "tag_count": len(resources.tag_map),
            }
        )

    @server.tool()
    async def get_connection_status(ctx: Context) -> Dict[str, Any]:
        client = _client(ctx)
        return _ok(data=client.connection_status())


# ------------------------------------------------------------------------------
# Encoding helpers
# ------------------------------------------------------------------------------

DATA_TYPE_BYTES = {
    "BYTE": 1,
    "WORD": 2,
    "DWORD": 4,
    "INT": 2,
    "DINT": 4,
    "REAL": 4,
    "BOOL": 1,
}


def _normalize_dtype(dtype: str) -> str:
    if not dtype:
        raise ValueError("data_type is required")
    return dtype.strip().upper()


def _calc_size(dtype: str, explicit_size: Optional[int], string_length: Optional[int]) -> int:
    if dtype == "STRING":
        if string_length:
            return int(string_length)
        if explicit_size:
            return int(explicit_size)
        raise ValueError("STRING types require string_length or size parameter")
    size = DATA_TYPE_BYTES.get(dtype)
    if not size:
        raise ValueError(f"Unsupported data_type '{dtype}'")
    return size


def _decode_typed(
    payload: bytes,
    dtype: str,
    bit_index: Optional[int],
    string_length: Optional[int],
) -> Any:
    if dtype == "BOOL":
        if bit_index is None:
            bit_index = 0
        mask = 1 << int(bit_index)
        return bool(payload[0] & mask)
    if dtype == "BYTE":
        return payload[0]
    if dtype == "WORD":
        return int.from_bytes(payload[:2], "big", signed=False)
    if dtype == "DWORD":
        return int.from_bytes(payload[:4], "big", signed=False)
    if dtype == "INT":
        return int.from_bytes(payload[:2], "big", signed=True)
    if dtype == "DINT":
        return int.from_bytes(payload[:4], "big", signed=True)
    if dtype == "REAL":
        return struct.unpack(">f", payload[:4])[0]
    if dtype == "STRING":
        length = string_length or len(payload)
        return payload[:length].split(b"\x00", 1)[0].decode("latin1", errors="ignore")
    raise ValueError(f"Unsupported data_type '{dtype}'")


def _encode_typed(
    value: Any,
    dtype: str,
    bit_index: Optional[int],
    string_length: Optional[int],
    explicit_size: Optional[int],
) -> bytes:
    if dtype == "BOOL":
        idx = int(bit_index or 0)
        mask = 1 << idx
        return bytes([mask if bool(value) else 0])
    if dtype == "BYTE":
        return int(value).to_bytes(1, "big", signed=False)
    if dtype == "WORD":
        return int(value).to_bytes(2, "big", signed=False)
    if dtype == "DWORD":
        return int(value).to_bytes(4, "big", signed=False)
    if dtype == "INT":
        return int(value).to_bytes(2, "big", signed=True)
    if dtype == "DINT":
        return int(value).to_bytes(4, "big", signed=True)
    if dtype == "REAL":
        return struct.pack(">f", float(value))
    if dtype == "STRING":
        text = str(value)
        length = string_length or explicit_size or len(text)
        encoded = text.encode("latin1")
        padded = encoded[:length].ljust(length, b"\x00")
        return padded
    raise ValueError(f"Unsupported data_type '{dtype}'")


def _coerce_payload(
    value: Any,
    data_type: Optional[str],
    size: Optional[int],
    bit_index: Optional[int],
    string_length: Optional[int],
) -> bytes:
    if data_type:
        dtype = _normalize_dtype(data_type)
        return _encode_typed(value, dtype, bit_index, string_length, size)
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    if isinstance(value, str):
        stripped = value.replace(" ", "")
        try:
            return bytes.fromhex(stripped)
        except ValueError as exc:
            raise ValueError("String payloads must be hex-encoded when data_type is omitted") from exc
    if isinstance(value, list):
        return bytes(int(v) & 0xFF for v in value)
    raise ValueError("Unsupported value type for raw payload. Provide data_type or hex/list payload.")
