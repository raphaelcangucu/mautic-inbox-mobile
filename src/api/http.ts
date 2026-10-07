import {ApiError, type Account, type ApiRequest, type Conversation, type Message, type Page, type Session, type Transport} from './types.ts';

export type MobileConfig={version:number;name:string;origin:string;api_base:string;authorization_endpoint:string;token_endpoint:string;magic_code_endpoint?:string;redirect_uri:string;capabilities:Record<string,unknown>};
export function checkedOrigin(value:string){let url:URL;try{url=new URL(value.trim())}catch{throw new ApiError(400,'invalid_url','Informe uma URL HTTPS válida, como https://seu-mautic.com.')}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new ApiError(400,'invalid_url','Informe uma URL HTTPS sem credenciais.');return url.origin+url.pathname.replace(/\/$/,'')}
export async function discover(value:string):Promise<MobileConfig>{const origin=checkedOrigin(value);const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20000);let response:Response;try{response=await fetch(origin+'/inbox/mobile/config',{redirect:'error',signal:abort.signal})}catch{throw new ApiError(0,'discovery_unavailable','Não foi possível acessar este Mautic. Confira a URL e sua conexão.')}finally{clearTimeout(timer)}if(!response.ok)throw new ApiError(response.status,'discovery_failed','Esta instância ainda não oferece a API mobile.');let config:MobileConfig;try{config=await response.json()}catch{throw new ApiError(502,'invalid_config','Este Mautic retornou uma configuração inválida. Tente novamente.')}if(config.version!==1||config.origin!==origin)throw new ApiError(422,'incompatible_api','A configuração retornada não corresponde a esta instância.');for(const key of ['api_base','authorization_endpoint','token_endpoint',...(config.magic_code_endpoint?['magic_code_endpoint']:[])]){try{if(new URL(config[key as keyof MobileConfig] as string).origin!==new URL(origin).origin)throw new Error()}catch{throw new ApiError(422,'invalid_endpoint','A API informou um destino diferente desta instância.')}}return config;}
const timestamp=(value:unknown)=>typeof value==='string'&&value?value:new Date(0).toISOString();
const replyLabels:Record<string,string>={
 'The private reply window for this comment has closed.':'A janela de resposta privada deste comentário foi encerrada.',
 'The WhatsApp free-form reply window has closed. An approved template is required.':'A janela de resposta livre do WhatsApp foi encerrada. Use um template aprovado.',
};
export function apiFailure(status:number,result:unknown){
 const data=result&&typeof result==='object'&&!Array.isArray(result)?result as Record<string,unknown>:{};
 const rawCode=typeof data.code==='string'?data.code:typeof data.error==='string'?data.error:'';
 const code=/^[a-z][a-z0-9_]{0,63}$/.test(rawCode)?rawCode:'api_error';
 const supplied=typeof data.error_description==='string'?data.error_description:typeof data.error==='string'&&!/^[a-z][a-z0-9_]*$/.test(data.error)?data.error:'';
 const fallback=status===401?'Sua sessão expirou. Entre novamente nesta conexão.':status===403?'Seu usuário não tem permissão para esta consulta.':status===429?'O Mautic recebeu muitas consultas. Aguarde um pouco e tente novamente.':status>=500?'O Mautic não conseguiu atualizar os dados. Seu histórico está salvo. Tente novamente.':'O Mautic não confirmou esta operação. Atualize e tente novamente.';
 return new ApiError(status,code,`${supplied||fallback} (HTTP ${status})`);
}
export function conversationFromApi(raw:any,previous?:Conversation):Conversation{
 const kind=raw.kind==='comments'||String(raw.recipient||'').startsWith('comment:')?'comments':'inbox';const source=Array.isArray(raw.origins)?raw.origins[0]:null;const origin=Array.isArray(raw.origins)?{campaign:source?.title||raw.asset?.name||'Atendimento',...(raw.webchat?.page_url?{page:raw.webchat.page_url,utm_source:raw.webchat.utm?.utm_source,utm_campaign:raw.webchat.utm?.utm_campaign}:{})}:raw.origins||previous?.origins||{campaign:raw.asset?.name||'Atendimento'};
 const reason=Object.hasOwn(raw,'reply_blocked_reason')?raw.reply_blocked_reason:previous?.reply_blocked_reason??null;
 return {...previous,...raw,id:Number(raw.id),conversation_id:Number(raw.conversation_id),version:Number(raw.version),channel:raw.channel,kind,contact_name:raw.contact_name||raw.contact_handle||raw.recipient||'Contato',preview:raw.preview||'',avatar_url:raw.avatar_url||null,contact:raw.contact||previous?.contact||null,origins:origin,can_reply:raw.can_reply??previous?.can_reply??false,reply_blocked_reason:replyLabels[reason]||reason,last_message_at:timestamp(raw.last_message_at),updated_at:timestamp(raw.updated_at),mobile:{ai:['active','queued','finishing'].includes(raw.agent?.status),window_open:!reason,attachments:false},...(kind==='comments'?{comment:{...(!Array.isArray(raw.origins)?previous?.comment:{}),postTitle:source?.title?.split('\n')[0]||(!Array.isArray(raw.origins)?previous?.comment?.postTitle:undefined)||'Publicação',postBody:source?.caption||(!Array.isArray(raw.origins)?previous?.comment?.postBody:undefined)||'',commentBody:source?.body||(!Array.isArray(raw.origins)?previous?.comment?.commentBody:undefined)||'',image:source?.image||(!Array.isArray(raw.origins)?previous?.comment?.image:null),permalink:source?.permalink||(!Array.isArray(raw.origins)?previous?.comment?.permalink:undefined)||'',relatedId:source?.related_state_id||(!Array.isArray(raw.origins)?previous?.comment?.relatedId:undefined),canPrivate:raw.channel==='instagram',canPublic:raw.channel==='facebook'||raw.reply_modes?.public!==undefined||previous?.reply_modes?.public!==undefined}}:{})};
}
export function messageFromApi(raw:any):Message{return {...raw,kind:raw.kind||'message',id:raw.id,body:raw.body||'',timestamp:timestamp(raw.timestamp),status:raw.status==='queued'?'pending':raw.status,ai:typeof raw.ai==='object'?raw.ai?.agent_name:raw.ai,...(raw.attachments?.[0]?.url?{attachment:{name:raw.attachments[0].label||'Anexo',uri:raw.attachments[0].url,mime:({image:'image/jpeg',audio:'audio/mpeg',video:'video/mp4',document:'application/pdf'} as Record<string,string>)[raw.attachments[0].type]||'application/octet-stream'}}:{})};}

