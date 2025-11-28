"""FastMCP wiring for EtherNet/IP tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .eip_client import EIPClient
from .tools import TagMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    client: EIPClient


class EtherNetIPMCPServer:
    """Container responsible for lifecycle + tool registration."""

    def __init__(
        self,
        client: EIPClient | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.client = client or EIPClient()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.resources = ToolResources(
            client=self.client,
            config=self.tool_config,
            tag_map=TagMap(self.tool_config.tag_map_path),
        )
        self._server = FastMCP(
            name="EtherNet/IP MCP Server",
            dependencies=["pycomm3"],
            lifespan=self._lifespan,
        )
        register_tools(self._server, self.resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002 - signature contract
        await self.client.ensure_connection()
        try:
            yield AppContext(client=self.client)
        finally:
            await self.client.close()
