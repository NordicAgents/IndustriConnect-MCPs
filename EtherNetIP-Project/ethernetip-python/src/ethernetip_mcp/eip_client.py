"""Thread-safe wrapper around pycomm3's LogixDriver."""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

import anyio

try:
    from pycomm3 import LogixDriver  # type: ignore
except ImportError:  # pragma: no cover - runtime guard
    LogixDriver = None

OperationMeta = Dict[str, Any]
OperationResult = Tuple[Any, OperationMeta]
OpCallable = Callable[[Any], Any]


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(slots=True)
class EIPClientConfig:
    host: str = "127.0.0.1"
    port: int = 44818
    slot: int = 0
    path: Optional[str] = None
    json_bridge: bool = False
    timeout: float = 10.0
    max_retries: int = 3
    retry_backoff_base: float = 0.5
    micro800: bool = False
    init_info: bool = True
    cache_tag_list: bool = True
    cache_timeout: int = 3600
    debug: bool = False

    @classmethod
    def from_env(cls) -> "EIPClientConfig":
        return cls(
            host=os.getenv("ENIP_HOST", "127.0.0.1"),
            port=int(os.getenv("ENIP_PORT", "44818")),
            slot=int(os.getenv("ENIP_SLOT", "0")),
            path=os.getenv("ENIP_PATH"),
            json_bridge=_env_bool("ENIP_JSON_BRIDGE", False),
            timeout=float(os.getenv("ENIP_TIMEOUT", "10")),
            max_retries=int(os.getenv("ENIP_MAX_RETRIES", "3")),
            retry_backoff_base=float(os.getenv("ENIP_RETRY_BACKOFF_BASE", "0.5")),
            micro800=_env_bool("ENIP_MICRO800", False),
            init_info=_env_bool("ENIP_INIT_INFO", True),
            cache_tag_list=_env_bool("ENIP_CACHE_TAG_LIST", True),
            cache_timeout=int(os.getenv("ENIP_CACHE_TIMEOUT", "3600")),
            debug=_env_bool("ENIP_DEBUG", False),
        )


class EIPClientError(RuntimeError):
    """Raised when EtherNet/IP operations fail."""


