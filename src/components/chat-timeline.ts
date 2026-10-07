import type {Message} from '../api/types.ts';

/** A display projection only: audit events remain in the repository and cache. */
export function visibleChatMessages(messages:Message[]):Message[]{
 return messages.filter(message=>message.kind!=='event'||!!message.body.trim()||!!message.attachment);
}
export function sameChatDay(a:Message,b:Message):boolean{
 const first=new Date(a.timestamp),second=new Date(b.timestamp);
 return !Number.isNaN(first.getTime())&&!Number.isNaN(second.getTime())&&first.toDateString()===second.toDateString();
}
export function groupChatMessages(previous:Message|undefined,current:Message):boolean{
 if(!previous||!sameChatDay(previous,current))return false;
 const ordinary=(message:Message)=>message.kind==='message'||message.kind==='outbound';
 const outgoing=(message:Message)=>message.kind==='outbound'||message.direction==='outbound';
 const elapsed=Date.parse(current.timestamp)-Date.parse(previous.timestamp);
 return ordinary(previous)&&ordinary(current)&&outgoing(previous)===outgoing(current)
  &&previous.author===current.author&&previous.ai===current.ai&&previous.replyMode===current.replyMode
  &&elapsed>=0&&elapsed<=5*60*1000;
}
