import os
import logging
from mcp.server.fastmcp import FastMCP
from .fins_client import FINSClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastMCP
mcp = FastMCP("fins-mcp")

# Initialize FINS Client
host = os.getenv("FINS_HOST", "192.168.1.10")
port = int(os.getenv("FINS_PORT", "9600"))
protocol = os.getenv("FINS_PROTOCOL", "tcp")

client = FINSClient(host, port, protocol)

@mcp.tool()
async def read_memory_area(area_code: int, address: int, count: int) -> str:
    """
    Read words from a specific memory area.
    
    Args:
        area_code: The memory area code (e.g., 0x82 for DM, 0x30 for CIO).
        address: The starting word address.
        count: The number of words to read.
    """
    try:
        values = client.read_memory_area(area_code, address, count)
        return f"Read {count} words from Area {hex(area_code)} Address {address}: {values}"
    except Exception as e:
        return f"Error reading memory: {str(e)}"

@mcp.tool()
async def write_memory_area(area_code: int, address: int, values: list[int]) -> str:
    """
    Write words to a specific memory area.
    
    Args:
        area_code: The memory area code.
        address: The starting word address.
        values: A list of integer values to write.
    """
    try:
        client.write_memory_area(area_code, address, values)
        return f"Successfully wrote {len(values)} words to Area {hex(area_code)} Address {address}"
    except Exception as e:
        return f"Error writing memory: {str(e)}"

@mcp.tool()
async def read_dm(address: int, count: int) -> str:
    """
    Read from Data Memory (DM) area.
    
    Args:
        address: The starting DM address.
        count: Number of words to read.
    """
    try:
        values = client.read_dm(address, count)
        return f"DM[{address}:{address+count-1}] = {values}"
    except Exception as e:
        return f"Error reading DM: {str(e)}"

@mcp.tool()
async def write_dm(address: int, values: list[int]) -> str:
    """
    Write to Data Memory (DM) area.
    
    Args:
        address: The starting DM address.
        values: List of values to write.
    """
    try:
        client.write_dm(address, values)
        return f"Successfully wrote to DM[{address}]"
    except Exception as e:
        return f"Error writing DM: {str(e)}"

@mcp.tool()
async def read_cio(address: int, count: int) -> str:
    """
    Read from CIO (I/O) area.
    
    Args:
        address: The starting CIO address.
        count: Number of words to read.
    """
    try:
        values = client.read_cio(address, count)
        return f"CIO[{address}:{address+count-1}] = {values}"
    except Exception as e:
        return f"Error reading CIO: {str(e)}"

@mcp.tool()
async def write_cio(address: int, values: list[int]) -> str:
    """
    Write to CIO (I/O) area.
    
    Args:
        address: The starting CIO address.
        values: List of values to write.
    """
    try:
        client.write_cio(address, values)
        return f"Successfully wrote to CIO[{address}]"
    except Exception as e:
        return f"Error writing CIO: {str(e)}"
