import asyncio
import websockets

async def listen():
    uri = "ws://127.0.0.1:8002/api/v1/diagrams/ws/1"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting for messages...")
            while True:
                message = await websocket.recv()
                print(f"Received message: {message}")
    except Exception as e:
        print(f"Connection failed or closed: {e}")

if __name__ == "__main__":
    asyncio.run(listen())