export class HttpTransport implements Transport {
 private refreshing:Promise<Session>|null=null;private pending=new Set<Promise<unknown>>();private known=new Map<number,Conversation>();
 private failure:{at:string;status:number;code:string;method:string;resource:string}|null=null;
 diagnostic(){return this.failure?{...this.failure}:null}
 forgetConversation(id:number){this.known.delete(id)}
 constructor(readonly account:Account,private read:()=>Promise<Session|null>,private write:(value:Session)=>Promise<void>,private expired:()=>void,private fetcher:typeof fetch=fetch){}
 async mediaSource(uri:string){const url=new URL(uri,this.account.origin);if(url.origin!==new URL(this.account.origin).origin||!/^\/s\/inbox\/api\/media\/[1-9][0-9]*$/.test(url.pathname))return {uri:url.toString()};let session=await this.read();if(!session)throw new ApiError(401,'unauthorized','Entre novamente.');if(session.expiresAt<Date.now()+30000)session=await this.refresh(session);return {uri:this.account.config!.api_base+'/media/'+url.pathname.split('/').at(-1),headers:{Authorization:'Bearer '+session.accessToken}}}
 async settle(){await Promise.allSettled([...this.pending])}
 request<T>(input:ApiRequest):Promise<T>{const task=this.perform<T>(input);this.pending.add(task);void task.then(()=>this.pending.delete(task),error=>{this.pending.delete(task);if(error instanceof ApiError)this.failure={at:new Date().toISOString(),status:error.status,code:/^[a-z][a-z0-9_]{0,63}$/.test(error.code)?error.code:'api_error',method:input.method,resource:input.path.replace(/\/\d+(?=\/|$)/g,'/:id')}});return task}
 private async refresh(session:Session):Promise<Session>{
  if(!this.refreshing)this.refreshing=(async()=>{
   // Other requests can finish a rotation before an older response returns 401.
   const current=await this.read();
   if(!current){this.expired();throw new ApiError(401,'unauthorized','Entre novamente nesta instância.')}
   if(current.accessToken!==session.accessToken&&current.expiresAt>=Date.now()+30000)return current;
   session=current;
   if(!session.refreshToken){this.expired();throw new ApiError(401,'unauthorized','Entre novamente nesta instância.')}
   const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20000);let response:Response;
   try{response=await this.fetcher(this.account.config!.token_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:session.refreshToken}),redirect:'error',signal:abort.signal})}catch{throw new ApiError(0,'network_error','Não foi possível renovar a conexão. Seu histórico está salvo.')}finally{clearTimeout(timer)}
   let token:any;try{token=await response.json()}catch{throw new ApiError(response.status,'invalid_response','A renovação retornou uma resposta inválida. Tente novamente.')}
   if(!response.ok){if((response.status===400&&token.error==='invalid_grant')||response.status===401){this.expired();throw new ApiError(401,'unauthorized','Sessão expirada. Entre novamente.')}throw new ApiError(response.status,'refresh_unavailable','A conexão está temporariamente indisponível. Seu histórico está salvo.')}
   if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string'||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw new ApiError(502,'invalid_token_response','Resposta de renovação inválida.');
   const next={accessToken:token.access_token,refreshToken:token.refresh_token,expiresAt:Date.now()+token.expires_in*1000};await this.write(next);return next;
  })().finally(()=>{this.refreshing=null});return this.refreshing;
 }
 private async raw(input:ApiRequest,retry=true):Promise<any>{let session=await this.read();if(!session){this.expired();throw new ApiError(401,'unauthorized','Entre nesta instância.')}if(session.expiresAt<Date.now()+30000)session=await this.refresh(session);const base=this.account.config!.api_base;let path=input.path.replace(/^\/inbox\/(?:api|mobile)\//,'');const url=new URL(base+'/'+path);for(const [key,value] of Object.entries(input.query||{}))url.searchParams.set(key,String(value));const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),path==='assistant/messages'?115000:20000);
  let response:Response;try{response=await this.fetcher(url.toString(),{method:input.method,headers:{Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json',Accept:'application/json'},...(input.body?{body:JSON.stringify(input.body)}:{}),redirect:'error',signal:abort.signal})}catch{throw new ApiError(0,'network_error','Não foi possível confirmar a resposta do servidor. Seu histórico está salvo.')}finally{clearTimeout(timer)}
  if(response.status===401&&retry){await this.refresh(session);return this.raw(input,false)}let result:any;try{result=await response.json()}catch{throw new ApiError(response.status,'invalid_response',`O Mautic retornou uma resposta inválida (HTTP ${response.status}). Seu histórico está salvo.`)}if(!response.ok){if(response.status===401)this.expired();throw apiFailure(response.status,result)}return result;
 }
 private normalize(raw:any){const c=conversationFromApi(raw,this.known.get(Number(raw.id)));this.known.set(c.id,c);return c}
 private async perform<T>(input:ApiRequest):Promise<T>{
  if(input.path==='/inbox/api/conversations'&&input.method==='GET'){
   const kinds=['private','comments'] as const;
   let cursors:Record<string,string|null>={private:'',comments:''};
   if(input.query?.cursor){try{const saved=JSON.parse(String(input.query.cursor));if(saved.version!==1||!kinds.every(k=>saved[k]===null||typeof saved[k]==='string'))throw Error();cursors=saved}catch{throw new ApiError(400,'invalid_cursor','A paginação expirou. Atualize a lista.')}}
   const lists=await Promise.all(kinds.map(async kind=>{
    if(cursors[kind]===null)return {kind,items:[] as Conversation[],cursor:null};
    const {cursor:ignored,...query}=input.query||{};
    const raw=await this.raw({...input,query:{...query,kind,...(cursors[kind]?{cursor:cursors[kind]!}:{})}});
    const cursor=raw.next_cursor||null;
    if(cursor&&cursor===cursors[kind])throw new ApiError(502,'cursor_loop','A API repetiu uma página de conversas.');
    return {kind,items:raw.items.map((c:any)=>this.normalize({...c,kind:kind==='comments'?'comments':'inbox'})),cursor};
   }));
   const next={version:1,...Object.fromEntries(lists.map(l=>[l.kind,l.cursor]))};
   const complete=lists.every(l=>l.cursor===null);
   return {items:[...new Map<number,Conversation>(lists.flatMap(l=>l.items).map((c:Conversation)=>[c.id,c] as const)).values()],next_cursor:complete?null:JSON.stringify(next),complete} as T;
  }
  const raw=await this.raw(input);
  if(input.path==='/inbox/mobile/notifications')return {...raw,notifications:raw.notifications.map((n:any)=>({...n,conversation:n.conversation?this.normalize(n.conversation):undefined}))} as T;
  if(input.path==='/inbox/api/updates')return {...raw,conversations:raw.conversations.map((c:any)=>this.normalize(c)),timeline:raw.timeline.map(messageFromApi)} as T;
  if(/\/history$/.test(input.path))return {...raw,items:raw.items.map(messageFromApi)} as T;
  if(/\/conversations\/\d+(?:\/(take|state|moderation|email-actions))?$/.test(input.path)||(/\/contacts\/\d+\/start$/.test(input.path)&&input.method==='POST')||(/\/ai$/.test(input.path)&&input.method==='POST'))return this.normalize(raw) as T;
  if(/\/(reply|retry)$/.test(input.path))return {...raw,item:raw.item?messageFromApi(raw.item):undefined,summary:raw.summary?this.normalize(raw.summary):undefined} as T;
  return raw as T;
 }
}
