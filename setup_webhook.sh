curl -X POST http://localhost:8080/webhook/set/StickerBot \
  -H "Content-Type: application/json" \
  -H "apikey: 37470667b0b233f3783c70af1993d3baba1fd87e5481503f013cb17b72d70fc0" \
  -d '{
  "webhook":{
    "enabled": true,
    "url": "http://host.docker.internal:3001/webhook",
    "webhookByEvents": true,
    "webhookBase64": false,
    "events": ["MESSAGES_UPSERT"]
    }
  }'