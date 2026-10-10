import type {Message} from './types.ts';
export function canRetryMessage(message:Message){
  if(message.kind!=='outbound')return false;
  if(String(message.id).startsWith('local-'))return !!message.request_id&&(message.status==='failed'||message.status==='uncertain');
  return message.status==='failed'&&message.retryable===true;
}
