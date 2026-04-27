import config from '../config.js';
import axios from 'axios';

export async function download_video(messageId: string): Promise<string> {
  try {
    const url = `${config.EVOLUTION_URL}/chat/getBase64FromMediaMessage/${config.INSTANCE_NAME}`;
    const res = await axios.post(url,{
        message: {key: {id: messageId}},
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