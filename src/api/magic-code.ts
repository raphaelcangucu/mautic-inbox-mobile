import {t} from '../i18n/engine.ts';
import {ApiError} from './types.ts';
import type {MobileConfig} from './http.ts';
export type MagicChallenge={id:string;verifier:string;challenge:string;email:string;expiresAt:number;resendAt:number};
export async function magicRequest(config:MobileConfig,email:string,proof:{verifier:string;challenge:string},fetcher:typeof fetch=fetch):Promise<MagicChallenge>{
 if(config.capabilities.magic_code_login!==true||!config.magic_code_endpoint)throw new ApiError(422,'magic_unavailable',t("auth.magicUnavailable"));
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),30000);
 try{const response=await fetcher(config.magic_code_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim().toLowerCase(),code_challenge:proof.challenge}),redirect:'error',signal:abort.signal});
  const raw=await response.json();if(!response.ok)throw new ApiError(response.status,raw.error||'request_failed',response.status===429?t("auth.magicRate"):t("auth.magicFailed"));
  if(!/^[a-f0-9]{64}$/.test(raw.request_id)||!Number.isFinite(raw.expires_in)||raw.expires_in<=0||!Number.isFinite(raw.resend_after)||raw.resend_after<0)throw new ApiError(502,'invalid_challenge',t("auth.magicInvalidResponse"));
  return {id:raw.request_id,...proof,email:email.trim().toLowerCase(),expiresAt:Date.now()+raw.expires_in*1000,resendAt:Date.now()+raw.resend_after*1000};
 }finally{clearTimeout(timer)}
}
export async function magicVerify(config:MobileConfig,pending:MagicChallenge,code:string,fetcher:typeof fetch=fetch){
 if(Date.now()>=pending.expiresAt)throw new ApiError(400,'code_expired',t("auth.magicExpired"));
 if(!/^[0-9]{6}$/.test(code))throw new ApiError(400,'invalid_code',t("auth.magicSixDigits"));
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20000);
 try{const response=await fetcher(config.token_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'email_code',request_id:pending.id,code,code_verifier:pending.verifier}),redirect:'error',signal:abort.signal});const raw=await response.json();
  if(!response.ok)throw new ApiError(response.status,raw.error||'login_failed',t("auth.magicInvalid"));
  if(typeof raw.access_token!=='string'||typeof raw.refresh_token!=='string'||!Number.isFinite(raw.expires_in)||raw.expires_in<=0||!Number.isSafeInteger(raw.user?.id)||raw.user.id<1||typeof raw.user.email!=='string')throw new ApiError(502,'invalid_token_response',t("auth.invalidLoginResponse"));
  return {session:{accessToken:raw.access_token,refreshToken:raw.refresh_token,expiresAt:Date.now()+raw.expires_in*1000},user:raw.user as {id:number;name:string;email:string}};
 }finally{clearTimeout(timer)}
}
