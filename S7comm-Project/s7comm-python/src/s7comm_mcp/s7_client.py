"""Lightweight wrapper around python-snap7 with retry and metadata helpers."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

import anyio

try:
    import snap7  # type: ignore
except ImportError:  # pragma: no cover - import failure handled at runtime
    snap7 = None


OperationMeta = Dict[str, Any]
OperationResult = Tuple[Any, OperationMeta]
OpCallable = Callable[[Any], Any]


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class S7ClientConfig:
    """Runtime configuration for a Snap7 client."""

    host: str = "127.0.0.1"
    port: int = 102
    rack: int = 0
    slot: int = 2
    connection_type: str = "PG"
    timeout: float = 5.0
    max_retries: int = 3
    retry_backoff_base: float = 0.5
    debug: bool = False

    @classmethod
    def from_env(cls) -> "S7ClientConfig":
        return cls(
            host=os.getenv("S7_HOST", "127.0.0.1"),
            port=int(os.getenv("S7_PORT", "102")),
            rack=int(os.getenv("S7_RACK", "0")),
            slot=int(os.getenv("S7_SLOT", "2")),
            connection_type=os.getenv("S7_CONNECTION_TYPE", "PG"),
            timeout=float(os.getenv("S7_TIMEOUT", "5")),
            max_retries=int(os.getenv("S7_MAX_RETRIES", "3")),
            retry_backoff_base=float(os.getenv("S7_RETRY_BACKOFF_BASE", "0.5")),
            debug=_env_bool("S7_DEBUG", False),
        )


class S7ClientError(RuntimeError):
    """Raised when an S7 operation fails."""


class Snap7NotInstalledError(S7ClientError):
    """Raised if python-snap7 is missing."""


class OperationFailedError(S7ClientError):
    """Raised when an S7 operation fails after retries."""


S7_AREA_CODES = {
    "db": 0x84,
    "input": 0x81,
    "output": 0x82,
    "marker": 0x83,
}


class S7Client:
    """Thread-safe wrapper that surfaces async helpers for MCP tools."""

    def __init__(self, config: Optional[S7ClientConfig] = None) -> None:
        self.config = config or S7ClientConfig.from_env()
        self._client: Any = None
        self._lock = threading.RLock()
        self._connected = False

    async def ensure_connection(self) -> None:
        """Ensure the Snap7 client is connected."""
        await anyio.to_thread.run_sync(self._connect_sync)

    async def close(self) -> None:
        await anyio.to_thread.run_sync(self._disconnect_sync)

    async def read_db(self, db_number: int, start_offset: int, size: int) -> OperationResult:
        if size <= 0:
            raise ValueError("size must be positive")
        label = f"db_read(db={db_number},start={start_offset},size={size})"
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda client: bytes(client.db_read(db_number, start_offset, size)),
        )

    async def write_db(self, db_number: int, start_offset: int, payload: bytes) -> OperationMeta:
        if not payload:
            raise ValueError("payload must not be empty")
        label = f"db_write(db={db_number},start={start_offset},size={len(payload)})"
        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda client: client.db_write(db_number, start_offset, bytearray(payload)),
        )
        return meta

    async def read_area(
        self,
        area: str,
        start: int,
        size: int,
        db_number: int = 0,
    ) -> OperationResult:
        area_code = self._area_code(area)
        label = f"read_area(area={area},start={start},size={size},db={db_number})"
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda client: bytes(client.read_area(area_code, db_number, start, size)),
        )

    async def write_area(
        self,
        area: str,
        start: int,
        payload: bytes,
        db_number: int = 0,
    ) -> OperationMeta:
        area_code = self._area_code(area)
        label = f"write_area(area={area},start={start},size={len(payload)},db={db_number})"
        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda client: client.write_area(area_code, db_number, start, bytearray(payload)),
        )
        return meta

    async def read_plc_info(self) -> OperationResult:
        def _op(client: Any) -> Dict[str, Any]:
            cpu_info = client.get_cpu_info()
            order_code = client.get_order_code()
            return {
                "module_type": getattr(cpu_info, "ModuleTypeName", None),
                "serial_number": getattr(cpu_info, "SerialNumber", None),
                "as_name": getattr(cpu_info, "ASName", None),
                "copyright": getattr(cpu_info, "Copyright", None),
                "order_code": getattr(order_code, "OrderCode", None),
                "version": getattr(order_code, "Version", None),
            }

        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "read_plc_info",
            _op,
        )

    async def read_cpu_state(self) -> OperationResult:
        def _op(client: Any) -> str:
            state = client.get_cpu_state()
            if isinstance(state, str):
                return state
            return str(state)

        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "read_cpu_state",
            _op,
        )

    async def set_cpu_state(self, state: str) -> OperationMeta:
        normalized = state.strip().upper()
        if normalized not in {"RUN", "STOP"}:
            raise ValueError("state must be RUN or STOP")

        def _op(client: Any) -> None:
            if normalized == "RUN":
                # prefer hot start; fall back to cold start if hot start not available
                if hasattr(client, "plc_hot_start"):
                    client.plc_hot_start()
                elif hasattr(client, "plc_cold_start"):
                    client.plc_cold_start()
                else:
                    raise RuntimeError("Snap7 client does not expose start functions")
            else:
                if hasattr(client, "plc_stop"):
                    client.plc_stop()
                else:
                    raise RuntimeError("Snap7 client does not expose stop function")

        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            f"set_cpu_state({normalized})",
            _op,
        )
        return meta

    async def read_system_time(self) -> OperationResult:
        def _op(client: Any) -> str:
            dt = client.get_plc_datetime()
            return dt.isoformat()

        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "read_system_time",
            _op,
        )

    async def read_szl(self, szl_id: int, szl_index: int) -> OperationResult:
        label = f"read_szl(id={szl_id},index={szl_index})"
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda client: client.read_szl(szl_id, szl_index),
        )

    def connection_status(self) -> Dict[str, Any]:
        return {
            "connected": self._connected,
            "host": self.config.host,
            "port": self.config.port,
            "rack": self.config.rack,
            "slot": self.config.slot,
            "connection_type": self.config.connection_type,
        }

    # -----------------------------
    # Internal helpers
    # -----------------------------

    def _area_code(self, area: str) -> int:
        try:
            return S7_AREA_CODES[area.lower()]
        except KeyError:
            raise ValueError(f"Unsupported area '{area}'. Valid areas: {', '.join(S7_AREA_CODES)}")

    def _require_snap7(self) -> None:
        if snap7 is None:  # pragma: no cover - runtime guard
            raise Snap7NotInstalledError(
                "python-snap7 is not installed. Install snap7 system libraries and python-snap7."
            )

    def _connect_sync(self) -> None:
        with self._lock:
            self._require_snap7()
            if self._client is None:
                self._client = snap7.client.Client()
                if hasattr(self._client, "set_timeout"):
                    self._client.set_timeout(int(self.config.timeout * 1000))
            if self._connected:
                return
        attempts = 0
        last_exc: Optional[Exception] = None
        while attempts <= self.config.max_retries:
            attempts += 1
            try:
                with self._lock:
                    self._client.connect(
                        self.config.host,
                        self.config.rack,
                        self.config.slot,
                        tcpport=self.config.port,
                    )
                    self._connected = True
                    return
            except Exception as exc:  # pragma: no cover - depends on runtime environment
                last_exc = exc
                with self._lock:
                    self._connected = False
                if attempts > self.config.max_retries:
                    message = (
                        f"Failed to connect to {self.config.host}:{self.config.port} "
                        f"(rack={self.config.rack}, slot={self.config.slot})"
                    )
                    raise S7ClientError(message) from exc
                time.sleep(self.config.retry_backoff_base * (2 ** (attempts - 1)))

    def _disconnect_sync(self) -> None:
        with self._lock:
            if self._client is None:
                return
            try:
                self._client.disconnect()
            finally:
                self._connected = False

    def _execute_with_retry(self, op_name: str, operation: OpCallable) -> OperationResult:
        self._require_snap7()
        start = time.perf_counter()
        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt <= self.config.max_retries:
            attempt += 1
            try:
                with self._lock:
                    if not self._connected:
                        self._connect_sync()
                    result = operation(self._client)
                duration = (time.perf_counter() - start) * 1000.0
                return result, {"attempts": attempt, "duration_ms": round(duration, 3)}
            except Exception as exc:  # pragma: no cover - I/O heavy
                last_exc = exc
                with self._lock:
                    self._connected = False
                if attempt > self.config.max_retries:
                    break
                time.sleep(self.config.retry_backoff_base * (2 ** (attempt - 1)))
        message = f"{op_name} failed after {attempt} attempts: {last_exc}"
        raise OperationFailedError(message) from last_exc
