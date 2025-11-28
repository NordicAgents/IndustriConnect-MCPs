"""FastMCP wiring for PROFIBUS tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .gsd_parser import GSDParser
from .pb_master import ProfibusMaster
from .tools import SlaveMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    master: ProfibusMaster


class ProfibusMCPServer:
    def __init__(
        self,
        master: ProfibusMaster | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.master = master or ProfibusMaster()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.slave_map = SlaveMap(self.tool_config.slave_map_path)
        self.gsd_parser = GSDParser(self.tool_config.gsd_base_path)
        self._server = FastMCP(
            name="PROFIBUS MCP Server",
            dependencies=["pyserial"],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            master=self.master,
            config=self.tool_config,
            slave_map=self.slave_map,
            gsd_parser=self.gsd_parser,
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
