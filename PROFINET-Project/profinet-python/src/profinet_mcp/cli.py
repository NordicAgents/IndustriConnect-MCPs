"""CLI entry point for the PROFINET MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import ProfinetMCPServer


def main() -> None:
    load_dotenv()
    try:
        ProfinetMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
