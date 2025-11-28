"""Simple JSON-based mock PROFINET device server."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import signal
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from rich.console import Console

console = Console()


def env(default: str, key: str) -> str:
    return os.getenv(key, default)


@dataclass
class MockConfig:
    host: str = env("127.0.0.1", "MOCK_PROFINET_HOST")
    port: int = int(env("5600", "MOCK_PROFINET_PORT"))
    update_interval: float = float(env("1.0", "MOCK_PROFINET_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_PROFINET_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class DeviceTag:
    slot: int
    subslot: int
    length: int
    buffer: bytearray = field(default_factory=lambda: bytearray())


@dataclass
class MockDevice:
    name: str
    mac: str
    ip: str
    vendor: str
    device_type: str
    tags: Dict[str, DeviceTag]


class ProfinetMockServer:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.devices: Dict[str, MockDevice] = {}
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False
        self._seed_devices()

    def _seed_devices(self) -> None:
        self.devices["PN-DEVICE-01"] = MockDevice(
            name="PN-DEVICE-01",
            mac="00:11:22:33:44:55",
            ip="192.168.1.100",
            vendor="MockVendor",
            device_type="IO Device",
            tags={
                "1:1": DeviceTag(slot=1, subslot=1, length=8, buffer=bytearray(b"\x00" * 8)),
                "1:2": DeviceTag(slot=1, subslot=2, length=4, buffer=bytearray(b"\x00" * 4)),
            },
        )

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]PROFINET mock listening on {addr}[/bold green]")
        asyncio.create_task(self._update_loop())

    async def stop(self) -> None:
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _update_loop(self) -> None:
        while self._running:
            await asyncio.sleep(self.config.update_interval)
            for device in self.devices.values():
                for tag in device.tags.values():
                    for idx in range(len(tag.buffer)):
                        tag.buffer[idx] = (tag.buffer[idx] + random.randint(0, 5)) & 0xFF
            if self.config.verbose:
                console.print("[cyan]Updated mock tag values[/cyan]")

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        console.print(f"[yellow]Client connected {peer}[/yellow]")
        try:
            while data := await reader.readline():
                data = data.strip()
                if not data:
                    continue
                try:
                    request = json.loads(data)
                except json.JSONDecodeError:
                    await self._send(writer, {"success": False, "error": "Invalid JSON"})
                    continue
                response = self._dispatch(request)
                await self._send(writer, response)
        finally:
            writer.close()
            await writer.wait_closed()
            console.print(f"[yellow]Client disconnected {peer}[/yellow]")

    def _dispatch(self, request: Dict[str, Any]) -> Dict[str, Any]:
        op = request.get("op")
        if op == "discover":
            return {
                "success": True,
                "data": [
                    {
                        "device_name": device.name,
                        "mac_address": device.mac,
                        "ip_address": device.ip,
                        "vendor": device.vendor,
                        "device_type": device.device_type,
                    }
                    for device in self.devices.values()
                ],
            }
        if op == "read":
            device_name = request.get("device")
            slot = int(request.get("slot", 0))
            subslot = int(request.get("subslot", 0))
            length = int(request.get("length", 1))
            device = self.devices.get(device_name)
            if not device:
                return {"success": False, "error": "Device not found"}
            tag = device.tags.get(f"{slot}:{subslot}")
            if not tag:
                return {"success": False, "error": "Slot/subslot not found"}
            data = bytes(tag.buffer[:length])
            return {"success": True, "data": {"raw_data_hex": data.hex(), "device_name": device_name}}
        if op == "write":
            device_name = request.get("device")
            slot = int(request.get("slot", 0))
            subslot = int(request.get("subslot", 0))
            data = request.get("data", [])
            device = self.devices.get(device_name)
            if not device:
                return {"success": False, "error": "Device not found"}
            tag = device.tags.get(f"{slot}:{subslot}")
            if not tag:
                return {"success": False, "error": "Slot/subslot not found"}
            payload = bytes(int(b) & 0xFF for b in data)
            tag.buffer[: len(payload)] = payload
            return {"success": True, "data": {"written_bytes": len(payload)}}
        return {"success": False, "error": f"Unknown op '{op}'"}

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock PROFINET IO device (JSON bridge).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_PROFINET_HOST"))
    parser.add_argument("--port", type=int, default=int(env("5600", "MOCK_PROFINET_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.0", "MOCK_PROFINET_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_PROFINET_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = ProfinetMockServer(config)
    await server.start()

    loop = asyncio.get_running_loop()
    stop = asyncio.Event()

    def _signal_handler() -> None:
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass

    await stop.wait()
    console.print("\n[red]Stopping PROFINET mock...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
