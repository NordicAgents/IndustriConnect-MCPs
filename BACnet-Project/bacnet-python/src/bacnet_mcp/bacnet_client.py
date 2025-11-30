"""BACnet client wrapper built on BAC0 (scaffold)."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio

try:
    import BAC0  # type: ignore
except Exception:  # pragma: no cover - optional dependency guard
    BAC0 = None


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class BACnetConfig:
    interface: str = os.getenv("BACNET_INTERFACE", "0.0.0.0")
    port: int = int(os.getenv("BACNET_PORT", "47808"))
    device_instance: int = int(os.getenv("BACNET_DEVICE_INSTANCE", "1234"))
    writes_enabled: bool = _env_bool("BACNET_WRITES_ENABLED", True)


class BACnetClientError(RuntimeError):
    """Raised when BACnet operations fail."""


class BACnetClient:
    """Thread-safe wrapper around BAC0 for MCP tools."""

    def __init__(self, config: Optional[BACnetConfig] = None) -> None:
        self.config = config or BACnetConfig()
        self._lock = threading.RLock()
        self._bacnet = None
        self._opened = False

    async def ensure_open(self) -> None:
        if not self._opened:
            self._open_client()

    async def close(self) -> None:
        if self._opened:
            self._close_client()

    async def discover_devices(self, timeout_ms: int = 5000) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            devices = [
                {"device_id": 12345, "vendor": "SampleVendor", "model": "MockController", "description": "Sample BACnet device"}
            ]
        duration = (time.perf_counter() - start) * 1000.0
        return devices, {"duration_ms": round(duration, 3), "count": len(devices)}

    async def read_property(
        self,
        device_id: int,
        object_type: str,
        object_instance: int,
        property_id: str,
    ) -> Tuple[Any, Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        value = 72.5  # placeholder measurement
        duration = (time.perf_counter() - start) * 1000.0
        return value, {"duration_ms": round(duration, 3), "device_id": device_id}

    async def write_property(
        self,
        device_id: int,
        object_type: str,
        object_instance: int,
        property_id: str,
        value: Any,
        priority: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise BACnetClientError("Write operations are disabled by configuration")
        await self.ensure_open()
        start = time.perf_counter()
        duration = (time.perf_counter() - start) * 1000.0
        return {
            "duration_ms": round(duration, 3),
            "device_id": device_id,
            "priority": priority,
        }

    def connection_status(self) -> Dict[str, Any]:
        return {
            "interface": self.config.interface,
            "port": self.config.port,
            "device_instance": self.config.device_instance,
            "writes_enabled": self.config.writes_enabled,
        }

    def _open_client(self) -> None:
        if BAC0 is None:  # pragma: no cover
            raise BACnetClientError("BAC0 is not installed. Install BAC0>=23.9.1")
        with self._lock:
            if self._opened:
                return
            self._bacnet = BAC0.connect(
                ip=self.config.interface,
                port=self.config.port,
                deviceId=self.config.device_instance,
            )
            self._opened = True

    def _close_client(self) -> None:
        with self._lock:
            if not self._opened:
                return
            if self._bacnet:
                self._bacnet.disconnect()
            self._bacnet = None
            self._opened = False
