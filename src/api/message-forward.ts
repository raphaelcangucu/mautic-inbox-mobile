import type {Conversation} from './types.ts';
/** Existing drafts are preserved and forwarding never sends anything by itself. */
export function forwardedDraft(draft:string,body:string){if(!body.trim())throw Error('forward_empty');const result=draft.trim()?draft+'\n\n'+body:body;if(result.length>4000)throw Error('forward_too_long');return result}
export function forwardTargets(conversations:Conversation[],sourceId:number,query:string){const search=query.trim().toLocaleLowerCase();return conversations.filter(c=>c.id!==sourceId&&c.kind!=='comments'&&!c.moderation?.spam&&!c.moderation?.blockedAuthor&&(!search||[c.contact_name,c.asset.name,c.asset.phone||'',c.recipient].some(value=>value.toLocaleLowerCase().includes(search))))}
