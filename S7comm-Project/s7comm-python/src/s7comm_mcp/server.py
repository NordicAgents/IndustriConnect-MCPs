"""FastMCP server wiring for the S7comm implementation."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .s7_client import S7Client
from .tools import TagMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    client: S7Client


class S7CommMCPServer:
    """Container that wires Snap7 client lifecycle into FastMCP."""

    def __init__(
        self,
        client: S7Client | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.client = client or S7Client()
        self.tool_config = tool_config or ToolConfig.from_env()
        tag_map = TagMap(self.tool_config.tag_map_path)
        self.resources = ToolResources(
            client=self.client,
            config=self.tool_config,
            tag_map=tag_map,
        )
        self._mcp = FastMCP(
            name="S7comm MCP Server",
            dependencies=["python-snap7"],
            lifespan=self._lifespan,
        )
        register_tools(self._mcp, self.resources)

    def run(self) -> None:
        """Start the MCP server on stdio."""
        self._mcp.run()

    # -----------------------------
    # Lifespan
    # -----------------------------

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:
        await self.client.ensure_connection()
        try:
            yield AppContext(client=self.client)
        finally:
            await self.client.close()
