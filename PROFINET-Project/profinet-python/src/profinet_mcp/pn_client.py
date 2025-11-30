"""High-level PROFINET helper built on Scapy/raw sockets (scaffold)."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import anyio

try:
    from scapy.all import Ether  # type: ignore
except Exception:  # pragma: no cover - scapy optional for scaffold
    Ether = None


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "t", "yes", "on"}


@dataclass(slots=True)
class ProfinetConfig:
    interface: str = os.getenv("PROFINET_INTERFACE", "eth0")
    controller_ip: str = os.getenv("PROFINET_CONTROLLER_IP", "192.168.1.1")
    network_cidr: str = os.getenv("PROFINET_NETWORK", "192.168.1.0/24")
    dcp_port: int = int(os.getenv("PROFINET_DCP_PORT", "34964"))
    dcp_timeout: float = float(os.getenv("PROFINET_DCP_TIMEOUT", "5"))
    timeout: float = float(os.getenv("PROFINET_TIMEOUT", "10"))
    max_retries: int = int(os.getenv("PROFINET_MAX_RETRIES", "3"))
    retry_backoff_base: float = float(os.getenv("PROFINET_RETRY_BACKOFF_BASE", "0.5"))
    writes_enabled: bool = _env_bool("PROFINET_WRITES_ENABLED", True)
    config_cmds_enabled: bool = _env_bool("PROFINET_CONFIG_CMDS_ENABLED", False)


class ProfinetClientError(RuntimeError):
    """Raised when PROFINET operations fail."""


class ProfinetClient:
    """Async-friendly facade for PROFINET DCP/IO helpers."""

    def __init__(self, config: Optional[ProfinetConfig] = None) -> None:
        self.config = config or ProfinetConfig()
        self._lock = threading.RLock()
        self._devices: Dict[str, Dict[str, Any]] = {}

    async def discover_devices(self, timeout: Optional[float] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Perform PROFINET DCP discovery (placeholder implementation)."""
        await anyio.to_thread.run_sync(self._require_scapy)
        max_wait = timeout or self.config.dcp_timeout
        start = time.perf_counter()
        # TODO: send DCP identify and parse responses
        # For now return cached entries (if manual) or sample stub
        devices = list(self._devices.values()) or [
            {
                "device_name": "PN-DEVICE-01",
                "mac_address": "00:11:22:33:44:55",
                "ip_address": "192.168.1.100",
                "vendor": "SampleVendor",
                "device_type": "IO Device",
            }
        ]
        duration = (time.perf_counter() - start) * 1000.0
        return devices, {"duration_ms": round(duration, 3), "timeout": max_wait}

    async def read_io_data(self, device_name: str, slot: int, subslot: int, length: int) -> Tuple[bytes, Dict[str, Any]]:
        """Placeholder I/O read."""
        start = time.perf_counter()
        # TODO: implement cyclic/acyclic read via PROFINET services
        payload = bytes([0] * length)
        duration = (time.perf_counter() - start) * 1000.0
        return payload, {"duration_ms": round(duration, 3), "device_name": device_name, "slot": slot, "subslot": subslot}

    async def write_io_data(self, device_name: str, slot: int, subslot: int, data: bytes) -> Dict[str, Any]:
        if not self.config.writes_enabled:
            raise ProfinetClientError("Writes are disabled by configuration")
        start = time.perf_counter()
        # TODO: implement actual write via PROFINET services
        duration = (time.perf_counter() - start) * 1000.0
        return {"duration_ms": round(duration, 3), "device_name": device_name, "written_bytes": len(data)}

    async def set_device_name(self, device_mac: str, name: str) -> Dict[str, Any]:
        if not self.config.config_cmds_enabled:
            raise ProfinetClientError("Configuration commands are disabled (set PROFINET_CONFIG_CMDS_ENABLED=true)")
        start = time.perf_counter()
        # TODO: send DCP Set request
        duration = (time.perf_counter() - start) * 1000.0
        return {"device_mac": device_mac, "name": name, "duration_ms": round(duration, 3)}

    async def set_device_ip(self, device_mac: str, ip: str, subnet: str, gateway: Optional[str]) -> Dict[str, Any]:
        if not self.config.config_cmds_enabled:
            raise ProfinetClientError("Configuration commands are disabled")
        start = time.perf_counter()
        # TODO: send DCP Set IP
        duration = (time.perf_counter() - start) * 1000.0
        return {"device_mac": device_mac, "ip": ip, "duration_ms": round(duration, 3)}

    async def identify_device(self, device_mac: str, duration_s: int = 5) -> Dict[str, Any]:
        start = time.perf_counter()
        # TODO: send identify LED command
        duration = (time.perf_counter() - start) * 1000.0
        return {"device_mac": device_mac, "duration_ms": round(duration, 3), "identify_duration_s": duration_s}

    def connection_status(self) -> Dict[str, Any]:
        return {
            "interface": self.config.interface,
            "controller_ip": self.config.controller_ip,
            "network": self.config.network_cidr,
            "dcp_port": self.config.dcp_port,
        }

    def _require_scapy(self) -> None:
        if Ether is None:  # pragma: no cover - runtime guard
            raise ProfinetClientError("scapy is required for PROFINET operations. Install scapy>=2.5.0")
