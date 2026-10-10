import type {Message} from '../api/types.ts';

/** A display projection only: audit events remain in the repository and cache. */
export function visibleChatMessages(messages:Message[]):Message[]{
 const visible=messages.filter(message=>message.kind!=='event'||!!message.body.trim()||!!message.attachment);
 const byRequest=new Map(visible.filter(m=>m.kind==='outbound'&&m.request_id).map(m=>[m.request_id!,m]));
 const groups=new Map<string,Message[]>();
 const rootOf=(message:Message)=>{
  let root=message;const seen=new Set<string>();
  while(root.retry_of){if(seen.has(root.retry_of))return message;seen.add(root.retry_of);const parent=byRequest.get(root.retry_of);if(!parent||parent.body!==message.body)break;root=parent}
  return root;
 };
 for(const m of visible){const root=rootOf(m);const key=root.kind+':'+root.id;groups.set(key,[...(groups.get(key)||[]),m])}
 const emitted=new Set<string>();const rows:Message[]=[];
 for(const m of visible){const root=rootOf(m);const key=root.kind+':'+root.id;if(emitted.has(key))continue;emitted.add(key);
  const attempts=groups.get(key)!;const latest=attempts.reduce((a,b)=>Date.parse(b.timestamp)>Date.parse(a.timestamp)||(b.timestamp===a.timestamp&&Number(b.id)>Number(a.id))?b:a);
  rows.push(attempts.length>1?{...latest,display_id:root.id,timestamp:root.timestamp,attempt_count:attempts.length}:m);
 }
 return rows;
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
