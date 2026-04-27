import dotenv from 'dotenv';

dotenv.config();

function verifyKey(key: string | undefined, keyName: string): string{
    if(!key || key.trim() === ''){
        throw new Error("Missing key: "+ keyName);
    }
    return key
}

export const config = {
    EVOLUTION_URL:          verifyKey(process.env.EVOLUTION_URL, "EVOLUTION_URL"),
    INSTANCE_NAME:          verifyKey(process.env.INSTANCE_NAME, "INSTANCE_NAME"),
    API_KEY:                verifyKey(process.env.AUTHENTICATION_API_KEY, "AUTHENTICATION_API_KEY"),
    STICKER_GROUP:          verifyKey(process.env.STICKER_GROUP, "STICKER_GROUP"),
    RABBIT_CONNECTION_URI:  verifyKey(process.env.RABBIT_CONNECTION_URI, "RABBIT_CONNECTION_URI"),
    
} as const;

export default config;