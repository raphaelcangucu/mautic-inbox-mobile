export type AssistantProposal = {
 id:string;agent_key:string;expires_at:string;
 tool:'mautic_reply_inbox'|'campaign_update'|'campaign_add_contacts'|'inbox_transfer'|'inbox_moderate';
 target:{id:number;name:string;channel:string};
 fields:{operation?:'spam'|'restore'|'block'|'unblock'|'hide'|'show';reason?:string;account?:string;scope?:'inbox'|'instagram';body?:string;mode?:'public'|'private';take_attendance?:boolean;name?:string;description?:string;allowRestart?:boolean;contacts?:{id:number;name:string}[];may_trigger_campaign?:boolean;user_id?:number;user_name?:string};
 before?:Record<string,unknown>;
};
export const assistantSupportedActions=['inbox_moderate'];
const tools=['inbox_moderate','mautic_reply_inbox','campaign_update','campaign_add_contacts','inbox_transfer'];
export function checkedAssistantProposals(raw:unknown,agentKey:string):AssistantProposal[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>20)throw Error('Invalid assistant actions');
 const seen=new Set<string>();let writes=0;const targets=new Set<number>();
 for(const p of raw){
  if(!p||typeof p!=='object'||!/^\w{48}$/.test(p.id)||!/^[a-f0-9]+$/.test(p.id)||p.agent_key!==agentKey||!tools.includes(p.tool)||!Number.isFinite(Date.parse(p.expires_at))||!Number.isInteger(p.target?.id)||p.target.id<1||typeof p.target.name!=='string'||typeof p.target.channel!=='string'||!p.fields||typeof p.fields!=='object'||Array.isArray(p.fields)||seen.has(p.id))throw Error('Invalid assistant actions');
  if(p.tool==='mautic_reply_inbox'&&(typeof p.fields.body!=='string'||!p.fields.body.trim()||!['public','private'].includes(p.fields.mode)))throw Error('Invalid assistant reply');
  if(p.tool==='inbox_moderate'){
   if(!['spam','restore','block','unblock','hide','show'].includes(p.fields.operation)||typeof p.fields.reason!=='string'||!p.fields.reason.trim()||typeof p.fields.body!=='string'||!p.fields.body.trim()||typeof p.fields.account!=='string'||!['inbox','instagram'].includes(p.fields.scope)||!['instagram','facebook'].includes(p.target.channel)||targets.has(p.target.id)||(['hide','show'].includes(p.fields.operation)?p.target.channel!=='instagram'||p.fields.scope!=='instagram':p.fields.scope!=='inbox'))throw Error('Invalid assistant moderation');
   targets.add(p.target.id);
  }else if(++writes>3)throw Error('Too many assistant write actions');
  seen.add(p.id);
 }
 return raw;
}
export function assistantConfirmation(proposal:AssistantProposal,agentKey:string,now=Date.now()){
 if(proposal.agent_key!==agentKey||Date.parse(proposal.expires_at)<=now)throw Error('Assistant action expired');
 return {proposal_id:proposal.id,agent_key:agentKey,confirm:true};
}
