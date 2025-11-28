"""CLI entry point for the BACnet MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import BACnetMCPServer


def main() -> None:
    load_dotenv()
    try:
        BACnetMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
