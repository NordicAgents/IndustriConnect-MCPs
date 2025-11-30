"""CLI entry point for the EtherCAT MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import EthercatMCPServer


def main() -> None:
    load_dotenv()
    try:
        EthercatMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
