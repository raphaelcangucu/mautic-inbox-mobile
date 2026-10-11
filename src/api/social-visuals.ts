import type {Conversation,Transport} from './types.ts';
export type SocialVisuals={avatar_url?:string|null;asset_avatar_url?:string|null;publication?:{image?:string|null;title?:string;caption?:string;permalink?:string}|null};
export function socialImage(url:unknown):string|null {
 if(typeof url!=='string')return null;
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['.fbcdn.net','.cdninstagram.com','.fbsbx.com'].some(s=>u.hostname.endsWith(s))?url:null}catch{return null}
}
export function applySocialVisuals(c:Conversation,data:SocialVisuals):Conversation{
 const post=data.publication;
 return {...c,avatar_url:socialImage(data.avatar_url)||c.avatar_url,asset_avatar_url:socialImage(data.asset_avatar_url)||c.asset_avatar_url,
 ...(c.comment&&post?{comment:{...c.comment,image:socialImage(post.image)||c.comment.image,postTitle:post.title||c.comment.postTitle,postBody:post.caption||c.comment.postBody,permalink:post.permalink||c.comment.permalink}}:{})};
}
const clients=new WeakMap<Transport,{active:number;queue:(()=>void)[];requests:Map<number,{until:number;promise:Promise<SocialVisuals>}>}>();
/** Bounded visible-row hydration; no shared cache across instances/users. */
export function loadSocialVisuals(api:Transport,id:number):Promise<SocialVisuals>{
 let client=clients.get(api);if(!client){client={active:0,queue:[],requests:new Map()};clients.set(api,client)}
 const cached=client.requests.get(id);if(cached&&cached.until>Date.now())return cached.promise;
 const owner=client;
 const promise=(async()=>{await new Promise<void>(resolve=>{const start=()=>{owner.active++;resolve()};if(owner.active<2)start();else owner.queue.push(start)});
 try{return await api.request<SocialVisuals>({method:'GET',path:`/inbox/api/conversations/${id}/visuals`})}finally{owner.active--;owner.queue.shift()?.()}})();
 owner.requests.set(id,{until:Date.now()+300000,promise});return promise;
}
