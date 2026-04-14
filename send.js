
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const INSTANCE_NAME = process.env.INSTANCE_NAME;
const API_KEY       = process.env.AUTHENTICATION_API_KEY
const STICKER_GROUP = process.env.STICKER_GROUP;

async function send_sticker(message_to_quote_id, sticker_base64){ 
    const response = await fetch(`${EVOLUTION_URL}/message/sendSticker/${INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY
        },
        body: JSON.stringify({
            "number": STICKER_GROUP,
            "sticker": sticker_base64,
            "quoted": {
                "key":{
                    "id": message_to_quote_id

                }
            }
        })
    });

    if (response.ok) {
        console.log("Sticker Sent!");
        return 200;
    } else {
        const error = await response.text();
        console.error(`HTTP Error ${response.status}:`, error);
        return 500;
    }
}

async function quote_message(message_to_quote_id, text){ 
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY
        },
        body: JSON.stringify({
            "number": STICKER_GROUP,
            "text": text,
            "quoted": {
                "key":{
                    "id": message_to_quote_id
                }
            }
        })
    });

    if (response.ok) {
        console.log("Message Sent!");
        return 200;
    } else {
        const error = await response.text();
        console.error(`HTTP Error ${response.status}:`, error);
        return 500;
    }
}

export {send_sticker, quote_message};