"""FastMCP wiring for EtherCAT tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .ec_master import EthercatMaster
from .esi_parser import ESIParser
from .tools import SlaveMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    master: EthercatMaster


class EthercatMCPServer:
    def __init__(
        self,
        master: EthercatMaster | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.master = master or EthercatMaster()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.slave_map = SlaveMap(self.tool_config.slave_map_path)
        self.esi_parser = ESIParser(self.tool_config.esi_base_path)
        self._server = FastMCP(
            name="EtherCAT MCP Server",
            dependencies=["pysoem"],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            master=self.master,
            config=self.tool_config,
            slave_map=self.slave_map,
            esi_parser=self.esi_parser,
        )
        register_tools(self._server, resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002
        # Don't open interface at startup - open lazily when tools need it
        # This allows the server to start even without EtherCAT hardware available
        try:
            yield AppContext(master=self.master)
        finally:
            await self.master.close()
