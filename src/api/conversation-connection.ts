import {channels,type Conversation} from './types.ts';

// Always describes the sending asset, never the contact's recipient phone.
export function conversationConnection(c:Conversation){
 const name=c.asset.name?.trim()||`${channels[c.channel]} #${c.asset.id}`;
 const phone=c.channel==='whatsapp'?c.asset.phone?.trim()||'':'';
 return {name,phone,label:[name,phone].filter(Boolean).join(' · ')};
}
export function conversationSearch(c:Conversation,query:string){
 const {name,phone}=conversationConnection(c);
 const text=[c.contact_name,c.contact?.name,c.preview,channels[c.channel],name,phone].filter(Boolean).join(' ').toLocaleLowerCase();
 const search=query.trim().toLocaleLowerCase();
 if(text.includes(search))return true;
 const digits=search.replace(/[^0-9]/g,'');
 return !!phone&&digits.length>=3&&/^[+()\d\s.-]+$/.test(search)&&phone.replace(/[^0-9]/g,'').includes(digits);
}
