"""CLI entry point for the PROFIBUS MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import ProfibusMCPServer


def main() -> None:
    load_dotenv()
    try:
        ProfibusMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
