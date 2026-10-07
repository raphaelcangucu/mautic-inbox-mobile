import {t} from '../i18n/engine.ts';
import type {Conversation,Transport} from './types.ts';

export const moderationAuthor=(c:Conversation)=>`${c.channel}:${c.asset.id}:${c.recipient}`;
export function mergeModeration(conversations:Conversation[],fresh:Conversation){
 if(fresh.kind!=='comments')return conversations;
 return conversations.map(p=>p.id===fresh.id?fresh:p.kind==='comments'&&fresh.moderation?.blockedAuthor&&moderationAuthor(p)===moderationAuthor(fresh)?{...p,moderation:{spam:!!p.moderation?.spam,hidden:!!p.moderation?.hidden,blockedAuthor:true}}:p);
}

/** Uses the operator's normal API; hiding is confirmed by the server against Instagram. */
export async function moderateSelection(api:Transport,selected:Conversation[],action:'spam'|'block'|'spam_block'|'hide',valid:()=>boolean,updated:(c:Conversation)=>Promise<void>,progress:(done:number,total:number)=>void){
 const comments=[...new Map(selected.filter(c=>c.kind==='comments').map(c=>[c.id,c])).values()];
 const pending=comments.filter(c=>action==='spam'?!c.moderation?.spam:action==='hide'?!c.moderation?.hidden:action==='block'?!c.moderation?.blockedAuthor:!c.moderation?.spam||!c.moderation?.blockedAuthor);
 const targets=action==='block'?[...new Map(pending.map(c=>[moderationAuthor(c),c])).values()]:pending;
 let done=0;let next=0;const blocked=new Set<string>();const failures:{id:number;message:string}[]=[];
 async function process(target:Conversation){
  if(!valid()){failures.push({id:target.id,message:t("moderation.accountChanged")});return;}
  try{
   let fresh=await api.request<Conversation>({method:'GET',path:`/inbox/api/conversations/${target.id}`});
   if(!valid())return;
   if(fresh.id!==target.id||fresh.kind!=='comments'||moderationAuthor(fresh)!==moderationAuthor(target))throw new Error(t("moderation.changed"));
   if(action==='hide'&&fresh.channel!=='instagram')throw new Error(t("moderation.instagramOnly"));
   for(const operation of action==='spam_block'?['spam','block']: [action]){
    if(!valid())return;
    if(operation==='spam'&&fresh.moderation?.spam)continue;
    if(operation==='hide'&&fresh.moderation?.hidden)continue;
    if(operation==='block'&&(fresh.moderation?.blockedAuthor||blocked.has(moderationAuthor(fresh))))continue;
    fresh=await api.request<Conversation>({method:'POST',path:`/inbox/api/conversations/${fresh.id}/moderation`,body:{action:operation,version:fresh.version}});
    if(operation==='block')blocked.add(moderationAuthor(fresh));
    if(valid())await updated(fresh);
   }
   if(!valid())return;
   done++;
  }catch(error){failures.push({id:target.id,message:error instanceof Error?error.message:String(error)});}
  progress(done,targets.length);
 }
 // Only independent remote comment hiding is concurrent. Author mutations stay ordered.
 async function worker(){while(next<targets.length&&valid()){const target=targets[next++];await process(target);}}
 await Promise.all(Array.from({length:action==='hide'?Math.min(3,targets.length):1},()=>worker()));
 return {done,total:targets.length,failures};
}
