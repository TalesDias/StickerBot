import requests
import base64
import sys

INSTANCE_NAME = "StickerBot"
API_KEY = "37470667b0b233f3783c70af1993d3baba1fd87e5481503f013cb17b72d70fc0"
EVOLUTION_URL = "http://localhost:8080"
TARGET_NUMBER = "120363407152112679@g.us"
STICKER_PATH = sys.argv[1]


def send_sticker():

    url = f"{EVOLUTION_URL}/message/sendSticker/{INSTANCE_NAME}"

    # Read and convert to base64
    with open(STICKER_PATH, "rb") as f:
        sticker_base64 = base64.b64encode(f.read()).decode('utf-8')

    payload = {
        "number": TARGET_NUMBER,
        "sticker": sticker_base64,
        "stickerName": "Figurinhas Selat®",
        "stickerAuthor": "BoBot"
    }

    headers = {
        "Content-Type": "application/json",
        "apikey": API_KEY
    }

    try:
        print(f"📤 Sending sticker to {TARGET_NUMBER}...")
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")

if __name__ == "__main__":
    send_sticker()

