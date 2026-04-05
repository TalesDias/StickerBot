from fastapi import FastAPI, Request
import uvicorn 
import base64
from io import BytesIO
from PIL import Image
import json
import subprocess

app = FastAPI(title="Webhook Test")

@app.post("/webhook/messages-upsert")
async def receive_webhook(request: Request):
    try: 
        body = await request.json()

        print("\n\n*** Message Received ***")
        print(f"body: {body.get('event')}")
        print(f"Instance: {body.get('instance')}")

        message = body.get('data').get('message')
        
        if 'imageMessage' in message:
            caption = message.get('imageMessage').get('caption')
            print(f"Caption: {caption}")

            img_bytes = base64.b64decode(message.get('base64'))
            img = Image.open(BytesIO(img_bytes))
            
            temp_path = "downloads/temp.png"
            img.save(temp_path, format="png")

            subprocess.run(['node', 'format.js', temp_path])

        else:
            print("Message without a image. Ignoring...")

        #print("Full data:")
        #print(json.dumps(body, indent=2, ensure_ascii=False))
        
        return {"status": "received"}

    except Exception as e:
        print(f"Error processing webhook: {e}")
        return {"status": "error"}, 400


if __name__ == "__main__":
    print("Server started")
    uvicorn.run(app, host="0.0.0.0", port=3001)

























