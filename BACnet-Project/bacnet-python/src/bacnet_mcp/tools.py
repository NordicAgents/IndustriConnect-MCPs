"""BACnet MCP tool implementations."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import Context, FastMCP

from .bacnet_client import BACnetClient


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ToolConfig:
    writes_enabled: bool = True
    object_map_path: Optional[Path] = None

    @classmethod
    def from_env(cls) -> "ToolConfig":
        map_path = os.getenv("OBJECT_MAP_FILE")
        return cls(
            writes_enabled=_env_bool("BACNET_WRITES_ENABLED", True),
            object_map_path=Path(map_path).expanduser() if map_path else None,
        )


class ObjectMap:
    def __init__(self, path: Optional[Path]) -> None:
        self.path = path
        self._objects: Dict[str, Dict[str, Any]] = {}
        self._mtime: Optional[float] = None
        self.refresh()

    def refresh(self) -> None:
        if not self.path:
            self._objects = {}
            self._mtime = None
            return
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self._objects = {}
            self._mtime = None
            return
        if self._mtime and stat.st_mtime <= self._mtime:
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                self._objects = {str(alias): spec for alias, spec in data.items()}
                self._mtime = stat.st_mtime
        except Exception:
            self._objects = {}
            self._mtime = stat.st_mtime

    def get(self, alias: str) -> Optional[Dict[str, Any]]:
        self.refresh()
        return self._objects.get(alias)

    def list(self) -> List[Dict[str, Any]]:
        self.refresh()
        return [
            {
                "alias": alias,
                "device": spec.get("device"),
                "object_type": spec.get("object_type"),
                "object_instance": spec.get("object_instance"),
                "description": spec.get("description"),
            }
            for alias, spec in self._objects.items()
        ]

    def count(self) -> int:
        self.refresh()
        return len(self._objects)


@dataclass(slots=True)
class ToolResources:
    client: BACnetClient
    config: ToolConfig
    object_map: ObjectMap


def register_tools(server: FastMCP, resources: ToolResources) -> None:
    def _client(ctx: Context) -> BACnetClient:
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
    async def discover_devices(ctx: Context, timeout_ms: int = 5000) -> Dict[str, Any]:
        try:
            devices, meta = await _client(ctx).discover_devices(timeout_ms)
        except Exception as exc:
            return _err(str(exc))
        return _ok(data={"devices": devices}, meta=meta)

    @server.tool()
    async def read_property(
        device_id: int,
        object_type: str,
        object_instance: int,
        property_id: str,
        ctx: Context,
    ) -> Dict[str, Any]:
        try:
            value, meta = await _client(ctx).read_property(device_id, object_type, object_instance, property_id)
        except Exception as exc:
            return _err(str(exc), {"device_id": device_id})
        return _ok(
            data={
                "device": device_id,
                "object_type": object_type,
                "object_instance": object_instance,
                "property_id": property_id,
                "value": value,
            },
            meta=meta,
        )

    @server.tool()
    async def write_property(
        device_id: int,
        object_type: str,
        object_instance: int,
        property_id: str,
        value: Any,
        ctx: Context,
        priority: Optional[int] = None,
    ) -> Dict[str, Any]:
        guard = _ensure_writes("write_property")
        if guard:
            return guard
        try:
            meta = await _client(ctx).write_property(device_id, object_type, object_instance, property_id, value, priority)
        except Exception as exc:
            return _err(str(exc), {"device_id": device_id})
        return _ok(
            data={
                "device": device_id,
                "object_type": object_type,
                "object_instance": object_instance,
                "property_id": property_id,
                "value": value,
                "priority": priority,
            },
            meta=meta,
        )

    @server.tool()
    async def list_objects(ctx: Context) -> Dict[str, Any]:  # noqa: ARG001
        return _ok(data={"objects": resources.object_map.list(), "count": resources.object_map.count()})

    @server.tool()
    async def read_object_by_alias(alias: str, ctx: Context) -> Dict[str, Any]:
        spec = resources.object_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        return await read_property(
            spec.get("device", 0),
            spec.get("object_type", "analog-input"),
            spec.get("object_instance", 0),
            spec.get("property_id", "present-value"),
            ctx,
        )

    @server.tool()
    async def write_object_by_alias(alias: str, value: Any, ctx: Context) -> Dict[str, Any]:
        guard = _ensure_writes("write_object_by_alias")
        if guard:
            return guard
        spec = resources.object_map.get(alias)
        if not spec:
            return _err(f"Unknown alias '{alias}'")
        return await write_property(
            spec.get("device", 0),
            spec.get("object_type", "analog-output"),
            spec.get("object_instance", 0),
            spec.get("property_id", "present-value"),
            value,
            ctx,
            spec.get("priority"),
        )

    @server.tool()
    async def ping(ctx: Context) -> Dict[str, Any]:
        return _ok(
            data={
                "connection": _client(ctx).connection_status(),
                "writes_enabled": resources.config.writes_enabled,
                "object_aliases": resources.object_map.count(),
            }
        )
