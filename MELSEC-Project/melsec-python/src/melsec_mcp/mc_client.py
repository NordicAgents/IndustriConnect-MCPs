"""MC Protocol client wrapper leveraging pymcprotocol."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio

try:
    import pymcprotocol  # type: ignore
except Exception:  # pragma: no cover
    pymcprotocol = None


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class MCConfig:
    host: str = os.getenv("MC_HOST", "192.168.1.10")
    port: int = int(os.getenv("MC_PORT", "5007"))
    protocol: str = os.getenv("MC_PROTOCOL_TYPE", "3E")
    timeout: float = float(os.getenv("MC_TIMEOUT", "5"))
    writes_enabled: bool = _env_bool("MC_WRITES_ENABLED", True)


class MCClientError(RuntimeError):
    """Raised when MC protocol operations fail."""


class MCClient:
    """Async-friendly wrapper for MC protocol operations."""

    def __init__(self, config: Optional[MCConfig] = None) -> None:
        self.config = config or MCConfig()
        self._lock = threading.RLock()
        self._client = None
        self._connected = False

    async def ensure_connection(self) -> None:
        await anyio.to_thread.run_sync(self._connect)

    async def close(self) -> None:
        await anyio.to_thread.run_sync(self._disconnect)

    async def read_devices(self, device_type: str, start_address: int, count: int) -> Tuple[List[int], Dict[str, Any]]:
        await self.ensure_connection()
        start = time.perf_counter()
        with self._lock:
            # Placeholder: real call would be self._client.batchread_wordunits
            values = [start_address + i for i in range(count)]
        duration = (time.perf_counter() - start) * 1000.0
        return values, {"duration_ms": round(duration, 3), "device_type": device_type}

    async def write_devices(self, device_type: str, start_address: int, values: List[int]) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise MCClientError("Write operations are disabled by configuration")
        await self.ensure_connection()
        start = time.perf_counter()
        with self._lock:
            # Placeholder for batchwrite
            pass
        duration = (time.perf_counter() - start) * 1000.0
        return {"duration_ms": round(duration, 3), "device_type": device_type, "written": len(values)}

    def connection_status(self) -> Dict[str, Any]:
        return {
            "host": self.config.host,
            "port": self.config.port,
            "protocol": self.config.protocol,
            "writes_enabled": self.config.writes_enabled,
        }

    def _connect(self) -> None:
        if pymcprotocol is None:  # pragma: no cover
            raise MCClientError("pymcprotocol is not installed")
        with self._lock:
            if self._connected:
                return
            self._client = pymcprotocol.Type3E(self.config.host, self.config.port)
            self._client.connect()
            self._connected = True

    def _disconnect(self) -> None:
        with self._lock:
            if not self._connected:
                return
            if self._client:
                self._client.close()
            self._client = None
            self._connected = False
