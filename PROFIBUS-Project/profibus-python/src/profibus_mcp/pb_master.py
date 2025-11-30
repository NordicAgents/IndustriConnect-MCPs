"""Serial PROFIBUS master wrapper (scaffold)."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio
import serial


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class ProfibusConfig:
    port: str = os.getenv("PROFIBUS_PORT", "/dev/ttyUSB0")
    baudrate: int = int(os.getenv("PROFIBUS_BAUDRATE", "500000"))
    master_address: int = int(os.getenv("PROFIBUS_MASTER_ADDRESS", "2"))
    timeout_ms: int = int(os.getenv("PROFIBUS_TIMEOUT", "1000"))
    max_retries: int = int(os.getenv("PROFIBUS_MAX_RETRIES", "3"))
    retry_backoff_base: float = float(os.getenv("PROFIBUS_RETRY_BACKOFF_BASE", "0.1"))
    writes_enabled: bool = _env_bool("PROFIBUS_WRITES_ENABLED", True)
    config_cmds_enabled: bool = _env_bool("PROFIBUS_CONFIG_CMDS_ENABLED", False)
    mock_mode: bool = _env_bool("PROFIBUS_MOCK", False)

    def __post_init__(self) -> None:
        # Allow a simple sentinel to enable mock mode without touching PROFIBUS_MOCK
        # e.g. PROFIBUS_PORT=mock
        if self.port.strip().lower() in {"mock", "none"}:
            object.__setattr__(self, "mock_mode", True)


class ProfibusMasterError(RuntimeError):
    """Raised when PROFIBUS operations fail."""


class ProfibusMaster:
    """Simple serial wrapper that mimics PROFIBUS master behavior."""

    def __init__(self, config: Optional[ProfibusConfig] = None) -> None:
        self.config = config or ProfibusConfig()
        self._lock = threading.RLock()
        self._serial: Optional[serial.Serial] = None
        self._slaves: Dict[int, Dict[str, Any]] = {}

    async def ensure_open(self) -> None:
        if self.config.mock_mode:
            return
        await anyio.to_thread.run_sync(self._open_port)

    async def close(self) -> None:
        if self.config.mock_mode:
            return
        await anyio.to_thread.run_sync(self._close_port)

    async def scan_bus(self) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        # Placeholder: generate a mock slave list
        with self._lock:
            if not self._slaves:
                self._slaves = {
                    5: {
                        "address": 5,
                        "ident_number": "0x809C",
                        "status": "OK",
                        "manufacturer": "SampleVendor",
                        "input_length": 4,
                        "output_length": 2,
                    }
                }
            devices = list(self._slaves.values())
        duration = (time.perf_counter() - start) * 1000.0
        return devices, {"duration_ms": round(duration, 3), "count": len(devices)}

    async def read_inputs(self, address: int, length: int) -> Tuple[bytes, Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        payload = bytes([0] * length)
        duration = (time.perf_counter() - start) * 1000.0
        return payload, {"duration_ms": round(duration, 3), "slave_address": address}

    async def write_outputs(self, address: int, data: bytes) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise ProfibusMasterError("Writes are disabled by configuration")
        await self.ensure_open()
        start = time.perf_counter()
        duration = (time.perf_counter() - start) * 1000.0
        return {"duration_ms": round(duration, 3), "slave_address": address, "written_bytes": len(data)}

    async def read_diagnosis(self, address: int) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        diag = {
            "address": address,
            "status": "OK",
            "master_address": self.config.master_address,
        }
        duration = (time.perf_counter() - start) * 1000.0
        return diag, {"duration_ms": round(duration, 3), "slave_address": address}

    def connection_status(self) -> Dict[str, Any]:
        return {
            "port": self.config.port,
            "baudrate": self.config.baudrate,
            "master_address": self.config.master_address,
            "writes_enabled": self.config.writes_enabled,
            "config_cmds_enabled": self.config.config_cmds_enabled,
        }

    # -----------------------------
    # Internal helpers
    # -----------------------------

    def _open_port(self) -> None:
        if self.config.mock_mode:
            return
        with self._lock:
            if self._serial and self._serial.is_open:
                return
            try:
                self._serial = serial.Serial(
                    port=self.config.port,
                    baudrate=self.config.baudrate,
                    timeout=self.config.timeout_ms / 1000.0,
                )
            except Exception as exc:
                raise ProfibusMasterError(f"Failed to open serial port {self.config.port}: {exc}") from exc

    def _close_port(self) -> None:
        if self.config.mock_mode:
            return
        with self._lock:
            if self._serial and self._serial.is_open:
                self._serial.close()
            self._serial = None
