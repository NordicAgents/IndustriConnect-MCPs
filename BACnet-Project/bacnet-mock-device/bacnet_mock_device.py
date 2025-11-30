"""JSON-based BACnet mock device."""

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
    host: str = env("127.0.0.1", "MOCK_BACNET_HOST")
    port: int = int(env("7900", "MOCK_BACNET_PORT"))
    update_interval: float = float(env("1.0", "MOCK_BACNET_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_BACNET_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class ObjectDatabase:
    analog_inputs: Dict[int, float] = field(default_factory=lambda: {1: 72.5, 2: 68.0})
    analog_outputs: Dict[int, float] = field(default_factory=lambda: {1: 50.0})
    binary_values: Dict[int, bool] = field(default_factory=lambda: {1: True})


class BACnetMockDevice:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.db = ObjectDatabase()
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]BACnet mock device listening on {addr}[/bold green]")
        asyncio.create_task(self._update_loop())

    async def stop(self) -> None:
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _update_loop(self) -> None:
        while self._running:
            await asyncio.sleep(self.config.update_interval)
            for idx in self.db.analog_inputs:
                self.db.analog_inputs[idx] += random.uniform(-0.2, 0.2)
            if self.config.verbose:
                console.print("[cyan]Updated mock analog inputs[/cyan]")

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
            return {"success": True, "data": [{"device_id": 12345, "vendor": "MockVendor", "model": "TestController"}]}
        if op == "read":
            obj = request.get("object", "")
            prop = request.get("property", "present-value")
            try:
                otype, inst = obj.split(":")
                inst = int(inst)
            except ValueError:
                return {"success": False, "error": "Invalid object identifier"}
            value = self._read_value(otype, inst, prop)
            if value is None:
                return {"success": False, "error": "Object/property not found"}
            return {"success": True, "data": {"object": obj, "property": prop, "value": value}}
        if op == "write":
            obj = request.get("object", "")
            prop = request.get("property", "present-value")
            value = request.get("value")
            try:
                otype, inst = obj.split(":")
                inst = int(inst)
            except ValueError:
                return {"success": False, "error": "Invalid object identifier"}
            if not self._write_value(otype, inst, prop, value):
                return {"success": False, "error": "Write failed"}
            return {"success": True, "data": {"object": obj, "property": prop, "value": value}}
        return {"success": False, "error": f"Unknown op '{op}'"}

    def _read_value(self, otype: str, inst: int, prop: str) -> Optional[Any]:
        if prop != "present-value":
            return None
        if otype == "analog-input":
            return self.db.analog_inputs.get(inst)
        if otype == "analog-output":
            return self.db.analog_outputs.get(inst)
        if otype == "binary-value":
            return self.db.binary_values.get(inst)
        return None

    def _write_value(self, otype: str, inst: int, prop: str, value: Any) -> bool:
        if prop != "present-value":
            return False
        if otype == "analog-output":
            self.db.analog_outputs[inst] = float(value)
            return True
        if otype == "binary-value":
            self.db.binary_values[inst] = bool(value)
            return True
        return False

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock BACnet device (JSON over TCP).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_BACNET_HOST"))
    parser.add_argument("--port", type=int, default=int(env("7900", "MOCK_BACNET_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.0", "MOCK_BACNET_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_BACNET_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = BACnetMockDevice(config)
    await server.start()

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass

    await stop_event.wait()
    console.print("\n[red]Stopping BACnet mock device...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
