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
    def __init__(self, host='0.0.0.0', port=9600):
        self.host = host
        self.port = port
        self.memory = {
            0x82: {}, # DM Area
            0x30: {}, # CIO Area
            0x31: {}, # WR Area
            0x32: {}, # HR Area
        }
        # Pre-populate some data
        for i in range(100):
            self.memory[0x82][1000 + i] = i  # DM 1000-1099
            self.memory[0x30][0 + i] = 0     # CIO 0-99

    def handle_command(self, data: bytes) -> bytes:
        # Basic FINS frame parsing
        # Header(10) + MRC(1) + SRC(1) + Data(...)
        if len(data) < 12:
            return b''
            
        header = data[:10]
        mrc = data[10]
        src = data[11]
        payload = data[12:]
        
        logger.info(f"Received Command: MRC={hex(mrc)} SRC={hex(src)}")
        
        # Construct response header (swap src/dst)
        # ICF, RSV, GCT, DNA, DA1, DA2, SNA, SA1, SA2, SID
        icf, rsv, gct, dna, da1, da2, sna, sa1, sa2, sid = struct.unpack('BBBBBBBBBB', header)
        
        # Response header: Swap DNA/SNA, DA1/SA1, DA2/SA2
        resp_header = struct.pack('BBBBBBBBBB', 
            0xC0, 0x00, 0x02,
            sna, sa1, sa2,
            dna, da1, da2,
            sid
        )
        
        resp_mrc_src = struct.pack('BB', mrc, src)
        end_code = b'\x00\x00' # Normal completion
        
        resp_data = b''
        
        if mrc == 0x01 and src == 0x01: # Memory Area Read
            area_code, address, bit, count = struct.unpack('!BHBH', payload[:6])
            logger.info(f"Read Memory: Area={hex(area_code)} Addr={address} Count={count}")
            
            values = []
            for i in range(count):
                val = self.memory.get(area_code, {}).get(address + i, 0)
                values.append(val)
                resp_data += struct.pack('!H', val)
                
        elif mrc == 0x01 and src == 0x02: # Memory Area Write
            area_code, address, bit, count = struct.unpack('!BHBH', payload[:6])
            logger.info(f"Write Memory: Area={hex(area_code)} Addr={address} Count={count}")
            
            values_data = payload[6:]
            for i in range(count):
                if len(values_data) >= (i+1)*2:
                    val = struct.unpack('!H', values_data[i*2:(i+1)*2])[0]
                    if area_code not in self.memory:
                        self.memory[area_code] = {}
                    self.memory[area_code][address + i] = val
            
        else:
            logger.warning(f"Unknown command: {hex(mrc)} {hex(src)}")
            end_code = b'\x00\x01' # Not supported
            
        return resp_header + resp_mrc_src + end_code + resp_data

    async def handle_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        logger.info(f"New connection from {addr}")
        
        try:
            while True:
                data = await reader.read(1024)
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
