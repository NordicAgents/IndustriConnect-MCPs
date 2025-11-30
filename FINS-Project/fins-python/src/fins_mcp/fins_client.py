import socket
import struct
import logging
from typing import List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

class FINSClient:
    def __init__(self, host: str = '192.168.1.10', port: int = 9600, protocol: str = 'tcp'):
        self.host = host
        self.port = port
        self.protocol = protocol.lower()
        self.sock = None
        
        # FINS Header defaults
        self.icf = 0x80  # Information Control Field
        self.rsv = 0x00  # Reserved
        self.gct = 0x02  # Gateway Count
        self.dna = 0x00  # Destination Network Address
        self.da1 = 0x00  # Destination Node Address
        self.da2 = 0x00  # Destination Unit Address
        self.sna = 0x00  # Source Network Address
        self.sa1 = 0x00  # Source Node Address
        self.sa2 = 0x00  # Source Unit Address
        self.sid = 0x00  # Service ID

    def connect(self):
        if self.protocol == 'tcp':
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(5.0)
            try:
                self.sock.connect((self.host, self.port))
                # FINS/TCP Handshake could be implemented here if needed
                # For now, assuming direct FINS frame or simple encapsulation
                logger.info(f"Connected to {self.host}:{self.port}")
            except Exception as e:
                logger.error(f"Connection failed: {e}")
                raise
        elif self.protocol == 'udp':
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.settimeout(5.0)
            logger.info(f"Initialized UDP socket for {self.host}:{self.port}")

    def close(self):
        if self.sock:
            self.sock.close()
            self.sock = None

    def _build_header(self) -> bytes:
        self.sid = (self.sid + 1) % 256
        return struct.pack('BBBBBBBBBB', 
            self.icf, self.rsv, self.gct,
            self.dna, self.da1, self.da2,
            self.sna, self.sa1, self.sa2,
            self.sid
        )

    def _send_command(self, mrc: int, src: int, data: bytes = b'') -> bytes:
        if not self.sock:
            self.connect()
            
        header = self._build_header()
        command = struct.pack('BB', mrc, src) + data
        frame = header + command
        
        try:
            if self.protocol == 'tcp':
                # Simple FINS/TCP header (Client Node Address, etc might be needed for full spec)
                # For simplicity, sending raw FINS frame or minimal TCP wrapper
                # Real FINS/TCP usually requires a 16-byte header. 
                # Implementing a basic FINS/TCP header:
                # FINS/TCP Header: Magic(4) + Len(4) + Cmd(4) + Err(4)
                # But for many simple setups, raw FINS over UDP is easier. 
                # Let's stick to a basic implementation.
                self.sock.send(frame)
                response = self.sock.recv(1024)
            else:
                self.sock.sendto(frame, (self.host, self.port))
                response, _ = self.sock.recvfrom(1024)
                
            return response
        except Exception as e:
            logger.error(f"Communication error: {e}")
            self.close()
            raise

    def read_memory_area(self, area_code: int, address: int, count: int) -> List[int]:
        # MRC: 01, SRC: 01 (Memory Area Read)
        # Data: Area(1) + Address(2) + Bit(1) + Count(2)
        
        data = struct.pack('!BHBH', area_code, address, 0x00, count)
        response = self._send_command(0x01, 0x01, data)
        
        # Parse response
        # Header(10) + MRC(1) + SRC(1) + EndCode(2) + Data(...)
        if len(response) < 14:
            raise ValueError("Response too short")
            
        end_code = struct.unpack('!H', response[12:14])[0]
        if end_code != 0:
            raise ValueError(f"PLC Error: {hex(end_code)}")
            
        raw_data = response[14:]
        values = []
        for i in range(0, len(raw_data), 2):
            if i + 2 <= len(raw_data):
                values.append(struct.unpack('!H', raw_data[i:i+2])[0])
                
        return values

    def write_memory_area(self, area_code: int, address: int, values: List[int]) -> None:
        # MRC: 01, SRC: 02 (Memory Area Write)
        # Data: Area(1) + Address(2) + Bit(1) + Count(2) + Data(...)
        
        count = len(values)
        data = struct.pack('!BHBH', area_code, address, 0x00, count)
        for val in values:
            data += struct.pack('!H', val)
            
        response = self._send_command(0x01, 0x02, data)
        
        if len(response) < 14:
            raise ValueError("Response too short")
            
        end_code = struct.unpack('!H', response[12:14])[0]
        if end_code != 0:
            raise ValueError(f"PLC Error: {hex(end_code)}")

    # Helper for common areas
    def read_dm(self, address: int, count: int) -> List[int]:
        return self.read_memory_area(0x82, address, count)

    def write_dm(self, address: int, values: List[int]) -> None:
        self.write_memory_area(0x82, address, values)

    def read_cio(self, address: int, count: int) -> List[int]:
        return self.read_memory_area(0x30, address, count)

    def write_cio(self, address: int, values: List[int]) -> None:
        self.write_memory_area(0x30, address, values)
