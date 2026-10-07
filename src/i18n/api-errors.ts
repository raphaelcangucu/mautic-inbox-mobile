import {t,type TranslationKey} from './engine.ts';
const errorKeys:Record<string,TranslationKey>=Object.fromEntries([
 'invalid_kind','invalid_canned','action','unavailable','no_agent','assigned','agent','email','contact_conflict','target','offline','user','until','invalid_body','request_id','template','variables','attachment','uncertain',
 'invalid_url','discovery_unavailable','discovery_failed','invalid_config','incompatible_api','invalid_endpoint','unauthorized','forbidden','network_error','invalid_response','refresh_unavailable','invalid_token_response','invalid_cursor','cursor_loop','access_revoked','version_conflict','not_found','window_closed','private_unavailable','moderated','unsupported_media','unsupported_reply_mode','not_comment','invalid_request','social_comment_unavailable','moderation_unavailable',
].map(code=>[code,('error.'+code) as TranslationKey]));
Object.assign(errorKeys,{method:'error.action',unsupported_action:'error.action',spam:'reply.spam',resolved:'reply.resolved',invalid_catalogue:'crm.invalidResponse',native_required:'auth.nativeRequired',login_cancelled:'auth.notCompleted',device_login_failed:'auth.deviceFailed',device_expired:'auth.deviceExpired',magic_unavailable:'auth.magicUnavailable',code_expired:'auth.magicExpired',invalid_code:'auth.magicSixDigits',invalid_challenge:'auth.magicInvalidResponse'});
/** Server error codes select UI text; no customer content or untrusted server details is translated. */
export function apiErrorText(code:string,status:number):string|null{
 const key=errorKeys[code];if(key)return t(key);
 if(code!=='api_error'&&code!=='inbox_error')return null;
 return t(status===401?'error.unauthorized':status===403?'error.forbidden':status===429?'error.rate_limit':status>=500?'error.server':'error.api_error');
}
const reasons:Record<string,TranslationKey>={
 'The private reply window for this comment has closed.':'error.private_unavailable',
 'A janela de resposta privada deste comentário foi encerrada.':'error.private_unavailable',
 'The WhatsApp free-form reply window has closed. An approved template is required.':'error.window_closed',
 'A janela de resposta livre do WhatsApp foi encerrada. Use um template aprovado.':'error.window_closed',
};
export function replyReason(reason:string|null){return reason&&reasons[reason]?t(reasons[reason]):reason}
