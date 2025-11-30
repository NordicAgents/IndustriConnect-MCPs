"""Command-line entry point for the S7comm MCP server."""

from __future__ import annotations

from dotenv import load_dotenv

from .server import S7CommMCPServer


def main() -> None:
    """Entrypoint used by ``s7comm-mcp`` console script."""
    load_dotenv()
    try:
        S7CommMCPServer().run()
    except KeyboardInterrupt:
        # Allow graceful shutdown when the user presses Ctrl+C.
        pass


if __name__ == "__main__":
    main()
