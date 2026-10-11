import test from 'node:test';import assert from 'node:assert/strict';
import {applySocialVisuals,socialImage,loadSocialVisuals} from '../src/api/social-visuals.ts';
import type {Conversation,Transport} from '../src/api/types.ts';
test('accepts only HTTPS Meta CDN images without credentials or custom ports',()=>{
 assert.equal(socialImage('https://scontent.test.fbcdn.net/photo?oh=test'),'https://scontent.test.fbcdn.net/photo?oh=test');
 for(const value of ['https://fbcdn.net.evil.test/p','https://user@x.fbcdn.net/p','https://x.fbcdn.net:8443/p','http://x.fbcdn.net/p','/local/p',null])assert.equal(socialImage(value),null);
});
test('hydrates photos and publication while retaining moderation, identity and conversation version',()=>{
 const c={id:4,version:9,avatar_url:null,moderation:{spam:true},comment:{postTitle:'Old',image:null,permalink:''}} as Conversation;
 const updated=applySocialVisuals(c,{avatar_url:'https://x.fbcdn.net/avatar',asset_avatar_url:'https://x.fbcdn.net/logo',publication:{image:'https://x.fbcdn.net/post',caption:'Caption'}});
 assert.equal(updated.version,9);assert.equal(updated.moderation,c.moderation);assert.equal(updated.comment?.postBody,'Caption');assert.equal(updated.comment?.image,'https://x.fbcdn.net/post');
 assert.equal(applySocialVisuals(updated,{avatar_url:null}).avatar_url,updated.avatar_url);
});
test('deduplicates by transport and caps hydration concurrency at two',async()=>{
 let active=0,max=0,calls=0;const api={request:async()=>{calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return {avatar_url:null}}} as Transport;
 const first=loadSocialVisuals(api,1);assert.equal(loadSocialVisuals(api,1),first);
 await Promise.all([first,...Array.from({length:6},(_,i)=>loadSocialVisuals(api,i+2))]);assert.equal(calls,7);assert.equal(max,2);
 await loadSocialVisuals(api,1);assert.equal(calls,7);
 const other={request:async()=>{calls++;return {}}} as Transport;await loadSocialVisuals(other,1);assert.equal(calls,8);
});
