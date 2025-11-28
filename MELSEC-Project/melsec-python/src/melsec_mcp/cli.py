"""CLI entry point for the MELSEC MC MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import MELSECMCPServer


def main() -> None:
    load_dotenv()
    try:
        MELSECMCPServer().run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
