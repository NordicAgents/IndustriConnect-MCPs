import sys
from .server import mcp

def main():
    """Entry point for the ADS MCP server."""
    try:
        mcp.run()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