class EIPClient:
    """Provides asynchronous helpers over pycomm3's synchronous driver."""

    def __init__(self, config: Optional[EIPClientConfig] = None) -> None:
        self.config = config or EIPClientConfig.from_env()
        self._driver: Optional[LogixDriver] = None
        self._lock = threading.RLock()
        self._connected = False
        self._tag_cache: Optional[Tuple[float, Any]] = None

    async def ensure_connection(self) -> None:
        if self.config.json_bridge:
            return
        await anyio.to_thread.run_sync(self._connect_sync)

    async def close(self) -> None:
        await anyio.to_thread.run_sync(self._disconnect_sync)

    # -----------------------------
    # Public operations
    # -----------------------------

    async def read_tag(self, tag: str, count: Optional[int] = None) -> OperationResult:
        if self.config.json_bridge:
            return await self._json_read_tag(tag, count)
        label = f"read_tag({tag})"
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda driver: driver.read(tag, count=count) if count else driver.read(tag),
        )

    async def write_tag(self, tag: str, value: Any, data_type: Optional[str] = None) -> OperationMeta:
        if self.config.json_bridge:
            return await self._json_write_tag(tag, value, data_type)
        label = f"write_tag({tag})"
        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda driver: driver.write(tag, value, datatype=data_type),
        )
        return meta

    async def get_tag_list(self, program: Optional[str] = None) -> OperationResult:
        if self.config.json_bridge:
            return await self._json_get_tag_list(program)
        label = "get_tag_list" if not program else f"get_tag_list({program})"
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            label,
            lambda driver: driver.get_tag_list(program=program),
        )

    async def get_controller_info(self) -> OperationResult:
        async def _fetch() -> OperationResult:
            def _op(driver: LogixDriver) -> Dict[str, Any]:
                driver_info = driver.info
                return {
                    "name": getattr(driver_info, "name", None),
                    "revision": getattr(driver_info, "revision", None),
                    "serial": getattr(driver_info, "serial", None),
                    "product_code": getattr(driver_info, "product_code", None),
                    "firmware": getattr(driver_info, "revision", None),
                }

            return await anyio.to_thread.run_sync(
                self._execute_with_retry,
                "get_controller_info",
                _op,
            )

        return await _fetch()

    async def get_plc_time(self) -> OperationResult:
        if self.config.json_bridge:
            now = time.time()
            return {"plc_time": now}, {"backend": "json", "operation": "get_plc_time"}
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "get_plc_time",
            lambda driver: driver.get_plc_time(),
        )

    async def set_plc_time(self, timestamp: Optional[Any] = None) -> OperationMeta:
        if self.config.json_bridge:
            return {"backend": "json", "operation": "set_plc_time", "updated": True}
        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "set_plc_time",
            lambda driver: driver.set_plc_time(timestamp),
        )
        return meta

    async def read_multiple_tags(self, tags: list[str]) -> OperationResult:
        if self.config.json_bridge:
            return await self._json_read_multiple_tags(tags)
        return await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "read_multiple_tags",
            lambda driver: driver.read(*tags),
        )

    async def write_multiple_tags(self, payloads: Dict[str, Any]) -> OperationMeta:
        if self.config.json_bridge:
            return await self._json_write_multiple_tags(payloads)
        _, meta = await anyio.to_thread.run_sync(
            self._execute_with_retry,
            "write_multiple_tags",
            lambda driver: driver.write(**payloads),
        )
        return meta

    def connection_status(self) -> Dict[str, Any]:
        return {
            "connected": self._connected,
            "host": self.config.host,
            "port": self.config.port,
            "slot": self.config.slot,
            "path": self.config.path,
            "micro800": self.config.micro800,
        }

    # -----------------------------
    # Internal helpers
    # -----------------------------

    async def _json_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            stream = await anyio.connect_tcp(self.config.host, self.config.port)
        except Exception as exc:
            message = f"JSON bridge connection failed to {self.config.host}:{self.config.port}: {exc}"
            raise EIPClientError(message) from exc
        async with stream:
            try:
                await stream.send(json.dumps(payload).encode("utf-8") + b"\n")
                # Read until newline manually since anyio SocketStream doesn't have receive_until
                raw = b""
                while True:
                    chunk = await stream.receive(65536)
                    if not chunk:
                        break
                    raw += chunk
                    if b"\n" in raw:
                        raw = raw.split(b"\n", 1)[0]
                        break
            except Exception as exc:
                raise EIPClientError(f"JSON bridge I/O error: {exc}") from exc
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception as exc:
            raise EIPClientError(f"JSON bridge decode error: {exc}") from exc

    async def _json_read_tag(self, tag: str, count: Optional[int] = None) -> OperationResult:  # noqa: ARG002 - count reserved for parity
        response = await self._json_request({"op": "read", "tag": tag})
        if not response.get("success"):
            raise EIPClientError(response.get("error") or "Mock server read failed")
        data = response.get("data") or {}
        result = {
            "tag": data.get("tag", tag),
            "value": data.get("value"),
            "type": data.get("data_type"),
            "status": None,
            "error": None,
        }
        meta: OperationMeta = {"backend": "json", "operation": "read_tag", "tag": tag}
        return result, meta

    async def _json_write_tag(self, tag: str, value: Any, data_type: Optional[str]) -> OperationMeta:
        payload: Dict[str, Any] = {"op": "write", "tag": tag, "value": value}
        if data_type:
            payload["data_type"] = data_type
        response = await self._json_request(payload)
        if not response.get("success"):
            raise EIPClientError(response.get("error") or "Mock server write failed")
        meta: OperationMeta = {"backend": "json", "operation": "write_tag", "tag": tag}
        return meta

    async def _json_get_tag_list(self, program: Optional[str] = None) -> OperationResult:  # noqa: ARG002 - program unsupported in mock
        response = await self._json_request({"op": "list"})
        if not response.get("success"):
            raise EIPClientError(response.get("error") or "Mock server list failed")
        data = response.get("data") or []
        meta: OperationMeta = {
            "backend": "json",
            "operation": "get_tag_list",
            "count": len(data),
        }
        return data, meta

    async def _json_read_multiple_tags(self, tags: list[str]) -> OperationResult:
        results = []
        for tag in tags:
            result, _ = await self._json_read_tag(tag)
            results.append(result)
        meta: OperationMeta = {
            "backend": "json",
            "operation": "read_multiple_tags",
            "count": len(results),
        }
        return results, meta

    async def _json_write_multiple_tags(self, payloads: Dict[str, Any]) -> OperationMeta:
        for tag, value in payloads.items():
            await self._json_write_tag(tag, value, None)
        meta: OperationMeta = {
            "backend": "json",
            "operation": "write_multiple_tags",
            "count": len(payloads),
        }
        return meta

    def _ensure_driver(self) -> LogixDriver:
        if LogixDriver is None:  # pragma: no cover - runtime guard
            raise EIPClientError(
                "pycomm3 is not installed. Install pycomm3 to communicate with EtherNet/IP controllers."
            )
        if self._driver is None:
            if self.config.path:
                connection_path = self.config.path
            elif self.config.slot and not self.config.micro800:
                connection_path = f"{self.config.host}/{self.config.slot}"
            else:
                connection_path = self.config.host

            driver_kwargs: Dict[str, Any] = {
                "timeout": self.config.timeout,
            }
            if self.config.port:
                driver_kwargs["port"] = self.config.port
            if self.config.micro800:
                driver_kwargs["micro800"] = True

            self._driver = LogixDriver(connection_path, **driver_kwargs)
        return self._driver

    def _connect_sync(self) -> None:
        with self._lock:
            driver = self._ensure_driver()
            if self._connected:
                return
        attempts = 0
        last_exc: Optional[Exception] = None
        while attempts <= self.config.max_retries:
            attempts += 1
            try:
                with self._lock:
                    driver.open()
                    self._connected = True
                    if self.config.init_info and hasattr(driver, "info"):
                        _ = driver.info
                return
            except Exception as exc:  # pragma: no cover - depends on hardware
                last_exc = exc
                with self._lock:
                    self._connected = False
                if attempts > self.config.max_retries:
                    message = f"Failed to connect to {self.config.host}:{self.config.port} slot={self.config.slot}"
                    raise EIPClientError(message) from exc
                time.sleep(self.config.retry_backoff_base * (2 ** (attempts - 1)))

    def _disconnect_sync(self) -> None:
        with self._lock:
            if self._driver is None:
                return
            try:
                self._driver.close()
            finally:
                self._connected = False

    def _execute_with_retry(self, label: str, operation: OpCallable) -> OperationResult:
        start = time.perf_counter()
        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt <= self.config.max_retries:
            attempt += 1
            try:
                with self._lock:
                    driver = self._ensure_driver()
                    if not self._connected:
                        self._connect_sync()
                    result = operation(driver)
                duration = (time.perf_counter() - start) * 1000.0
                return result, {"attempts": attempt, "duration_ms": round(duration, 3)}
            except Exception as exc:  # pragma: no cover - depends on runtime I/O
                last_exc = exc
                with self._lock:
                    self._connected = False
                if attempt > self.config.max_retries:
                    break
                time.sleep(self.config.retry_backoff_base * (2 ** (attempt - 1)))
        message = f"{label} failed after {attempt} attempts: {last_exc}"
        raise EIPClientError(message) from last_exc
