"""JSON-tunneled EtherNet/IP mock server for rapid iteration."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import signal
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from rich.console import Console
from rich.table import Table

console = Console()


def env(default: str, key: str) -> str:
    return os.getenv(key, default)


@dataclass
class MockConfig:
    host: str = env("127.0.0.1", "MOCK_ENIP_HOST")
    port: int = int(env("5025", "MOCK_ENIP_PORT"))
    update_interval: float = float(env("1.5", "MOCK_ENIP_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_ENIP_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class TagEntry:
    name: str
    value: Any
    data_type: str = "REAL"
    description: Optional[str] = None
    mutable: bool = True


@dataclass
class TagDatabase:
    tags: Dict[str, TagEntry] = field(default_factory=dict)

    def seed_defaults(self) -> None:
        self.tags = {
            "Program:MainProgram.MotorSpeed": TagEntry("Program:MainProgram.MotorSpeed", 1450.0, "REAL", "Motor speed RPM"),
            "Program:MainProgram.MotorTorque": TagEntry("Program:MainProgram.MotorTorque", 38.0, "REAL"),
            "Program:MainProgram.Conveyor_Status.Running": TagEntry(
                "Program:MainProgram.Conveyor_Status.Running", True, "BOOL"
            ),
            "Program:MainProgram.Tank_Levels": TagEntry("Program:MainProgram.Tank_Levels", [32.4, 31.9, 33.1], "REAL[3]"),
            "Program:MainProgram.Alarm_Message": TagEntry("Program:MainProgram.Alarm_Message", "OK", "STRING"),
        }

    def read(self, tag: str) -> TagEntry:
        if tag not in self.tags:
            raise KeyError(f"Unknown tag '{tag}'")
        return self.tags[tag]

    def write(self, tag: str, value: Any) -> TagEntry:
        entry = self.read(tag)
        if not entry.mutable:
            raise ValueError(f"Tag '{tag}' is read-only")
        entry.value = value
        return entry

    def randomize(self) -> None:
        if "Program:MainProgram.MotorSpeed" in self.tags:
            base = 1450.0
            self.tags["Program:MainProgram.MotorSpeed"].value = base + random.uniform(-50, 50)
        if "Program:MainProgram.MotorTorque" in self.tags:
            self.tags["Program:MainProgram.MotorTorque"].value = 35.0 + random.uniform(-5, 5)
        if "Program:MainProgram.Conveyor_Status.Running" in self.tags:
            self.tags["Program:MainProgram.Conveyor_Status.Running"].value = random.random() > 0.3
        if "Program:MainProgram.Tank_Levels" in self.tags:
            self.tags["Program:MainProgram.Tank_Levels"].value = [
                30.0 + random.uniform(-3, 3) for _ in self.tags["Program:MainProgram.Tank_Levels"].value
            ]


class MockEtherNetIPServer:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.tags = TagDatabase()
        self.tags.seed_defaults()
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]EtherNet/IP mock listening on {addr}[/bold green]")
        asyncio.create_task(self._update_loop())

    async def stop(self) -> None:
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _update_loop(self) -> None:
        while self._running:
            await asyncio.sleep(self.config.update_interval)
            self.tags.randomize()
            if self.config.verbose:
                console.print("[cyan]Updated mock telemetry[/cyan]")

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
        if op == "read":
            tag = str(request.get("tag"))
            try:
                entry = self.tags.read(tag)
                return {"success": True, "data": {"tag": tag, "value": entry.value, "data_type": entry.data_type}}
            except Exception as exc:
                return {"success": False, "error": str(exc)}
        if op == "write":
            tag = str(request.get("tag"))
            value = request.get("value")
            try:
                entry = self.tags.write(tag, value)
                return {"success": True, "data": {"tag": tag, "value": entry.value}}
            except Exception as exc:
                return {"success": False, "error": str(exc)}
        if op == "list":
            table = [
                {
                    "tag": entry.name,
                    "value": entry.value,
                    "data_type": entry.data_type,
                    "description": entry.description,
                }
                for entry in self.tags.tags.values()
            ]
            return {"success": True, "data": table}
        return {"success": False, "error": f"Unknown op '{op}'"}

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EtherNet/IP mock PLC (JSON tunnel).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_ENIP_HOST"))
    parser.add_argument("--port", type=int, default=int(env("5025", "MOCK_ENIP_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.5", "MOCK_ENIP_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_ENIP_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = MockEtherNetIPServer(config)
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
    console.print("\n[red]Shutting down mock server...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
