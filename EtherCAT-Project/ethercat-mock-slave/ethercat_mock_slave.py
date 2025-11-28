"""JSON-based EtherCAT mock slave."""

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
    host: str = env("127.0.0.1", "MOCK_ETHERCAT_HOST")
    port: int = int(env("6700", "MOCK_ETHERCAT_PORT"))
    update_interval: float = float(env("1.0", "MOCK_ETHERCAT_UPDATE_INTERVAL"))
    verbose: bool = env("false", "MOCK_ETHERCAT_VERBOSE").lower() in {"1", "true", "yes", "on"}


@dataclass
class MockSlave:
    position: int
    name: str
    vendor_id: str
    product_code: str
    revision: str
    state: str = "OP"
    input_buffer: bytearray = field(default_factory=lambda: bytearray(b"\x00" * 8))
    output_buffer: bytearray = field(default_factory=lambda: bytearray(b"\x00" * 8))


class EthercatMockServer:
    def __init__(self, config: MockConfig) -> None:
        self.config = config
        self.slaves: Dict[int, MockSlave] = {
            0: MockSlave(
                position=0,
                name="EK1100",
                vendor_id="0x00000002",
                product_code="0x044C2C52",
                revision="0x00010000",
            )
        }
        self._server: Optional[asyncio.base_events.Server] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._server = await asyncio.start_server(self._handle_client, self.config.host, self.config.port)
        addr = ", ".join(str(sock.getsockname()) for sock in self._server.sockets or [])
        console.print(f"[bold green]EtherCAT mock listening on {addr}[/bold green]")
        asyncio.create_task(self._update_loop())

    async def stop(self) -> None:
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _update_loop(self) -> None:
        while self._running:
            await asyncio.sleep(self.config.update_interval)
            for slave in self.slaves.values():
                for idx in range(len(slave.input_buffer)):
                    slave.input_buffer[idx] = (slave.input_buffer[idx] + random.randint(0, 5)) & 0xFF
            if self.config.verbose:
                console.print("[cyan]Updated mock PDO data[/cyan]")

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
        if op == "scan":
            return {
                "success": True,
                "data": [
                    {
                        "position": slave.position,
                        "name": slave.name,
                        "vendor_id": slave.vendor_id,
                        "product_code": slave.product_code,
                        "revision": slave.revision,
                        "state": slave.state,
                    }
                    for slave in self.slaves.values()
                ],
            }
        if op == "read_pdo":
            pos = int(request.get("position", 0))
            length = int(request.get("length", 1))
            slave = self.slaves.get(pos)
            if not slave:
                return {"success": False, "error": "Slave not found"}
            payload = bytes(slave.input_buffer[:length])
            return {"success": True, "data": {"raw_data_hex": payload.hex(), "position": pos}}
        if op == "write_pdo":
            pos = int(request.get("position", 0))
            data = request.get("data", [])
            slave = self.slaves.get(pos)
            if not slave:
                return {"success": False, "error": "Slave not found"}
            payload = bytes(int(b) & 0xFF for b in data)
            slave.output_buffer[: len(payload)] = payload
            return {"success": True, "data": {"written_bytes": len(payload)}}
        return {"success": False, "error": f"Unknown op '{op}'"}

    async def _send(self, writer: asyncio.StreamWriter, message: Dict[str, Any]) -> None:
        writer.write(json.dumps(message).encode("utf-8") + b"\n")
        await writer.drain()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EtherCAT mock slave (JSON bridge).")
    parser.add_argument("--host", default=env("127.0.0.1", "MOCK_ETHERCAT_HOST"))
    parser.add_argument("--port", type=int, default=int(env("6700", "MOCK_ETHERCAT_PORT")))
    parser.add_argument("--update-interval", type=float, default=float(env("1.0", "MOCK_ETHERCAT_UPDATE_INTERVAL")))
    parser.add_argument("--verbose", action="store_true", default=env("false", "MOCK_ETHERCAT_VERBOSE").lower() in {"1", "true", "yes", "on"})
    return parser.parse_args()


async def run_server(config: MockConfig) -> None:
    server = EthercatMockServer(config)
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
    console.print("\n[red]Stopping EtherCAT mock...[/red]")
    await server.stop()


def main() -> None:
    args = parse_args()
    config = MockConfig(host=args.host, port=args.port, update_interval=args.update_interval, verbose=args.verbose)
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
