"""EtherNet/IP MCP tool implementations."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .eip_client import EIPClient


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
            writes_enabled=_env_bool("ENIP_WRITES_ENABLED", True),
            system_cmds_enabled=_env_bool("ENIP_SYSTEM_CMDS_ENABLED", False),
            tag_map_path=Path(tag_path).expanduser() if tag_path else None,
        )


class TagMap:
    def __init__(self, path: Optional[Path]) -> None:
        self.path = path
        self._tags: Dict[str, Dict[str, Any]] = {}
        self._mtime: Optional[float] = None
        self.refresh()

    def refresh(self) -> None:
        if not self.path:
            self._tags = {}
            self._mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._tags = {}
            self._mtime = None
            return
        if self._mtime and stat.st_mtime <= self._mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
                if isinstance(data, dict):
                    self._tags = {str(name): spec for name, spec in data.items()}
                    self._mtime = stat.st_mtime
        except Exception:
            self._tags = {}
            self._mtime = stat.st_mtime

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._tags.get(name)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        return [
            {
                "alias": alias,
                "tag": spec.get("tag"),
                "data_type": spec.get("data_type"),
                "description": spec.get("description"),
            }
            for alias, spec in self._tags.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._tags)


@dataclass(slots=True)
class ToolResources:
    client: EIPClient
    config: ToolConfig
    tag_map: TagMap | None = None


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    tag_map = resources.tag_map or TagMap(resources.config.tag_map_path)

    def _client(ctx: Context) -> EIPClient:
        return ctx.request_context.lifespan_context.client

    def _result(success: bool, data: Any = None, error: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {"success": success, "data": data, "error": error, "meta": meta or {}}

    def _ok(data: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(True, data=data, meta=meta)

    def _err(message: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _result(False, error=message, meta=meta)

    def _ensure_writes_allowed(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.writes_enabled:
            return _err("Write operations are disabled by configuration", {"tool": tool})
        return None

    def _ensure_system(tool: str) -> Optional[Dict[str, Any]]:
        if not resources.config.system_cmds_enabled:
            return _err("System commands are disabled (set ENIP_SYSTEM_CMDS_ENABLED=true)", {"tool": tool})
        return None

    def _normalize_tag_result(result: Any) -> Any:
        if isinstance(result, list):
            return [_normalize_tag_result(item) for item in result]
        if hasattr(result, "value"):
            return {
                "tag": getattr(result, "tag", None),
                "value": getattr(result, "value", None),
                "data_type": getattr(result, "type", None),
                "status": getattr(result, "status", None),
                "error": getattr(result, "error", None),
            }
        if isinstance(result, dict) and "value" in result:
            return {
                "tag": result.get("tag"),
                "value": result.get("value"),
                "data_type": result.get("type") or result.get("data_type"),
                "status": result.get("status"),
                "error": result.get("error"),
            }
        return result

    def _apply_scaling(value: Any, spec: Dict[str, Any], direction: str) -> Any:
        scaling = spec.get("scaling")
        if not scaling:
            return value

        def _transform_scalar(val: Any) -> Any:
            try:
                val = float(val)
            except (TypeError, ValueError):
                return val
            raw_min = float(scaling.get("raw_min", 0))
            raw_max = float(scaling.get("raw_max", 1))
            eng_min = float(scaling.get("eng_min", raw_min))
            eng_max = float(scaling.get("eng_max", raw_max))
            if direction == "to_eng":
                span = raw_max - raw_min or 1.0
                ratio = (val - raw_min) / span
                return eng_min + ratio * (eng_max - eng_min)
            span = eng_max - eng_min or 1.0
            ratio = (val - eng_min) / span
            return raw_min + ratio * (raw_max - raw_min)

        if isinstance(value, list):
            return [_transform_scalar(v) for v in value]
        return _transform_scalar(value)

    @server.tool()
    async def read_tag(tag_name: str, ctx: Context, count: Optional[int] = None) -> Dict[str, Any]:
        try:
            result, meta = await _client(ctx).read_tag(tag_name, count)
        except Exception as exc:
            return _err(str(exc), {"tag_name": tag_name})
        return _ok(
            data={"tag": tag_name, "result": _normalize_tag_result(result)},
            meta={**meta, "tag_name": tag_name},
        )

    @server.tool()
    async def write_tag(tag_name: str, value: Any, ctx: Context, data_type: Optional[str] = None) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_tag")
        if guard:
            return guard
        try:
            meta = await _client(ctx).write_tag(tag_name, value, data_type)
        except Exception as exc:
            return _err(str(exc), {"tag_name": tag_name})
        return _ok(data={"tag": tag_name, "written": value}, meta={**meta, "tag_name": tag_name})

    @server.tool()
    async def read_array(tag_name: str, elements: int, ctx: Context) -> Dict[str, Any]:
        return await read_tag(tag_name, ctx, count=elements)

    @server.tool()
    async def write_array(tag_name: str, values: List[Any], ctx: Context) -> Dict[str, Any]:
        return await write_tag(tag_name, values, ctx)

    @server.tool()
    async def read_string(tag_name: str, ctx: Context) -> Dict[str, Any]:
        response = await read_tag(tag_name, ctx)
        if response["success"]:
            payload = response["data"]["result"]
            if isinstance(payload, dict) and "value" in payload:
                payload["value"] = str(payload["value"])
        return response

    @server.tool()
    async def write_string(tag_name: str, value: str, ctx: Context) -> Dict[str, Any]:
        return await write_tag(tag_name, value, ctx)

    @server.tool()
    async def get_tag_list(ctx: Context, program: Optional[str] = None) -> Dict[str, Any]:
        try:
            result, meta = await _client(ctx).get_tag_list(program)
        except Exception as exc:
            return _err(str(exc), {"program": program})
        return _ok(data={"program": program, "tags": result}, meta=meta)

    @server.tool()
    async def read_multiple_tags(tags: List[str], ctx: Context) -> Dict[str, Any]:
        try:
            result, meta = await _client(ctx).read_multiple_tags(tags)
        except Exception as exc:
            return _err(str(exc), {"tags": tags})
        return _ok(data={"results": _normalize_tag_result(result)}, meta={**meta, "count": len(tags)})

    @server.tool()
    async def write_multiple_tags(payloads: List[Dict[str, Any]], ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_multiple_tags")
        if guard:
            return guard
        values = {}
        dtypes = {}
        for item in payloads:
            tag = item.get("tag_name") or item.get("tag")
            if not tag:
                return _err("Each payload requires tag/tag_name")
            values[tag] = item.get("value")
            if item.get("data_type"):
                dtypes[tag] = item["data_type"]
        try:
            meta = await _client(ctx).write_multiple_tags({k: v for k, v in values.items()})
        except Exception as exc:
            return _err(str(exc))
        return _ok(
            data={"written": [{"tag": tag, "value": values[tag], "data_type": dtypes.get(tag)} for tag in values]},
            meta={**meta, "count": len(values)},
        )

    @server.tool()
    async def list_tags(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001 - ctx required by signature
        return _ok(data={"aliases": tag_map.list(), "count": tag_map.count()})

    @server.tool()
    async def read_tag_by_alias(alias: str, ctx: Context) -> Dict[str, Any]:
        spec = tag_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        tag_name = spec.get("tag")
        if not tag_name:
            return _err(f"Alias '{alias}' is missing 'tag' field")
        response = await read_tag(tag_name, ctx)
        if response["success"]:
            result = response["data"]["result"]
            value = result.get("value") if isinstance(result, dict) else result
            scaled = _apply_scaling(value, spec, "to_eng")
            if isinstance(result, dict):
                result["value"] = scaled
            else:
                response["data"]["result"] = scaled
            response["data"]["alias"] = alias
        return response

    @server.tool()
    async def write_tag_by_alias(alias: str, value: Any, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes_allowed("write_tag_by_alias")
        if guard:
            return guard
        spec = tag_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        tag_name = spec.get("tag")
        if not tag_name:
            return _err(f"Alias '{alias}' is missing 'tag' field")
        scaled = _apply_scaling(value, spec, "to_raw")
        return await write_tag(tag_name, scaled, ctx, data_type=spec.get("data_type"))

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        client = _client(ctx)
        return _ok(
            data={
                "connection": client.connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "system_cmds_enabled": resources.config.system_cmds_enabled,
                "tag_aliases": tag_map.count(),
            }
        )

    @server.tool()
    async def get_connection_status(ctx: Context) -> Dict[str, Any]:
        return _ok(data=_client(ctx).connection_status())

    @server.tool()
    async def get_plc_info(ctx: Context) -> Dict[str, Any]:
        try:
            info, meta = await _client(ctx).get_controller_info()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data=info, meta=meta)

    @server.tool()
    async def get_plc_time(ctx: Context) -> Dict[str, Any]:
        try:
            timestamp, meta = await _client(ctx).get_plc_time()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"plc_time": timestamp}, meta=meta)

    @server.tool()
    async def set_plc_time(ctx: Context) -> Dict[str, Any]:
        guard = _ensure_system("set_plc_time")
        if guard:
            return guard
        try:
            meta = await _client(ctx).set_plc_time()
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"updated": True}, meta=meta)
