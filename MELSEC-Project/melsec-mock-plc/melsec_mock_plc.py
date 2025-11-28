"""JSON-based MELSEC MC mock PLC."""

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
    host: str = env("127.0.0.1", "MOCK_MC_HOST")
    port: int = int(env("8100", "MOCK_MC_PORT"))
    update_interval: float = float(env("1.0", "MOCK_MC_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_MC_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class DeviceMemory:
    words: Dict[int, int] = field(default_factory=lambda: {i: i for i in range(1024)})
    bits: Dict[int, bool] = field(default_factory=lambda: {i: bool(i % 2) for i in range(2048)})


class MCMockPLC:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.mem = DeviceMemory()
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]MELSEC mock PLC listening on {addr}[/bold green]")
        asyncio.create_task(self._update_loop())

    async def stop(self) -> None:
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _update_loop(self) -> None:
        while self._running:
            await asyncio.sleep(self.config.update_interval)
            for addr in self.mem.words.keys():
                self.mem.words[addr] += random.randint(-1, 1)
            if self.config.verbose:
                console.print("[cyan]Updated word memory[/cyan]")

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
            dtype = request.get("device_type", "D")
            start = int(request.get("start_address", 0))
            count = int(request.get("count", 1))
            values = self._read(dtype, start, count)
            if values is None:
                return {"success": False, "error": "Unsupported device type"}
            return {"success": True, "data": {"device_type": dtype, "start_address": start, "values": values}}
        if op == "write":
            dtype = request.get("device_type", "D")
            start = int(request.get("start_address", 0))
            values = request.get("values", [])
            if self._write(dtype, start, values):
                return {"success": True, "data": {"device_type": dtype, "start_address": start, "written": len(values)}}
            return {"success": False, "error": "Write failed"}
        return {"success": False, "error": f"Unknown op '{op}'"}

    def _read(self, device_type: str, start: int, count: int) -> Optional[List[Any]]:
        if device_type.upper() == "D":
            return [self.mem.words.get(start + i, 0) for i in range(count)]
        if device_type.upper() == "M":
            return [self.mem.bits.get(start + i, False) for i in range(count)]
        return None

    def _write(self, device_type: str, start: int, values: List[Any]) -> bool:
        if device_type.upper() == "D":
            for idx, val in enumerate(values):
                self.mem.words[start + idx] = int(val)
            return True
        if device_type.upper() == "M":
            for idx, val in enumerate(values):
                self.mem.bits[start + idx] = bool(val)
            return True
        return False

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock MELSEC PLC (JSON bridge).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_MC_HOST"))
    parser.add_argument("--port", type=int, default=int(env("8100", "MOCK_MC_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.0", "MOCK_MC_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_MC_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = MCMockPLC(config)
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
    console.print("\n[red]Stopping MELSEC mock PLC...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
