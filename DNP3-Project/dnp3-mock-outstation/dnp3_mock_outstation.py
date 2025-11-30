"""JSON-based DNP3 mock outstation."""

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
    host: str = env("127.0.0.1", "MOCK_DNP3_HOST")
    port: int = int(env("7300", "MOCK_DNP3_PORT"))
    update_interval: float = float(env("1.0", "MOCK_DNP3_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_DNP3_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class PointDatabase:
    binary_inputs: Dict[int, bool] = field(default_factory=lambda: {i: bool(i % 2) for i in range(16)})
    analog_inputs: Dict[int, float] = field(default_factory=lambda: {i: float(i) for i in range(8)})
    binary_outputs: Dict[int, bool] = field(default_factory=dict)


class DNP3MockOutstation:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.db = PointDatabase()
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]DNP3 mock outstation listening on {addr}[/bold green]")
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
                self.db.analog_inputs[idx] += random.uniform(-0.5, 0.5)
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
        if op == "read" and request.get("type") == "binary":
            start = int(request.get("start", 0))
            count = int(request.get("count", 1))
            points = [
                {"index": start + i, "value": bool(self.db.binary_inputs.get(start + i, False)), "quality": "ONLINE"}
                for i in range(count)
            ]
            return {"success": True, "data": {"points": points}}
        if op == "read" and request.get("type") == "analog":
            start = int(request.get("start", 0))
            count = int(request.get("count", 1))
            points = [
                {"index": start + i, "value": float(self.db.analog_inputs.get(start + i, 0.0)), "quality": "ONLINE"}
                for i in range(count)
            ]
            return {"success": True, "data": {"points": points}}
        if op == "write_binary":
            index = int(request.get("index", 0))
            value = bool(request.get("value", False))
            self.db.binary_outputs[index] = value
            return {"success": True, "data": {"index": index, "value": value}}
        if op == "poll_class":
            klass = int(request.get("class", 1))
            return {"success": True, "data": {"class": klass, "events": []}}
        return {"success": False, "error": f"Unknown op '{op}'"}

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock DNP3 outstation (JSON bridge).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_DNP3_HOST"))
    parser.add_argument("--port", type=int, default=int(env("7300", "MOCK_DNP3_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.0", "MOCK_DNP3_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_DNP3_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = DNP3MockOutstation(config)
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
    console.print("\n[red]Stopping DNP3 mock outstation...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
