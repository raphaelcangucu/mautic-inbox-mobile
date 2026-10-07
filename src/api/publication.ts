import type {Channel} from './types.ts';
/** Validate before crossing the native Linking boundary: an empty URL can be fatal on iOS. */
export function publicationURL(value:unknown,channel:Channel):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 try{const url=new URL(value.trim());const hosts=channel==='instagram'?['instagram.com','www.instagram.com']:channel==='facebook'?['facebook.com','www.facebook.com','m.facebook.com']:[];
  if(url.protocol!=='https:'||url.username||url.password||!hosts.includes(url.hostname.toLowerCase())||url.pathname==='/')return null;
  return url.toString();
 }catch{return null}
}
export async function openPublication(value:unknown,channel:Channel,open:(url:string)=>Promise<unknown>):Promise<'opened'|'missing'|'unavailable'>{
 const url=publicationURL(value,channel);if(!url)return 'missing';try{await open(url);return 'opened'}catch{return 'unavailable'}
}
