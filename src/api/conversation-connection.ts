import {channels,type Conversation} from './types.ts';

// Always describes the sending asset, never the contact's recipient phone or e-mail.
export function conversationConnection(c:Conversation){
 const name=c.asset.name?.trim()||`${channels[c.channel]} #${c.asset.id}`;
 const phone=c.channel==='whatsapp'?c.asset.phone?.trim()||'':'';
 const address=c.channel==='email'?c.asset.address?.trim()||'':'';
 return {name,phone,address,label:[name,phone||address].filter(Boolean).join(' · ')};
}
export function conversationSearch(c:Conversation,query:string){
 const {name,phone,address}=conversationConnection(c);
 const text=[c.contact_name,c.contact?.name,c.preview,c.channel==='email'?c.subject:'',c.channel==='email'?c.recipient:'',channels[c.channel],name,phone,address].filter(Boolean).join(' ').toLocaleLowerCase();
 const search=query.trim().toLocaleLowerCase();
 if(text.includes(search))return true;
 const digits=search.replace(/[^0-9]/g,'');
 return !!phone&&digits.length>=3&&/^[+()\d\s.-]+$/.test(search)&&phone.replace(/[^0-9]/g,'').includes(digits);
}
