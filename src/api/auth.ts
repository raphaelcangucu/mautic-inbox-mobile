import {t} from '../i18n/engine.ts';
import {AuthRequest,ResponseType} from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {Platform} from 'react-native';
import {ApiError,type Session} from './types';
import type {MobileConfig} from './http';
import {customTabsBrowser} from './custom-tabs';
WebBrowser.maybeCompleteAuthSession();
export type LoginResult={session:Session;user:{id:number;name:string;email:string}};
function result(raw:any):LoginResult{return {session:{accessToken:raw.access_token,refreshToken:raw.refresh_token,expiresAt:Date.now()+raw.expires_in*1000},user:raw.user}}
export async function browserLogin(config:MobileConfig):Promise<LoginResult>{
 if(Platform.OS==='web')throw new ApiError(422,'native_required',t("auth.nativeRequired"));
 const auth=new AuthRequest({clientId:'mautic-inbox-native',redirectUri:config.redirect_uri,responseType:ResponseType.Code,usePKCE:true,state:Crypto.randomUUID()});
 const options:{preferEphemeralSession:boolean;browserPackage?:string}={preferEphemeralSession:true};
 if(Platform.OS==='android'){
  options.browserPackage=customTabsBrowser(await WebBrowser.getCustomTabsSupportingBrowsersAsync());
  if(!options.browserPackage)throw new ApiError(422,'native_browser_unavailable',t("auth.browserUnavailable"));
 }
 const response=await auth.promptAsync({authorizationEndpoint:config.authorization_endpoint},options);
 if(response.type!=='success'||response.params.state!==auth.state||!response.params.code)throw new ApiError(401,'login_cancelled',t("auth.notCompleted"));
 const token=await fetch(config.token_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',code:response.params.code,code_verifier:auth.codeVerifier,redirect_uri:config.redirect_uri}),redirect:'error'});if(!token.ok)throw new ApiError(token.status,'login_failed',t("auth.refused"));return result(await token.json());
}
export async function deviceLogin(config:MobileConfig,onCode:(value:{code:string;url:string})=>void,signal:AbortSignal):Promise<LoginResult>{
 const auth=new AuthRequest({clientId:'mautic-inbox-native',redirectUri:config.redirect_uri,responseType:ResponseType.Code,usePKCE:true,state:Crypto.randomUUID()});await auth.makeAuthUrlAsync({authorizationEndpoint:config.authorization_endpoint});
 const start=await fetch(config.origin+'/inbox/mobile/device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code_challenge:auth.codeChallenge}),redirect:'error',signal});if(!start.ok)throw new ApiError(start.status,'device_login_failed',t("auth.deviceFailed"));const device=await start.json();onCode({code:device.user_code,url:device.verification_uri_complete});
 const until=Date.now()+device.expires_in*1000;
 while(Date.now()<until&&!signal.aborted){await new Promise<void>((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',stop);resolve()};const timer=setTimeout(done,device.interval*1000);const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new Error(t("auth.cancelled")))};signal.addEventListener('abort',stop,{once:true})});
  const response=await fetch(config.token_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:device.device_code,code_verifier:auth.codeVerifier}),redirect:'error',signal});const raw=await response.json();if(response.ok)return result(raw);if(raw.error!=='authorization_pending')throw new ApiError(response.status,raw.error,t("auth.authorizationExpired"));
 }
 throw new ApiError(401,'device_expired',t("auth.deviceExpired"));
}

export async function magicProof(config:MobileConfig){
 const auth=new AuthRequest({clientId:'mautic-inbox-native',redirectUri:config.redirect_uri,responseType:ResponseType.Code,usePKCE:true,state:Crypto.randomUUID()});
 await auth.makeAuthUrlAsync({authorizationEndpoint:config.authorization_endpoint});
 if(!auth.codeVerifier||!auth.codeChallenge)throw new Error(t("auth.secureFailed"));
 return {verifier:auth.codeVerifier,challenge:auth.codeChallenge};
}
