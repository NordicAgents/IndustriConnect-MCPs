"""FastMCP wiring for the DNP3 implementation."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .dnp3_master import DNP3Master
from .tools import PointMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    master: DNP3Master


class DNP3MCPServer:
    def __init__(
        self,
        master: DNP3Master | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.master = master or DNP3Master()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.point_map = PointMap(self.tool_config.point_map_path)
        self._server = FastMCP(
            name="DNP3 MCP Server",
            dependencies=[],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            master=self.master,
            config=self.tool_config,
            point_map=self.point_map,
        )
        register_tools(self._server, resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002
        await self.master.ensure_open()
        try:
            yield AppContext(master=self.master)
        finally:
            await self.master.close()
