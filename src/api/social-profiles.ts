import type {Conversation} from './types.ts';
export type SocialChannel='instagram'|'facebook'|'whatsapp';
export type SocialProfiles=Partial<Record<SocialChannel,string>>;
export type SocialProfile={channel:SocialChannel;url:string;handle:string};
const reserved=new Set(['p','reel','reels','stories','explore','accounts','direct','about','privacy','terms','developer','developers','web','watch','groups','events','pages','marketplace','login','logout','dialog','sharer.php','l.php','settings','help','share','profile.php','photo.php','permalink.php','story.php','photos','videos','business','gaming','notifications','challenge','oauth','api']);

/** Only public profile URLs. Never construct a Facebook profile from a Messenger PSID. */
export function profileURL(channel:SocialChannel,value:unknown):string|null {
 if(typeof value!=='string'||!value.trim())return null;
 try{const u=new URL(value.trim());const hosts=channel==='instagram'?['instagram.com','www.instagram.com']:channel==='facebook'?['facebook.com','www.facebook.com','m.facebook.com']:['wa.me'];
  if(u.protocol!=='https:'||u.username||u.password||!hosts.includes(u.hostname.toLowerCase())||(u.port&&u.port!=='443'))return null;
  const path=u.pathname.replace(/^\/+|\/+$/g,'');
  if(channel==='whatsapp')return /^[1-9]\d{7,14}$/.test(path)?'https://wa.me/'+path:null;
  if(channel==='facebook'&&path==='profile.php'){const id=u.searchParams.get('id');return id&&/^[1-9]\d{4,39}$/.test(id)?'https://www.facebook.com/profile.php?id='+id:null}
  if(channel==='facebook'&&/^people\/[a-zA-Z0-9._-]+\/[1-9]\d{4,39}$/.test(path))return 'https://www.facebook.com/'+path+'/';
  if(!(channel==='instagram'?/^[a-zA-Z0-9._]{1,30}$/:/^[a-zA-Z0-9.]{1,80}$/).test(path)||/^\d+$/.test(path)||reserved.has(path.toLowerCase()))return null;
  return 'https://www.'+channel+'.com/'+path+'/';
 }catch{return null}
}
export function instagramProfile(handle:unknown):string|null {
 if(typeof handle!=='string'||!/^@?[a-zA-Z0-9._]{1,30}$/.test(handle.trim()))return null;
 return profileURL('instagram','https://www.instagram.com/'+handle.trim().replace(/^@/,'')+'/');
}
/** CRM numbers need an explicit country prefix; Inbox recipients are already normalized. */
export function whatsappProfile(value:unknown,normalizedRecipient=false):string|null {
 if(typeof value!=='string'||(!normalizedRecipient&&!value.trim().startsWith('+')))return null;
 if(!/^\+?[\d ()-]+$/.test(value.trim()))return null;
 return profileURL('whatsapp','https://wa.me/'+value.replace(/\D/g,''));
}
export function contactProfiles(contact:{phone?:string|null;social_profiles?:SocialProfiles}|null|undefined,conversation?:Conversation):SocialProfile[] {
 const links:SocialProfiles={...contact?.social_profiles};
 const phone=whatsappProfile(contact?.phone);if(phone)links.whatsapp=phone;
 if(conversation?.channel==='whatsapp'){const recipient=whatsappProfile(conversation.recipient,true);if(recipient)links.whatsapp=recipient}
 if(conversation?.channel==='instagram'||conversation?.channel==='facebook'){
  const current=profileURL(conversation.channel,conversation.profile_url)||(conversation.channel==='instagram'?instagramProfile(conversation.contact_handle):null);
  if(current)links[conversation.channel]=current;
 }
 return (['instagram','facebook','whatsapp'] as const).flatMap(channel=>{const url=profileURL(channel,links[channel]);if(!url)return [];const u=new URL(url);return [{channel,url,handle:channel==='whatsapp'?'+'+u.pathname.slice(1):u.pathname==='/profile.php'?u.searchParams.get('id')||'':u.pathname.replace(/^\/+|\/+$/g,'')}]});
}
export async function openSocialProfile(profile:SocialProfile,open:(url:string)=>Promise<unknown>):Promise<boolean>{const url=profileURL(profile.channel,profile.url);if(!url)return false;try{await open(url);return true}catch{return false}}
