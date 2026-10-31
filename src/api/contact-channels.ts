import {channels,type Conversation} from './types.ts';
/** One entry of `channels[]` in GET /inbox/mobile/contacts/{id}: an existing conversation (`state:{id}`) or a new one to start. */
export type ChannelOption={key:string;state_id:number|null;asset_id:number;channel:string;name:string;phone?:string|null;address?:string|null;available:boolean;reason:string|null};
/** Sheet label: WhatsApp shows the sending number, e-mail the sending account address (never the contact's). */
export function channelOptionLabel(option:ChannelOption){
 if(option.channel==='email'){const address=option.address?.trim();return [channels.email,option.name,address&&!option.name.includes(address)?address:null].filter(Boolean).join(' · ')}
 return [option.name,option.channel==='whatsapp'?option.phone:null].filter(Boolean).join(' · ');
}
export const startable=(option:ChannelOption)=>!!option.state_id||option.available;
/** A conversation returned by `start` joins the visible list at once (the mock has no detail fetch). */
export function withStarted(conversations:Conversation[],fresh:Conversation){return conversations.some(c=>c.id===fresh.id)?conversations.map(c=>c.id===fresh.id?fresh:c):[fresh,...conversations]}
