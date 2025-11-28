"""CLI entry point for the DNP3 MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import DNP3MCPServer


def main() -> None:
    load_dotenv()
    try:
        DNP3MCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
