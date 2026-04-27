import { registerCommandConsumer } from  './commandConsumer.js'
import { registerStickerConsumer } from './stickerConsumer.js'
import { registerSenderConsumer } from './sendConsumer.js'

export function registerConsumers (){
    registerCommandConsumer();
    registerStickerConsumer();
    registerSenderConsumer();
}