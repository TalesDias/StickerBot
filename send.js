
const EVOLUTION_URL = "http://localhost:8080";
const INSTANCE_NAME = "StickerBot";
const API_KEY = "37470667b0b233f3783c70af1993d3baba1fd87e5481503f013cb17b72d70fc0";
const TARGET_NUMBER = "120363407152112679@g.us";

function send_sticker(message_to_quote_id, sticker_base64){ 
    const response = fetch(`${EVOLUTION_URL}/message/sendSticker/${INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY
        },
        body: JSON.stringify({
            "number": TARGET_NUMBER,
            "sticker": sticker_base64,
            "quoted": {
                "key":{
                    "id": message_to_quote_id

                }
            }
        })
    });

    return response;
}

function quote_message(message_to_quote_id, text){ 
    const response = fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY
        },
        body: JSON.stringify({
            "number": TARGET_NUMBER,
            "text": text,
            "quoted": {
                "key":{
                    "id": message_to_quote_id
                }
            }
        })
    });

    return response;
}

export {send_sticker, quote_message};