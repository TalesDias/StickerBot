import config from './config.js';

async function send_sticker(
    message_to_quote_id: string, 
    sticker_base64: string): Promise<number> {
    const response = await fetch(
        `${config.EVOLUTION_URL}/message/sendSticker/${config.INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": config.API_KEY
        },
        body: JSON.stringify({
            "number": config.STICKER_GROUP,
            "sticker": sticker_base64,
            "quoted": {
                "key":{
                    "id": message_to_quote_id
                }
            },
            "notConvertSticker": true
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

async function quote_message(
    message_to_quote_id: string,
    text:string): Promise<number> { 

    if (!config.API_KEY) {
        console.error("API_KEY is not defined");
        return 500;
    }

    const response = await fetch(
        `${config.EVOLUTION_URL}/message/sendText/${config.INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": config.API_KEY
        },
        body: JSON.stringify({
            "number": config.STICKER_GROUP,
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