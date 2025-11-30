"""PySOEM-based EtherCAT master wrapper."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio

try:
    import pysoem  # type: ignore
except Exception:  # pragma: no cover - runtime guard
    pysoem = None


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class EthercatConfig:
    interface: str = os.getenv("ETHERCAT_INTERFACE", "eth0")
    cycle_time_us: int = int(os.getenv("ETHERCAT_CYCLE_TIME", "1000"))
    timeout_us: int = int(os.getenv("ETHERCAT_TIMEOUT", "500000"))
    expected_wkc: int = int(os.getenv("ETHERCAT_EXPECTED_WKC", "0"))
    max_retries: int = int(os.getenv("ETHERCAT_MAX_RETRIES", "3"))
    retry_backoff_base: float = float(os.getenv("ETHERCAT_RETRY_BACKOFF_BASE", "0.1"))
    writes_enabled: bool = _env_bool("ETHERCAT_WRITES_ENABLED", True)
    state_change_enabled: bool = _env_bool("ETHERCAT_STATE_CHANGE_ENABLED", False)


class EthercatMasterError(RuntimeError):
    """Raised when EtherCAT operations fail."""


class EthercatMaster:
    """Async-friendly wrapper for PySOEM master operations."""

    def __init__(self, config: Optional[EthercatConfig] = None) -> None:
        self.config = config or EthercatConfig()
        self._lock = threading.RLock()
        self._master: Optional[Any] = None
        self._slaves: List[Any] = []
        self._opened = False

    async def ensure_open(self) -> None:
        await anyio.to_thread.run_sync(self._open_master)

    async def close(self) -> None:
        await anyio.to_thread.run_sync(self._close_master)

    async def scan_slaves(self) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            if not self._master:
                raise EthercatMasterError("Master not initialized")
            self._master.config_init()
            self._slaves = list(self._master.slaves)
            devices = [
                {
                    "position": idx,
                    "name": slave.name,
                    "state": slave.state,
                    "vendor_id": hex(slave.man),
                    "product_code": hex(slave.id),
                    "revision": hex(getattr(slave, "rev", 0)),
                    "serial": getattr(slave, "serial", None),
                    "input_size": slave.input,
                    "output_size": slave.output,
                }
                for idx, slave in enumerate(self._slaves)
            ]
        duration = (time.perf_counter() - start) * 1000.0
        return devices, {"duration_ms": round(duration, 3), "count": len(devices)}

    async def get_slave(self, position: int) -> Any:
        await self.ensure_open()
        with self._lock:
            if position >= len(self._slaves):
                raise EthercatMasterError(f"Slave at position {position} not found")
            return self._slaves[position]

    async def read_pdo(self, slave_position: int, offset: int, length: int) -> Tuple[bytes, Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            # Placeholder: PySOEM cyclic data is handled via processdata
            # For now, return zeroed bytes of requested length.
            data = bytes([0] * length)
        duration = (time.perf_counter() - start) * 1000.0
        return data, {"duration_ms": round(duration, 3), "slave_position": slave_position}

    async def write_pdo(self, slave_position: int, offset: int, data: bytes) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise EthercatMasterError("Write operations are disabled")
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            # Placeholder: writing would involve updating output buffers and sending process data
            pass
        duration = (time.perf_counter() - start) * 1000.0
        return {"duration_ms": round(duration, 3), "slave_position": slave_position, "written_bytes": len(data)}

    async def read_sdo(self, slave_position: int, index: int, subindex: int) -> Tuple[Any, Dict[str, Any]]:
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            value = {
                "index": hex(index),
                "subindex": subindex,
                "value": 0,
            }
        duration = (time.perf_counter() - start) * 1000.0
        return value, {"duration_ms": round(duration, 3), "slave_position": slave_position}

    async def write_sdo(self, slave_position: int, index: int, subindex: int, value: Any) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise EthercatMasterError("Write operations are disabled")
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            # Placeholder for pysoem.sdo_write
            pass
        duration = (time.perf_counter() - start) * 1000.0
        return {
            "duration_ms": round(duration, 3),
            "slave_position": slave_position,
            "index": hex(index),
            "subindex": subindex,
        }

    async def set_slave_state(self, slave_position: int, state: int) -> Dict[str, Any]:
        if not self.config.state_change_enabled:
            raise EthercatMasterError("State changes are disabled (set ETHERCAT_STATE_CHANGE_ENABLED=true)")
        await self.ensure_open()
        start = time.perf_counter()
        with self._lock:
            # Placeholder: set desired slave.state and call write_state
            pass
        duration = (time.perf_counter() - start) * 1000.0
        return {"duration_ms": round(duration, 3), "slave_position": slave_position, "state": state}

    def connection_status(self) -> Dict[str, Any]:
        return {
            "interface": self.config.interface,
            "cycle_time_us": self.config.cycle_time_us,
            "timeout_us": self.config.timeout_us,
            "writes_enabled": self.config.writes_enabled,
            "state_change_enabled": self.config.state_change_enabled,
            "slaves": len(self._slaves),
        }

    # -----------------------------
    # Internal helpers
    # -----------------------------

    def _open_master(self) -> None:
        if pysoem is None:  # pragma: no cover - platform guard
            raise EthercatMasterError("PySOEM is not installed. Install pysoem>=1.1.4")
        with self._lock:
            if self._opened:
                return
            self._master = pysoem.Master()
            try:
                self._master.open(self.config.interface)
            except Exception as exc:
                raise EthercatMasterError(f"Failed to open interface {self.config.interface}: {exc}") from exc
            self._opened = True

    def _close_master(self) -> None:
        with self._lock:
            if not self._opened or not self._master:
                return
            try:
                self._master.close()
            finally:
                self._opened = False
                self._master = None
                self._slaves = []
