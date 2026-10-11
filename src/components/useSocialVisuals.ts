import {useEffect} from 'react';
import {useApp} from '../store/app';
import {applySocialVisuals,loadSocialVisuals,type SocialVisuals} from '../api/social-visuals';
import type {Conversation} from '../api/types';

export function useSocialVisuals(conversation:Conversation){
 const repo=useApp(s=>s.repo),account=useApp(s=>s.active),offline=useApp(s=>s.offline);
 useEffect(()=>{
  if(!repo||account?.mode!=='live'||!conversation.mobile.social_visuals)return;
  let alive=true;const valid=()=>alive&&useApp.getState().repo===repo&&useApp.getState().active?.id===account.id;
  const apply=(data:SocialVisuals)=>{if(!valid())return;useApp.setState(s=>({conversations:s.conversations.map(c=>c.id===conversation.id?applySocialVisuals(c,data):c)}))};
  const timer=setTimeout(()=>{void(async()=>{
   const cached=await repo.disk.get<{expires:number;data:SocialVisuals}>('visuals:'+conversation.id);
   if(cached)apply(cached.data);
   if(!valid()||offline||cached&&cached.expires>Date.now())return;
   const data=await loadSocialVisuals(repo.api,conversation.id);if(!valid())return;apply(data);
   await repo.disk.put('visuals:'+conversation.id,{expires:Date.now()+300000,data});
  })().catch(()=>{});},150);
  return()=>{alive=false;clearTimeout(timer)};
 },[repo,account?.id,offline,conversation.id,conversation.mobile.social_visuals]);
}
