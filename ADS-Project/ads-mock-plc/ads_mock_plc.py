import socket
import struct
import logging
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MockPLC")

class MockPLC:
    def __init__(self, host='0.0.0.0', port=48898): # Standard AMS port is 48898 (0xBF02)
        self.host = host
        self.port = port
        self.symbols = {
            "MAIN.ConveyorSpeed": {"value": 0, "type": "INT"},
            "MAIN.Motor.bRun": {"value": 0, "type": "BOOL"},
            "MAIN.Sensors.rTemp": {"value": 25.5, "type": "REAL"},
        }
        self.handles = {}
        self.next_handle = 1000

    def handle_command(self, data: bytes) -> bytes:
        # Basic AMS/ADS frame parsing
        # AMS Header (32 bytes) + ADS Data
        if len(data) < 32:
            return b''
            
        # AMS Header
        # NetID Dst (6), Port Dst (2), NetID Src (6), Port Src (2)
        # Cmd (2), State (2), Len (4), Err (4), InvokeID (4)
        
        ams_header = data[:32]
        target_net_id = ams_header[:6]
        target_port = struct.unpack('<H', ams_header[6:8])[0]
        source_net_id = ams_header[8:14]
        source_port = struct.unpack('<H', ams_header[14:16])[0]
        command_id = struct.unpack('<H', ams_header[16:18])[0]
        state_flags = struct.unpack('<H', ams_header[18:20])[0]
        data_len = struct.unpack('<I', ams_header[20:24])[0]
        error_code = struct.unpack('<I', ams_header[24:28])[0]
        invoke_id = struct.unpack('<I', ams_header[28:32])[0]
        
        payload = data[32:]
        
        logger.info(f"Received Command: ID={hex(command_id)} Len={data_len}")
        
        # Prepare response header
        # Swap Source/Target
        resp_target_net_id = source_net_id
        resp_target_port = source_port
        resp_source_net_id = target_net_id
        resp_source_port = target_port
        
        resp_state_flags = state_flags | 0x0001 # Response flag
        resp_error_code = 0
        
        resp_data = b''
        
        # ADS Read Device Info (0x0001)
        if command_id == 0x0001:
            logger.info("Read Device Info")
            # Result(4) + Major(1) + Minor(1) + Build(2) + Name(16)
            resp_data = struct.pack('<I', 0) # Result: OK
            resp_data += struct.pack('BBH', 3, 1, 4024) # Version 3.1.4024
            resp_data += b'TwinCAT 3 PLC'.ljust(16, b'\x00')
            
        # ADS Read (0x0002)
        elif command_id == 0x0002:
            index_group = struct.unpack('<I', payload[:4])[0]
            index_offset = struct.unpack('<I', payload[4:8])[0]
            read_len = struct.unpack('<I', payload[8:12])[0]
            
            logger.info(f"Read: Group={hex(index_group)} Offset={hex(index_offset)} Len={read_len}")
            
            resp_data = struct.pack('<I', 0) # Result: OK
            resp_data += struct.pack('<I', read_len) # Length
            resp_data += b'\x00' * read_len # Dummy data
            
        # ADS Write (0x0003)
        elif command_id == 0x0003:
            index_group = struct.unpack('<I', payload[:4])[0]
            index_offset = struct.unpack('<I', payload[4:8])[0]
            write_len = struct.unpack('<I', payload[8:12])[0]
            write_data = payload[12:]
            
            logger.info(f"Write: Group={hex(index_group)} Offset={hex(index_offset)} Len={write_len}")
            
            resp_data = struct.pack('<I', 0) # Result: OK
            
        # ADS Read State (0x0004)
        elif command_id == 0x0004:
            logger.info("Read State")
            resp_data = struct.pack('<I', 0) # Result: OK
            resp_data += struct.pack('<H', 5) # ADS State: RUN (5)
            resp_data += struct.pack('<H', 0) # Device State
            
        # ADS Write Control (0x0005)
        elif command_id == 0x0005:
            ads_state = struct.unpack('<H', payload[:2])[0]
            device_state = struct.unpack('<H', payload[2:4])[0]
            logger.info(f"Write Control: ADS State={ads_state}")
            resp_data = struct.pack('<I', 0) # Result: OK

        # ADS Read Write (0x0009) - Used for Get Handle, Read by Handle, etc.
        elif command_id == 0x0009:
            index_group = struct.unpack('<I', payload[:4])[0]
            index_offset = struct.unpack('<I', payload[4:8])[0]
            read_len = struct.unpack('<I', payload[8:12])[0]
            write_len = struct.unpack('<I', payload[12:16])[0]
            write_data = payload[16:]
            
            logger.info(f"ReadWrite: Group={hex(index_group)} Offset={hex(index_offset)}")
            
            resp_data = struct.pack('<I', 0) # Result: OK
            
            # Get Handle by Name (Group 0xF003)
            if index_group == 0xF003:
                symbol_name = write_data.decode('ascii').rstrip('\x00')
                logger.info(f"Get Handle for: {symbol_name}")
                if symbol_name in self.symbols:
                    handle = self.next_handle
                    self.handles[handle] = symbol_name
                    self.next_handle += 1
                    resp_data += struct.pack('<I', 4) # Length
                    resp_data += struct.pack('<I', handle)
                else:
                    resp_data = struct.pack('<I', 0x710) # Symbol not found
                    resp_data += struct.pack('<I', 0)
                    
            # Read by Handle (Group 0xF005) is usually done via Read (0x0002) with Group 0xF005
            # But sometimes ReadWrite is used.
            
            else:
                resp_data += struct.pack('<I', read_len)
                resp_data += b'\x00' * read_len

        else:
            logger.warning(f"Unknown command: {hex(command_id)}")
            resp_data = struct.pack('<I', 0) # Result: OK (fake)
            
        # Construct AMS Response Header
        resp_header = resp_target_net_id + struct.pack('<H', resp_target_port) + \
                      resp_source_net_id + struct.pack('<H', resp_source_port) + \
                      struct.pack('<H', command_id) + \
                      struct.pack('<H', resp_state_flags) + \
                      struct.pack('<I', len(resp_data)) + \
                      struct.pack('<I', resp_error_code) + \
                      struct.pack('<I', invoke_id)
                      
        return resp_header + resp_data

    async def handle_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        logger.info(f"New connection from {addr}")
        
        try:
            while True:
                # AMS header is 32 bytes, but we need to read enough
                # For simplicity, read a chunk
                data = await reader.read(4096)
                if not data:
                    break
                    
                response = self.handle_command(data)
                writer.write(response)
                await writer.drain()
        except Exception as e:
            logger.error(f"Error handling client: {e}")
        finally:
            writer.close()
            logger.info(f"Connection closed {addr}")

    async def start(self):
        server = await asyncio.start_server(
            self.handle_client, self.host, self.port
        )
        
        addr = server.sockets[0].getsockname()
        logger.info(f"Mock PLC serving on {addr}")
        
        async with server:
            await server.serve_forever()

def main():
    plc = MockPLC()
    try:
        asyncio.run(plc.start())
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
