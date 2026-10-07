import {ApiError,type ApiRequest,type Conversation,type Transport} from './types.ts';
import type {Storage} from '../storage/interface.ts';

type Revocation={id:number};
/** Serializes account-local cache writes so late responses cannot restore revoked data. */
export class AccessCache {
 private revoked=new Map<number,number>();
 private revision=0;
 private epochs=new Map<number,number>();
 private ready:Promise<void>;
 private writes:Promise<unknown>=Promise.resolve();
 readonly disk:Storage;
 readonly api:Transport;
 constructor(private raw:Storage,private transport:Transport,private onRevoked:(id:number)=>void=()=>{}){
  this.ready=raw.scan<Revocation>('access:revoked:').then(async items=>{for(const {id} of items){if(!this.revoked.has(id))this.revoked.set(id,0);await this.purge(id)}});
  const serial=<T>(job:()=>Promise<T>)=>{const pending=this.writes.then(job,job);this.writes=pending.catch(()=>{});return pending;};
  const conversationKey=(key:string,value?:any)=>{
   const match=/^(?:conversation|message|draft|cursor):(\d+)(?::|$)/.exec(key);
   return match?Number(match[1]):key.startsWith('outbox:')?Number(value?.conversationId)||0:0;
  };
  this.disk={
   get:async<T>(key:string)=>{await this.ready;await this.writes;const id=conversationKey(key);return id&&this.revoked.has(id)?null:raw.get<T>(key)},
   scan:async<T>(prefix:string)=>{await this.ready;await this.writes;const denied=/^message:(\d+):/.exec(prefix);if(denied&&this.revoked.has(Number(denied[1])))return [];const items=await raw.scan<T>(prefix);return prefix==='conversation:'?items.filter(item=>!this.revoked.has((item as Conversation).id)):prefix==='outbox:'?items.filter(item=>!this.revoked.has((item as any).conversationId)):items},
   put:async(key,value)=>{await this.ready;const id=conversationKey(key,value);const started=this.revision;return serial(async()=>{if(id&&(this.revoked.has(id)||(this.epochs.get(id)??-1)>started||await raw.get('access:revoked:'+id)))return;await raw.put(key,value)})},
   remove:async key=>{await this.ready;return serial(()=>raw.remove(key))},clear:async()=>{await this.ready;return serial(async()=>{await raw.clear();this.revoked.clear()})},close:async()=>{await this.ready;await this.writes;await raw.close()},
  };
  this.api={request:async<T>(request:ApiRequest)=>{
   await this.ready;const started=this.revision;
   const match=/\/conversations\/(\d+)(?:\/(.*))?$/.exec(request.path);const id=match?Number(match[1]):0;
   let response:T;
   try{response=await transport.request<T>(request)}catch(error){
    // A denied read proves loss of view access; a denied write may only lack edit rights.
    if(id&&error instanceof ApiError&&(request.method==='GET'&&(!match?.[2]||match[2]==='history')&&[403,404].includes(error.status)))await this.revoke(id);
    throw error;
   }
   const fresh=async(item:any):Promise<boolean>=>{
    if(!item||typeof item!=='object'||!Number.isSafeInteger(item.id)||!('can_reply' in item))return true;
    if(item.access_revoked===true){await this.revoke(item.id);return false;}
    if((this.epochs.get(item.id)??-1)>started){(transport as Transport&{forgetConversation?:(id:number)=>void}).forgetConversation?.(item.id);return false;}
    const at=this.revoked.get(item.id);
    if(at!==undefined){this.revoked.delete(item.id);await serial(()=>raw.remove('access:revoked:'+item.id));}
    return true;
   };
   const data=response as any;
   if(data&&typeof data==='object'){
    if(!await fresh(data)){(transport as Transport&{forgetConversation?:(id:number)=>void}).forgetConversation?.(data.id);throw new ApiError(403,'access_revoked','Conversation access revoked.');}
    if(data.summary&&!await fresh(data.summary))throw new ApiError(403,'access_revoked','Conversation access revoked.');
    if(Array.isArray(data.conversations))data.conversations=(await Promise.all(data.conversations.map(async(item:any)=>await fresh(item)?item:null))).filter(Boolean);
    if(/\/conversations$/.test(request.path)&&Array.isArray(data.items))data.items=(await Promise.all(data.items.map(async(item:any)=>await fresh(item)?item:null))).filter(Boolean);
   }
   if(id&&(this.epochs.get(id)??-1)>started){(transport as Transport&{forgetConversation?:(id:number)=>void}).forgetConversation?.(id);throw new ApiError(403,'access_revoked','Conversation access revoked.');}
   return response;
  }};
 }
 async isRevoked(id:number){await this.ready;return this.revoked.has(id)}
 async revoke(id:number){
  await this.ready;
  if(this.revoked.has(id))return;
  (this.transport as Transport&{forgetConversation?:(id:number)=>void}).forgetConversation?.(id);
  this.revoked.set(id,++this.revision);this.epochs.set(id,this.revision);this.onRevoked(id);
  const job=()=>this.purge(id);
  const pending=this.writes.then(job,job);this.writes=pending.catch(()=>{});await pending;
 }
 private async purge(id:number){
   await this.raw.put('access:revoked:'+id,{id});
   await this.raw.remove('conversation:'+id);
   for(const message of await this.raw.scan<any>('message:'+id+':'))await this.raw.remove('message:'+id+':'+message.kind+':'+message.id);
   await this.raw.remove('draft:'+id+':reply');await this.raw.remove('draft:'+id+':note');await this.raw.remove('cursor:'+id);
   for(const entry of await this.raw.scan<any>('outbox:'))if(entry.conversationId===id)await this.raw.remove('outbox:'+entry.request_id);
   const ids=await this.raw.get<number[]>('sync:list-ids');if(ids)await this.raw.put('sync:list-ids',ids.filter(value=>value!==id));
   const view=await this.raw.get<any>('ui:view');if(view){if(view.lastChat===id)delete view.lastChat;if(view.chatOffsets)delete view.chatOffsets[id];if(view.chatAnchors)delete view.chatAnchors[id];await this.raw.put('ui:view',view)}
 }
 /** Only an exhaustive, unfiltered authoritative list can revoke missing cached IDs. */
 async completeList(ids:number[],startedIds:number[]){const present=new Set(ids);for(const id of startedIds)if(!present.has(id))await this.revoke(id)}
}
