import type {Transport} from './types';

/** O fio legível de uma sessão. Propostas de ação não são guardadas: expiram no servidor. */
export type SessionTurn={id:string;role:'user'|'assistant';text:string;tool?:string;conversationId?:number};
export type SessionContext={kind:'conversation'|'contact';id:number};
export type SessionRow={id:number;title:string;agent_key:string;context_kind:'conversation'|'contact'|null;context_id:number|null;turns:number;created:string;updated:string};
export type SessionDetail=SessionRow&{history:SessionTurn[]};

const text=(value:unknown,max:number):string=>typeof value==='string'?value.slice(0,max):'';
const contextKind=(value:unknown):'conversation'|'contact'|null=>value==='conversation'||value==='contact'?value:null;

export function checkedSessionTurns(raw:unknown):SessionTurn[]{
 if(!Array.isArray(raw))return [];
 const turns:SessionTurn[]=[];
 for(const item of raw){
  if(!item||typeof item!=='object')continue;
  const row=item as Record<string,unknown>;
  const role=row.role==='user'||row.role==='assistant'?row.role:null;
  const body=text(row.text,4000);
  if(!role||!body.trim())continue;
  const turn:SessionTurn={id:text(row.id,64)||'turn-'+turns.length,role,text:body};
  const tool=text(row.tool,64);if(tool)turn.tool=tool;
  const conversation=typeof row.conversationId==='number'&&row.conversationId>0?row.conversationId:0;
  if(conversation)turn.conversationId=conversation;
  turns.push(turn);
 }
 return turns;
}

function checkedRow(raw:unknown):SessionRow|null{
 if(!raw||typeof raw!=='object')return null;
 const row=raw as Record<string,unknown>;
 const id=typeof row.id==='number'?row.id:0;
 if(id<=0)return null;
 return {id,title:text(row.title,160),agent_key:text(row.agent_key,100),context_kind:contextKind(row.context_kind),
  context_id:typeof row.context_id==='number'&&row.context_id>0?row.context_id:null,
  turns:typeof row.turns==='number'&&row.turns>0?Math.floor(row.turns):0,
  created:text(row.created,40),updated:text(row.updated,40)};
}

export function checkedSessions(raw:unknown):SessionRow[]{
 const items=raw&&typeof raw==='object'?(raw as {items?:unknown}).items:null;
 if(!Array.isArray(items))return [];
 return items.map(checkedRow).filter((row):row is SessionRow=>row!==null);
}

export function checkedSession(raw:unknown):SessionDetail|null{
 const row=checkedRow(raw);
 if(!row)return null;
 return {...row,history:checkedSessionTurns((raw as {history?:unknown}).history)};
}

/** O título nasce da primeira pergunta; o servidor volta a cortá-lo. */
export const sessionTitle=(question:string):string=>question.replace(/\s+/g,' ').trim().slice(0,80);

const base='/inbox/mobile/assistant/sessions';

export const listSessions=async(api:Transport):Promise<SessionRow[]>=>checkedSessions(await api.request({method:'GET',path:base}));
export const openSession=async(api:Transport,id:number):Promise<SessionDetail|null>=>checkedSession(await api.request({method:'GET',path:`${base}/${id}`}));
export const startSession=async(api:Transport,agentKey:string,title:string,context?:SessionContext):Promise<SessionDetail|null>=>
 checkedSession(await api.request({method:'POST',path:base,body:{agent_key:agentKey,title,...(context?{context}:{})}}));
export const recordSession=async(api:Transport,id:number,turns:SessionTurn[],title?:string):Promise<SessionDetail|null>=>
 checkedSession(await api.request({method:'PUT',path:`${base}/${id}`,body:{turns,...(title?{title}:{})}}));
export const deleteSession=async(api:Transport,id:number):Promise<void>=>{await api.request({method:'DELETE',path:`${base}/${id}`})};
