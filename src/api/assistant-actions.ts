export type AssistantProposal = {
 id:string;agent_key:string;expires_at:string;
 tool:'mautic_reply_inbox'|'campaign_update'|'campaign_add_contacts'|'inbox_transfer';
 target:{id:number;name:string;channel:string};
 fields:{body?:string;mode?:'public'|'private';take_attendance?:boolean;name?:string;description?:string;allowRestart?:boolean;contacts?:{id:number;name:string}[];may_trigger_campaign?:boolean;user_id?:number;user_name?:string};
 before?:Record<string,unknown>;
};
const tools=['mautic_reply_inbox','campaign_update','campaign_add_contacts','inbox_transfer'];
export function checkedAssistantProposals(raw:unknown,agentKey:string):AssistantProposal[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>3)throw Error('Invalid assistant actions');
 const seen=new Set<string>();
 for(const p of raw){
  if(!p||typeof p!=='object'||!/^\w{48}$/.test(p.id)||!/^[a-f0-9]+$/.test(p.id)||p.agent_key!==agentKey||!tools.includes(p.tool)||!Number.isFinite(Date.parse(p.expires_at))||!Number.isInteger(p.target?.id)||p.target.id<1||typeof p.target.name!=='string'||typeof p.target.channel!=='string'||!p.fields||typeof p.fields!=='object'||Array.isArray(p.fields)||seen.has(p.id))throw Error('Invalid assistant actions');
  if(p.tool==='mautic_reply_inbox'&&(typeof p.fields.body!=='string'||!p.fields.body.trim()||!['public','private'].includes(p.fields.mode)))throw Error('Invalid assistant reply');
  seen.add(p.id);
 }
 return raw;
}
export function assistantConfirmation(proposal:AssistantProposal,agentKey:string,now=Date.now()){
 if(proposal.agent_key!==agentKey||Date.parse(proposal.expires_at)<=now)throw Error('Assistant action expired');
 return {proposal_id:proposal.id,agent_key:agentKey,confirm:true};
}
