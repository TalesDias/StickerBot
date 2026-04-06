import express from 'express';
import {to_sticker} from './format.js'
import axios from 'axios';

const app = express()

app.use(express.json({limit: '30mb'}));


function send_sticker(sticker_base64){
    const EVOLUTION_URL = "http://localhost:8080";
    const INSTANCE_NAME = "StickerBot";
    const API_KEY = "37470667b0b233f3783c70af1993d3baba1fd87e5481503f013cb17b72d70fc0";
    const TARGET_NUMBER = "120363407152112679@g.us"; 

    const response = fetch(`${EVOLUTION_URL}/message/sendSticker/${INSTANCE_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY
        },
        body: JSON.stringify({
            number: TARGET_NUMBER,
            sticker: sticker_base64,
            stickerName: "My Sticker",
            stickerAuthor: "Bot",
            mimetype: "image/webp"
        })
    });

    return response;
}

app.post("/webhook/messages-upsert", async (req, res, _) => {
    console.log("\n\n----- Message Received -----");
    const data = req.body.data;
    
    if(data.messageType !== 'imageMessage'){
        console.log("Type: Normal Message");
        console.log("Conversation: " + data.message.conversation );
        res.send(200);
        return;
    }

    const caption = data.message.imageMessage.caption;
    const base64 = data.message.base64;

    console.log("Type: Image Message");
    console.log("Caption: " + caption);
    console.log("Base64 init: " + base64.slice(0,30));
    
    const sticker64 = await to_sticker(base64);
    console.log("Sticker init: " + sticker64.slice(0,30));

    const response = await send_sticker(sticker64);

    if (response.ok) {
        console.log("Sticker Sent!");
        res.send(200);
    } else {
        const error = await response.text();
        console.error(`HTTP Error ${response.status}:`, error);
        res.send(500);
    }

})

app.listen(3001, () => {
    console.log("Server Started!")
});

