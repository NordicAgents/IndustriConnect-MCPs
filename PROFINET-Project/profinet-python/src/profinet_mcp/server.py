"""FastMCP server wiring for PROFINET tools."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP

from .gsd_parser import GSDParser
from .pn_client import ProfinetClient
from .tools import DeviceMap, ToolConfig, ToolResources, register_tools


@dataclass(slots=True)
class AppContext:
    client: ProfinetClient


class ProfinetMCPServer:
    """Container for lifecycle + tool registration."""

    def __init__(
        self,
        client: ProfinetClient | None = None,
        tool_config: ToolConfig | None = None,
    ) -> None:
        self.client = client or ProfinetClient()
        self.tool_config = tool_config or ToolConfig.from_env()
        self.device_map = DeviceMap(self.tool_config.device_map_path)
        self.gsd_parser = GSDParser(self.tool_config.gsd_base_path)
        self._server = FastMCP(
            name="PROFINET MCP Server",
            dependencies=["scapy", "lxml"],
            lifespan=self._lifespan,
        )
        resources = ToolResources(
            client=self.client,
            config=self.tool_config,
            device_map=self.device_map,
            gsd_parser=self.gsd_parser,
        )
        register_tools(self._server, resources)

    def run(self) -> None:
        self._server.run()

    @asynccontextmanager
    async def _lifespan(self, server: FastMCP) -> AsyncIterator[AppContext]:  # noqa: ARG002
        try:
            yield AppContext(client=self.client)
        finally:
            # PROFINET is stateless for now; nothing to close
            pass
