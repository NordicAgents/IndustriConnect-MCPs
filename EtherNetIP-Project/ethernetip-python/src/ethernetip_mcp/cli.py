"""CLI entry point for the EtherNet/IP MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import EtherNetIPMCPServer


def main() -> None:
    load_dotenv()
    try:
        EtherNetIPMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
