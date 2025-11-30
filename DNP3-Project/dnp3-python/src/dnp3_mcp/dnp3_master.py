"""DNP3 master wrapper built on pydnp3 (scaffold).

For now, the implementation degrades gracefully to a mock backend when
`pydnp3` is not installed, so the MCP server can run with synthetic data
only.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio

try:
    from pydnp3 import opendnp3  # type: ignore
except Exception:  # pragma: no cover - optional dependency guard
    opendnp3 = None


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class DNP3Config:
    connection_type: str = os.getenv("DNP3_CONNECTION_TYPE", "tcp")
    host: str = os.getenv("DNP3_HOST", "127.0.0.1")
    port: int = int(os.getenv("DNP3_PORT", "20000"))
    serial_port: str = os.getenv("DNP3_SERIAL_PORT", "/dev/ttyUSB0")
    master_address: int = int(os.getenv("DNP3_MASTER_ADDRESS", "1"))
    local_address: int = int(os.getenv("DNP3_LOCAL_ADDRESS", "1"))
    timeout_ms: int = int(os.getenv("DNP3_TIMEOUT", "5000"))
    max_retries: int = int(os.getenv("DNP3_MAX_RETRIES", "3"))
    writes_enabled: bool = _env_bool("DNP3_WRITES_ENABLED", True)


class DNP3MasterError(RuntimeError):
    """Raised when DNP3 operations fail."""


class DNP3Master:
    """Async-friendly facade for DNP3 master operations."""

    def __init__(self, config: Optional[DNP3Config] = None) -> None:
        self.config = config or DNP3Config()
        self._lock = threading.RLock()
        self._manager = None
        self._channel = None
        self._master = None
        self._opened = False

    async def ensure_open(self) -> None:
        await anyio.to_thread.run_sync(self._open_master)

    async def close(self) -> None:
        await anyio.to_thread.run_sync(self._close_master)

    async def read_binary_inputs(self, outstation: int, start: int, count: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        await self.ensure_open()
        start_time = time.perf_counter()
        # Placeholder: return synthetic data
        points = [
            {"index": start + i, "value": bool((start + i) % 2), "quality": "ONLINE", "timestamp": time.time()}
            for i in range(count)
        ]
        duration = (time.perf_counter() - start_time) * 1000.0
        return points, {"duration_ms": round(duration, 3), "outstation": outstation}

    async def read_analog_inputs(self, outstation: int, start: int, count: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        await self.ensure_open()
        start_time = time.perf_counter()
        points = [
            {"index": start + i, "value": float(start + i), "quality": "ONLINE", "timestamp": time.time()}
            for i in range(count)
        ]
        duration = (time.perf_counter() - start_time) * 1000.0
        return points, {"duration_ms": round(duration, 3), "outstation": outstation}

    async def write_binary_output(self, outstation: int, index: int, value: bool) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise DNP3MasterError("Write operations are disabled by configuration")
        await self.ensure_open()
        start_time = time.perf_counter()
        # Placeholder: no actual CROB is sent
        duration = (time.perf_counter() - start_time) * 1000.0
        return {"duration_ms": round(duration, 3), "outstation": outstation, "index": index, "value": value}

    async def poll_class(self, outstation: int, klass: int) -> Dict[str, Any]:
        await self.ensure_open()
        start_time = time.perf_counter()
        duration = (time.perf_counter() - start_time) * 1000.0
        return {"duration_ms": round(duration, 3), "outstation": outstation, "class": klass}

    def connection_status(self) -> Dict[str, Any]:
        return {
            "connection_type": self.config.connection_type,
            "host": self.config.host,
            "port": self.config.port,
            "serial_port": self.config.serial_port,
            "master_address": self.config.master_address,
            "writes_enabled": self.config.writes_enabled,
        }

    # -----------------------------
    # Internal helpers
    # -----------------------------

    def _open_master(self) -> None:
        with self._lock:
            if self._opened:
                return
            if opendnp3 is not None:
                # Real backend: initialize the OpenDNP3 manager.
                self._manager = opendnp3.DNP3Manager(1, opendnp3.ConsoleLogger().Create())
                # For scaffold we avoid real channel creation; fill in later.
            else:
                # Mock backend: no-op manager, synthetic data only.
                self._manager = None
            self._opened = True

    def _close_master(self) -> None:
        with self._lock:
            if not self._opened:
                return
            if self._manager:
                self._manager.Shutdown()
            self._manager = None
            self._channel = None
            self._master = None
            self._opened = False
