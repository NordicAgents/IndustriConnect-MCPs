import os
import logging
import pyads
from mcp.server.fastmcp import FastMCP
from .ads_client import ADSClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastMCP
mcp = FastMCP("ads-mcp")

# Initialize ADS Client
net_id = os.getenv("ADS_NET_ID", "127.0.0.1.1.1")
port = int(os.getenv("ADS_PORT", "851"))

client = ADSClient(net_id, port)

@mcp.tool()
async def read_symbol(symbol_name: str) -> str:
    """
    Read a variable by symbol name.
    
    Args:
        symbol_name: The name of the symbol to read (e.g., "MAIN.MyVar").
    """
    try:
        value = client.read_symbol(symbol_name)
        return f"Symbol {symbol_name} = {value}"
    except Exception as e:
        return f"Error reading symbol: {str(e)}"

@mcp.tool()
async def write_symbol(symbol_name: str, value: int) -> str:
    """
    Write a value to a symbol.
    
    Args:
        symbol_name: The name of the symbol to write.
        value: The value to write (currently supports integers).
    """
    try:
        client.write_symbol(symbol_name, value)
        return f"Successfully wrote {value} to {symbol_name}"
    except Exception as e:
        return f"Error writing symbol: {str(e)}"

@mcp.tool()
async def read_device_info() -> str:
    """
    Read device information.
    """
    try:
        info = client.read_device_info()
        return f"Device Info: {info}"
    except Exception as e:
        return f"Error reading device info: {str(e)}"

@mcp.tool()
async def read_state() -> str:
    """
    Read PLC state.
    """
    try:
        state = client.read_state()
        return f"State: {state}"
    except Exception as e:
        return f"Error reading state: {str(e)}"

@mcp.tool()
async def start_plc() -> str:
    """
    Start the PLC (set state to RUN).
    """
    try:
        client.set_state(pyads.ADSSTATE_RUN, 0)
        return "PLC Started (RUN state)"
    except Exception as e:
        return f"Error starting PLC: {str(e)}"

@mcp.tool()
async def stop_plc() -> str:
    """
    Stop the PLC (set state to STOP).
    """
    try:
        client.set_state(pyads.ADSSTATE_STOP, 0)
        return "PLC Stopped (STOP state)"
    except Exception as e:
        return f"Error stopping PLC: {str(e)}"
