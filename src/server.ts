import {Request, Response} from 'express';
import express from 'express';
import {to_sticker} from './format.js'
import {send_sticker, quote_message} from './send.js'


const app = express()
app.use(express.json({limit: '30mb'}));

const help_message = `*Commandos Gerais*
.ajuda
.marco

*Comandos em Imagens:*
.circulo
.quadrado
.arredondado (padrão)
.esticado
.original
`;

app.post("/webhook/messages-upsert", async (req: Request, res: Response) => {
    console.log("\n\n----- Message Received -----");
    
    const data = req.body.data;
    const msg_id  = data.key.id;

    if(data.messageType !== 'imageMessage'){
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
            console.log("Type: Normal Message, ignoring...");
            console.log("Conversation: " + data.message.conversation);
            res.send(200);
            return;
        }
    }

    const caption = data.message.imageMessage.caption;
    const base64  = data.message.base64;

    console.log("Type: Image Message");
    console.log("Caption: " + caption);
    console.log("Base64 init: " + base64.slice(0,30));

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

    const sticker64 = await to_sticker(base64, sticker_type);
    console.log("Sticker init: " + sticker64.slice(0,30));

    const responseCode = await send_sticker(msg_id, sticker64);
    res.send(responseCode);
});


app.listen(3001, () => {
    console.log("Server Started!")
});

