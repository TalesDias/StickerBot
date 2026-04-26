import {Request, Response} from 'express';
import express from 'express';
import {to_sticker} from './format.js'
import {send_sticker, quote_message} from './send.js'
import axios from 'axios';
import config from './config.js';
import fs from 'fs/promises'


const app = express()
app.use(express.json({limit: '30mb'}));

const help_message = `*Commandos Gerais*
.ajuda
.marco

*Comandos em Imagens:*
.circulo
.quadrado (padrão)
.arredondado 
.esticado
.original
`;

app.post("/webhook/messages-upsert", async (req: Request, res: Response) => {
    console.log("\n\n----- Message Received -----");
    
    const data = req.body.data;
    const msg_id  = data.key.id;
    console.log("Message Type: " + data.messageType);

    if (data.messageType === 'videoMessage'){
        const resCode = await handleVideo(msg_id, data);
        res.send(resCode);
    }
    else if(data.messageType === 'imageMessage'){
        const resCode = await handleImage(msg_id, data);
        res.send(resCode);
    }
    else{
        const conversation = data.message.conversation;
        
        if(conversation?.startsWith('.')){
            console.log("Type: Control Message");
            console.log("Command: " + data.message.conversation);
            
            let responseCode;

            switch (conversation.toLowerCase()) {
                case ".marco":
                    responseCode = await quote_message(msg_id, "polo");
                    break;

                case ".ajuda":
                    responseCode = await quote_message(msg_id, help_message);
                    break;
            
                default:
                    responseCode = await quote_message(msg_id, "🫪");
                    break;
            }

            res.send(responseCode);
            return;
        }
        else{
            console.log("Ignoring Normal message ...");
            console.log("Conversation: " + data.message.conversation);
            res.send(200);
            return;
        }
    }

});

async function handleVideo(msg_id: string, data: any): Promise<number>{
    const base64 = await downloadMediaAsBase64(msg_id);
    const caption = data.message.videoMessage.caption;

    console.log("Caption: " + caption);
    console.log("Base64 init: " + base64.slice(0,30));

    //saveBase64ToMp4(base64);

    let sticker_type = getStickerType(caption);

    const sticker64 = await to_sticker(base64, sticker_type);
    console.log("Sticker init: " + sticker64.slice(0,30));

    return send_sticker(msg_id, sticker64);
}


async function saveBase64ToMp4(base64String: string, filename: string = 'debug_video.mp4'): Promise<void> {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    
    await fs.writeFile(filename, buffer);
    
    console.log(`💾 Saved video to: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err: any) {
    console.error('Failed to save mp4:', err.message);
  }
}

async function downloadMediaAsBase64(messageId: string): Promise<string> {
  try {
    const url = `${config.EVOLUTION_URL}/chat/getBase64FromMediaMessage/${config.INSTANCE_NAME}`;
    const res = await axios.post(url,{
        message: {
          key: {
            id: messageId
          }
        },
        convertToMp4: true
      },{
        headers: {
          'apikey': config.API_KEY,
          'Content-Type': 'application/json'
    }});

    return res.data.base64;

  } 
  catch (error: any) {
    console.error('Download failed:', error.response?.data || error.message);
    throw error;
  }
}

async function handleImage(msg_id: string, data: any): Promise<number>{
    const caption = data.message.imageMessage.caption;
    const base64  = data.message.base64;

    console.log("Caption: " + caption);
    console.log("Base64 init: " + base64.slice(0,30));

    let sticker_type = getStickerType(caption);

    const sticker64 = await to_sticker(base64, sticker_type);
    console.log("Sticker init: " + sticker64.slice(0,30));

    return send_sticker(msg_id, sticker64);
}

function getStickerType(caption?: string){
    let sticker_type = "crop";

    if (caption?.startsWith('.')){
        switch (caption.toLowerCase()) {
            case ".circulo":
                sticker_type = 'circle';
                break;
            case ".quadrado":
                sticker_type = 'crop';
                break;
            case ".arredondado":
                sticker_type = 'rounded';
                break;
            case ".esticado":
                sticker_type = 'default';
                break;
            case ".original":
                sticker_type = 'full';
                break;
            default:
                sticker_type = 'crop';
                break;
        }
    }

    return sticker_type;
}


app.listen(3001, () => {
    console.log("Server Started!")
});

