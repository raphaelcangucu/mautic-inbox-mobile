import {AccessCache} from './access-cache.ts';
import {canRetryMessage} from './message-retry.ts';
import {t} from '../i18n/engine.ts';
import type {Storage} from '../storage/interface.ts';
import {ApiError, messageKey, defaultView, type Conversation, type Message, type Outbox, type Page, type Transport, type ViewState} from './types.ts';
export class InboxRepository {
  private work=new Set<Promise<unknown>>();
  private retries=new Map<string,Promise<'registered'|'already_registered'>>();
  readonly disk:Storage;readonly api:Transport;readonly access:AccessCache;
  constructor(disk:Storage,api:Transport,onRevoked?:(id:number)=>void){
    this.access=new AccessCache(disk,api,onRevoked);this.disk=this.access.disk;this.api=this.access.api;
    // Logout waits for complete repository operations, including their cache writes.
    for(const key of ['list','more','detail','history','poll','transition','send','retryMessage','recover','refreshHistory'] as const){
      const original=this[key].bind(this) as (...args:any[])=>Promise<any>;
      (this as any)[key]=(...args:any[])=>{const task=original(...args);this.work.add(task);void task.then(()=>this.work.delete(task),()=>this.work.delete(task));return task};
    }
  }
  async settle(){await Promise.allSettled([...this.work])}
  async cachedList(){const all=await this.disk.scan<Conversation>('conversation:');const ids=await this.disk.get<number[]>('sync:list-ids');return (ids?all.filter(c=>ids.includes(c.id)):all).sort((a,b)=>b.last_message_at.localeCompare(a.last_message_at)||b.id-a.id)}
  async cachedMessages(id:number){return (await this.disk.scan<Message>('message:'+id+':')).sort((a,b)=>a.timestamp.localeCompare(b.timestamp))}
  async saveConversations(items:Conversation[]){for(const c of items)await this.disk.put('conversation:'+c.id,c)}
  async saveMessages(id:number,items:Message[]){for(const m of items)await this.disk.put('message:'+id+':'+messageKey(m),m)}
  async view(){return {...defaultView(),...await this.disk.get<ViewState>('ui:view')}}
  private async listBatch(cursor:string|null,limit:number){
    const items:Conversation[]=[];const seen=new Set<string>();let complete=true;
    do{if(cursor){if(seen.has(cursor))throw new ApiError(502,'cursor_loop','A API repetiu uma página de conversas.');seen.add(cursor)}
      const p=await this.api.request<Page<Conversation>>({method:'GET',path:'/inbox/api/conversations',query:{queue:'all',lifecycle:'all',limit:50,...(cursor?{cursor}:{})}});
      items.push(...p.items);cursor=p.next_cursor;complete=p.complete!==false;
    }while(cursor&&items.length<limit);
    return {items,cursor,complete:complete&&!cursor};
  }
  private async persistList(items:Conversation[],cursor:string|null,complete:boolean){
    items.sort((a,b)=>b.last_message_at.localeCompare(a.last_message_at)||b.id-a.id);await this.saveConversations(items);await this.disk.put('sync:list-ids',items.map(c=>c.id));await this.disk.put('sync:list-cursor',cursor);await this.disk.put('sync:list-complete',complete);await this.disk.put('sync:last',Date.now());return items;
  }
  async list(){const previous=(await this.disk.scan<Conversation>('conversation:')).map(c=>c.id);const batch=await this.listBatch(null,Math.max(200,previous.length));if(batch.complete)await this.access.completeList(batch.items.map(c=>c.id),previous);return this.persistList([...new Map(batch.items.map(c=>[c.id,c])).values()],batch.cursor,batch.complete)}
  async more(){const cursor=await this.disk.get<string>('sync:list-cursor');if(!cursor)return this.cachedList();const previous=await this.cachedList();const batch=await this.listBatch(cursor,200);const items=[...new Map([...previous,...batch.items].map(c=>[c.id,c])).values()].sort((a,b)=>b.last_message_at.localeCompare(a.last_message_at)||b.id-a.id);return this.persistList(items,batch.cursor,batch.complete)}
  async detail(id:number){const c=await this.api.request<Conversation>({method:'GET',path:`/inbox/api/conversations/${id}`});await this.saveConversations([c]);return c}
  async history(id:number,before?:string){const p=await this.api.request<Page<Message>>({method:'GET',path:`/inbox/api/conversations/${id}/history`,query:{limit:40,...(before?{before}:{})}});await this.saveMessages(id,p.items);await this.reconcile(id,p.items);if(!before)await this.disk.put('cursor:'+id,p.next_cursor);return p}
  async refreshHistory(id:number){const previous=await this.cachedMessages(id);const known=new Set(previous.map(messageKey));let page=await this.history(id);let cursor=page.next_cursor;let count=0;while(previous.length&&cursor&&!page.items.some(m=>known.has(messageKey(m)))&&count++<20){page=await this.history(id,cursor);cursor=page.next_cursor}return this.cachedMessages(id)}
  async poll(id?:number){const p=await this.api.request<{conversations:Conversation[];timeline:Message[];next_since:string;has_more:boolean}>({method:'GET',path:'/inbox/api/updates',query:{since:await this.disk.get<string>('sync:since')||'',...(id?{state_id:id}:{})}});await this.saveConversations(p.conversations);if(id){await this.saveMessages(id,p.timeline);await this.reconcile(id,p.timeline)}await this.disk.put('sync:since',p.next_since);await this.disk.put('sync:last',Date.now());return p}
  async transition(id:number,version:number,action:string,payload:Record<string,unknown>={}){const c=await this.api.request<Conversation>({method:'POST',path:`/inbox/api/conversations/${id}/${action==='take'?'take':'state'}`,body:action==='take'?{version}:{version,action,...payload}});await this.saveConversations([c]);return c}
  async send(entry:Outbox){
    await this.disk.put('outbox:'+entry.request_id,entry);
    const optimistic:Message={kind:entry.mode==='note'?'note':'outbound',id:'local-'+entry.request_id,body:entry.body,request_id:entry.request_id,timestamp:entry.timestamp,direction:'outbound',status:'sending',attachment:entry.attachment};
    await this.saveMessages(entry.conversationId,[optimistic]);
    try{
      const result=await this.api.request<{item?:Message;summary?:Conversation;id?:number}>({method:'POST',path:`/inbox/api/conversations/${entry.conversationId}/${entry.mode}`,body:{body:entry.body,...(entry.mode==='reply'?{request_id:entry.request_id}:{}),...(entry.template_id?{template_id:entry.template_id,variables:entry.variables}:{}),...(entry.attachment?{attachment:entry.attachment}:{}),...(entry.replyMode?{reply_mode:entry.replyMode}:{})}});
      // Existing note response supplies id/saved; item is an explicitly documented mock addition.
      const item=result.item||{...optimistic,id:result.id!,status:undefined};
      await this.saveMessages(entry.conversationId,[item]);await this.disk.remove('message:'+entry.conversationId+':'+messageKey(optimistic));await this.disk.remove('outbox:'+entry.request_id);if(result.summary)await this.saveConversations([result.summary]);return result;
    }catch(e){const status=e instanceof ApiError&&e.status>=400&&e.status<500?'failed':'uncertain';await this.disk.put('outbox:'+entry.request_id,{...entry,status});await this.saveMessages(entry.conversationId,[{...optimistic,status}]);throw e}
  }
  async recover(){for(const entry of await this.disk.scan<Outbox>('outbox:'))if(entry.status==='sending'){await this.disk.put('outbox:'+entry.request_id,{...entry,status:'uncertain'});const messages=await this.cachedMessages(entry.conversationId);await this.saveMessages(entry.conversationId,messages.filter(m=>m.request_id===entry.request_id).map(m=>({...m,status:'uncertain'})))}}
  async reconcile(id:number,items:Message[]){for(const entry of await this.disk.scan<Outbox>('outbox:')){if(entry.conversationId!==id||entry.mode!=='reply')continue;const confirmed=items.find(m=>m.request_id===entry.request_id&&!String(m.id).startsWith('local-'));if(confirmed){await this.disk.remove('message:'+id+':outbound:local-'+entry.request_id);await this.disk.remove('outbox:'+entry.request_id)}}}
  retryMessage(id:number,message:Message,newRequestId:string):Promise<'registered'|'already_registered'>{
    const key=id+':'+messageKey(message);const existing=this.retries.get(key);if(existing)return existing;
    const task=this.retryChecked(id,message,newRequestId);this.retries.set(key,task);
    void task.then(()=>this.retries.delete(key),()=>this.retries.delete(key));return task;
  }
  private async retryChecked(id:number,message:Message,newRequestId:string):Promise<'registered'|'already_registered'>{
    if(!canRetryMessage(message))throw new ApiError(409,'not_retryable',t('chat.retryUnavailable'));
    const local=String(message.id).startsWith('local-');
    const entry=local?await this.disk.get<Outbox>('outbox:'+message.request_id):null;
    if(local&&(!entry||entry.conversationId!==id||entry.mode!=='reply'))throw new ApiError(409,'not_retryable',t('chat.retryUnavailable'));
    const retryKey='retry:'+id+':'+messageKey(message);
    const saved=await this.disk.get<{request_id:string;key:string}>(retryKey);
    let remote:Message|undefined;let attempted:Message|undefined;let cursor:string|null=null;
    const receipts:Message[]=[];
    const seen=new Set<string>();
    // Read fresh receipts first. A timeout is never permission to send another copy.
    for(let page=0;page<100;page++){
      const history=await this.history(id,cursor||undefined);
      receipts.push(...history.items);
      remote=history.items.find(item=>!String(item.id).startsWith('local-')&&(messageKey(item)===messageKey(message)||(!!message.request_id&&item.request_id===message.request_id)));
      attempted=history.items.find(item=>saved&&item.request_id===saved.request_id)||attempted;
      cursor=history.next_cursor;
      if(remote||!cursor)break;
      if(seen.has(cursor)||page===99)throw new ApiError(502,'history_incomplete',t('chat.retryHistoryIncomplete'));
      seen.add(cursor);
    }
    if(attempted)return 'already_registered';
    if(remote){
      // Another device or the web Inbox may have retried this source already.
      // Refresh the displayed receipt instead of issuing another send from a stale bubble.
      if(receipts.some(item=>item.kind==='outbound'&&item.retry_of===remote!.request_id&&item.body===remote!.body))return 'already_registered';
      if(remote.status!=='failed')return 'already_registered';
      if(remote.retryable!==true)throw new ApiError(409,'not_retryable',t('chat.retryUnavailable'));
      const remoteRetryKey='retry:'+id+':'+messageKey(remote);
      const canonical=remoteRetryKey===retryKey?saved:await this.disk.get<{request_id:string;key:string}>(remoteRetryKey);
      const requestId=canonical?.request_id||newRequestId;
      // Persist before posting so a lost response or restart keeps the SAME retry ID.
      await this.disk.put(remoteRetryKey,{request_id:requestId,key:messageKey(remote)});
      const result=await this.api.request<{item:Message;summary?:Conversation}>({method:'POST',path:`/inbox/api/outbound/${remote.id}/retry`,body:{request_id:requestId}});
      if(!result.item)throw new ApiError(502,'invalid_retry_response',t('chat.retryHistoryIncomplete'));
      const otherDevice=result.item.request_id!==requestId;
      if(otherDevice&&(result.item.kind!=='outbound'||result.item.retry_of!==remote.request_id||result.item.body!==remote.body))throw new ApiError(502,'invalid_retry_response',t('chat.retryHistoryIncomplete'));
      await this.saveMessages(id,[result.item]);if(result.summary)await this.saveConversations([result.summary]);
      if(result.item.status==='failed')throw new ApiError(422,'delivery_failed',result.item.failure||t('chat.retryUnavailable'));
      return otherDevice?'already_registered':'registered';
    }
    if(!local)throw new ApiError(409,'not_retryable',t('chat.retryUnavailable'));
    await this.send({...entry!,status:'sending'});return 'registered';
  }
  async isRevoked(id:number){return this.access.isRevoked(id)}
  async drafts(id:number,mode:'reply'|'note'){return await this.disk.get<string>('draft:'+id+':'+mode)||''}
}
