import type {Message} from './types.ts';
/** Share operational references, never customer content, recipient, tokens or credentials. */
export function deliveryReport(conversationId:number,assetId:number,message:Message){
 return ['Mautic Inbox — delivery diagnostic','Conversation: '+conversationId,'Channel connection: '+assetId,'Message: '+message.id,'Status: '+message.status,'Attempts: '+(message.attempt_count||1),'Code: '+(message.failure_code||'delivery_failed'),'Timestamp: '+message.timestamp].join('\n');
}
export function newDeliveryFailure(previous:Message[],next:Message[]){
 const statuses=new Map(previous.map(m=>[m.kind+':'+m.id,m.status]));
 return next.find(m=>m.kind==='outbound'&&m.status==='failed'&&statuses.has(m.kind+':'+m.id)&&statuses.get(m.kind+':'+m.id)!=='failed');
}
