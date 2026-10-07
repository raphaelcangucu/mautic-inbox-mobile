import {t} from '../i18n/engine.ts';
import {replyReason} from '../i18n/api-errors.ts';
import type {Conversation} from './types.ts';
export function initialReplyMode(conversation?:Conversation):'public'|'private'{
 return conversation?.kind==='comments'&&conversation.comment?.canPublic?'public':'private';
}
export function replyState(conversation:Conversation,mode:'public'|'private'){
 return conversation.reply_modes?.[mode]||{available:conversation.mobile.window_open,can_reply:conversation.can_reply,blocked_reason:conversation.reply_blocked_reason};
}
export function replyAccess(conversation:Conversation,mode:'public'|'private',userId:number,live:boolean){
 const reply=replyState(conversation,mode);
 const other=!!conversation.assignee&&conversation.assignee.id!==userId;
 const take=live&&conversation.assignee?.id!==userId&&(conversation.can_take??conversation.can_take_and_reply??false);
 let reason:string|null=null;
 if(conversation.moderation?.blockedAuthor)reason=t("reply.blockedAuthor");
 else if(conversation.moderation?.spam)reason=t("reply.spam");
 else if(conversation.lifecycle==='resolved')reason=t("reply.resolved");
 else if(!reply.available)reason=replyReason(reply.blocked_reason)||t("reply.unavailable");
 else if(other)reason=t("reply.assigned",{name:conversation.assignee!.name,action:take?t("reply.take"):t("reply.transfer")});
 else if(live&&!reply.can_reply)reason=conversation.assignee?t("reply.noPermission"):t("reply.take");
 return {reply,take,reason,blocked:!!reason};
}
