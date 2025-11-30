import pyads
import logging
from typing import Any, Optional, Dict, List, Union

logger = logging.getLogger(__name__)

class ADSClient:
    def __init__(self, net_id: str = '127.0.0.1.1.1', port: int = 851):
        self.net_id = net_id
        self.port = port
        self.plc = None

    def connect(self):
        if not self.plc:
            try:
                self.plc = pyads.Connection(self.net_id, self.port)
                self.plc.open()
                logger.info(f"Connected to {self.net_id}:{self.port}")
            except Exception as e:
                logger.error(f"Connection failed: {e}")
                raise

    def close(self):
        if self.plc:
            self.plc.close()
            self.plc = None

    def read_symbol(self, symbol_name: str) -> Any:
        self.connect()
        try:
            return self.plc.read_by_name(symbol_name)
        except Exception as e:
            logger.error(f"Error reading symbol {symbol_name}: {e}")
            raise

    def write_symbol(self, symbol_name: str, value: Any) -> None:
        self.connect()
        try:
            self.plc.write_by_name(symbol_name, value)
        except Exception as e:
            logger.error(f"Error writing symbol {symbol_name}: {e}")
            raise

    def get_handle(self, symbol_name: str) -> int:
        self.connect()
        try:
            return self.plc.get_handle(symbol_name)
        except Exception as e:
            logger.error(f"Error getting handle for {symbol_name}: {e}")
            raise

    def release_handle(self, handle: int) -> None:
        self.connect()
        try:
            self.plc.release_handle(handle)
        except Exception as e:
            logger.error(f"Error releasing handle {handle}: {e}")
            raise

    def read_by_handle(self, handle: int, data_type: int) -> Any:
        # Note: data_type needs to be a pyads constant (e.g., pyads.PLCTYPE_INT)
        # This wrapper might need to map string types to pyads constants if exposed directly
        self.connect()
        try:
            return self.plc.read_by_handle(handle, data_type)
        except Exception as e:
            logger.error(f"Error reading by handle {handle}: {e}")
            raise

    def write_by_handle(self, handle: int, value: Any, data_type: int) -> None:
        self.connect()
        try:
            self.plc.write_by_handle(handle, value, data_type)
        except Exception as e:
            logger.error(f"Error writing by handle {handle}: {e}")
            raise
            
    def read_device_info(self) -> Dict[str, Any]:
        self.connect()
        try:
            name, version = self.plc.read_device_info()
            return {"name": name, "version": str(version)}
        except Exception as e:
            logger.error(f"Error reading device info: {e}")
            raise

    def read_state(self) -> Dict[str, int]:
        self.connect()
        try:
            ads_state, device_state = self.plc.read_state()
            return {"ads_state": ads_state, "device_state": device_state}
        except Exception as e:
            logger.error(f"Error reading state: {e}")
            raise
            
    def set_state(self, ads_state: int, device_state: int) -> None:
        self.connect()
        try:
            self.plc.write_control(ads_state, device_state, 0, b'')
        except Exception as e:
            logger.error(f"Error setting state: {e}")
            raise
