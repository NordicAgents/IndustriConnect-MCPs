"""FastMCP server wiring for MELSEC MC tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .mc_client import MCClient
from .tools import DeviceMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    client: MCClient


class MELSECMCPServer:
    def __init__(
        self,
        client: MCClient | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.client = client or MCClient()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.device_map = DeviceMap(self.tool_config.device_map_path)
        self._server = FastMCP(
            name="MELSEC MC MCP Server",
            dependencies=["pymcprotocol"],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            client=self.client,
            config=self.tool_config,
            device_map=self.device_map,
        )
        register_tools(self._server, resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002
        await self.client.ensure_connection()
        try:
            yield AppContext(client=self.client)
        finally:
            await self.client.close()
