import {messageKey,type Message} from './types.ts';
import type {Storage} from '../storage/interface.ts';
export type MessageFavorite={key:string;identity:string;messageKey:string;requestId?:string;savedAt:string};
export function favoriteIdentity(message:Message){return message.request_id?'request:'+message.request_id:messageKey(message)}
export function favoritePrefix(conversationId:number){if(!Number.isSafeInteger(conversationId)||conversationId<1)throw Error('Invalid conversation');return 'favorite:'+conversationId+':'}
/** References the encrypted message cache; never duplicates a message body or media URL. */
export class MessageFavorites {
 private writes:Promise<unknown>=Promise.resolve();
 constructor(private disk:Storage){}
 async list(id:number){await this.writes;return this.disk.scan<MessageFavorite>(favoritePrefix(id))}
 toggle(id:number,message:Message):Promise<boolean>{
  const job=async()=>{const identity=favoriteIdentity(message),key=favoritePrefix(id)+encodeURIComponent(identity);const previous=(await this.disk.scan<MessageFavorite>(favoritePrefix(id))).find(record=>record.identity===identity||record.messageKey===messageKey(message));if(previous){await this.disk.remove(previous.key);return false}await this.disk.put(key,{key,identity,messageKey:messageKey(message),...(message.request_id?{requestId:message.request_id}:{}),savedAt:new Date().toISOString()} satisfies MessageFavorite);return true};
  const pending=this.writes.then(job,job);this.writes=pending.catch(()=>{});return pending;
 }
 reconcile(id:number,messages:Message[]):Promise<void>{
  const confirmed=messages.filter(message=>message.request_id&&!String(message.id).startsWith('local-'));if(!confirmed.length)return Promise.resolve();
  const job=async()=>{for(const record of await this.disk.scan<MessageFavorite>(favoritePrefix(id))){const message=confirmed.find(message=>record.requestId&&message.request_id===record.requestId);if(message&&record.messageKey!==messageKey(message))await this.disk.put(record.key,{...record,messageKey:messageKey(message)})}};
  const pending=this.writes.then(job,job);this.writes=pending.catch(()=>{});return pending;
 }
}
export function resolveFavorites(records:MessageFavorite[],messages:Message[]):Message[]{
 return records.map(record=>messages.find(message=>messageKey(message)===record.messageKey)||messages.find(message=>record.requestId&&message.request_id===record.requestId)).filter((message):message is Message=>!!message).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
}
