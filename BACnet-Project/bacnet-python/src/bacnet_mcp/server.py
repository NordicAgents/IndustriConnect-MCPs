"""FastMCP server wiring for BACnet tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .bacnet_client import BACnetClient
from .tools import ObjectMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    client: BACnetClient


class BACnetMCPServer:
    def __init__(
        self,
        client: BACnetClient | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.client = client or BACnetClient()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.object_map = ObjectMap(self.tool_config.object_map_path)
        self._server = FastMCP(
            name="BACnet MCP Server",
            dependencies=["BAC0"],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            client=self.client,
            config=self.tool_config,
            object_map=self.object_map,
        )
        register_tools(self._server, resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002
        await self.client.ensure_open()
        try:
            yield AppContext(client=self.client)
        finally:
            await self.client.close()
