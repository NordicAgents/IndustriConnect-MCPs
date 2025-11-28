"""
S7comm MCP server package.

This module exposes the public API for the Python implementation of the Siemens
S7 MCP server.  See ``s7comm_mcp.cli`` for the executable entry point.
"""

from .server import S7CommMCPServer

__all__ = ["S7CommMCPServer"]
