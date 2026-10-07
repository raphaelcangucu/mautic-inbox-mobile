import {t} from '../i18n/engine.ts';
import {newDeliveryFailure} from '../api/delivery-diagnostics';
import {initialReplyMode} from '../api/reply-mode';
import {syncPushAccounts} from '../api/push-accounts';
import {create} from 'zustand';
import {Platform} from 'react-native';
import {HttpTransport,type MobileConfig} from '../api/http';
import type {LoginResult} from '../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import {suppressNotification} from '../api/notification-policy';
import {registerNativePush,nativePushStatus,removeNativePush,testNativePush,activateNativePush,permissionGranted,type PushStatus} from '../api/native-push';
import {openDisk,deleteAccountDisk} from '../storage/disk';
import {readSession,saveSession,deleteSession} from '../storage/vault';
import {InboxRepository} from '../api/repository';
import {ChatNavigation} from './chat-navigation';
import {MockTransport} from '../api/mock';
import {demoAccounts} from '../api/fixtures';
import {accountStorageId,bootAccount} from './demo-mode';
import {defaultView, type Account, type Attachment, type Channel, type Conversation, type Message, type Preferences, type Template, type ViewState} from '../api/types';

export type Route='inbox'|'chat'|'contact'|'assistant'|'contacts'|'accounts'|'connection'|'login'|'notifications'|'preferences'|'diagnostics';
type Runtime={repo:InboxRepository;transport:MockTransport|HttpTransport};
const runtimes=new Map<string,Promise<Runtime>>();const loggingOut=new Set<string>();const sendingChats=new Set<string>();
async function runtime(a:Account){const storageId=accountStorageId(a);if(!runtimes.has(storageId))runtimes.set(storageId,(async()=>{const disk=await openDisk(storageId);const transport=a.mode==='mock'?new MockTransport(a,disk):new HttpTransport(a,()=>readSession(a.id),value=>saveSession(a.id,value),()=>{if(useApp.getState().active?.id===a.id)void useApp.getState().logout(false,true)});return {transport,repo:new InboxRepository(disk,transport,id=>evictConversation(a.id,id))}})());return runtimes.get(storageId)!}
const prefs:Preferences={sound:true,vibration:true,preview:false,quiet:false,grouped:true,suppressOpen:true};
export type SavedConnection={name:string;origin:string};
const initialConnections:SavedConnection[]=[{name:'Macro Markets',origin:'https://mkt-macro.on-forge.com'}];
const metadataKey='mautic-inbox-accounts-v2';
type Metadata={connections?:SavedConnection[];accounts:Account[];activeId:string|null;theme:'light'|'dark'};
const chatNavigation=new ChatNavigation();
let generation=0;let draftTimer:ReturnType<typeof setTimeout>|undefined;let draftFlush:(()=>Promise<void>)|undefined;
export async function flushDraft(){if(draftTimer)clearTimeout(draftTimer);const job=draftFlush;draftFlush=undefined;await job?.()}
function evictConversation(accountId:string,id:number){
 const s=useApp.getState();if(s.active?.id!==accountId)return;
 if(draftTimer&&s.conversationId===id){clearTimeout(draftTimer);draftFlush=undefined;}
 if(s.conversationId===id)chatNavigation.invalidate();
 const messages={...s.messages};delete messages[id];const view={...s.view,chatOffsets:{...s.view.chatOffsets},chatAnchors:{...s.view.chatAnchors}};
 if(view.lastChat===id)delete view.lastChat;delete view.chatOffsets[id];delete view.chatAnchors[id];
 useApp.setState({messages,view,conversations:s.conversations.filter(c=>c.id!==id),...(s.conversationId===id?{route:'inbox',conversationId:0,draft:'',attachment:null,cursor:null,error:'',toast:''}:{})});
}
async function persistMeta(){const s=useApp.getState();await AsyncStorage.setItem(metadataKey,JSON.stringify({connections:s.connections,accounts:s.accounts,activeId:s.active?.id||null,theme:s.theme}))}
type State={
  demoUnlocked:boolean;unlockDemo:()=>Promise<void>;hideDemo:()=>Promise<void>;connections:SavedConnection[];connectionDraft:SavedConnection|null;saveConnection:(value:SavedConnection)=>Promise<void>;configure:(value?:SavedConnection)=>void;ready:boolean;accounts:Account[];active:Account|null;repo:InboxRepository|null;transport:MockTransport|HttpTransport|null;route:Route;theme:'light'|'dark';view:ViewState;
  conversations:Conversation[];messages:Record<number,Message[]>;conversationId:number;draft:string;mode:'reply'|'note';attachment:Attachment|null;cursor:string|null;replyMode:'public'|'private';
  syncing:boolean;refreshingList:boolean;offline:boolean;slow:boolean;error:string;toast:string;lastSync:number;listComplete:boolean;preferences:Preferences;pushStatus:PushStatus|null;pushBusy:boolean;refreshPush:()=>Promise<void>;enablePush:(enabled:boolean)=>Promise<void>;testPush:()=>Promise<void>;unseen:number;performance:number[];
  boot:()=>Promise<void>;switchAccount:(a:Account)=>Promise<void>;connect:(config:MobileConfig,result:LoginResult,name:string)=>Promise<void>;logout:(remove?:boolean,localOnly?:boolean)=>Promise<void>;
  navigate:(r:Route)=>void;back:()=>void;sync:(force?:boolean,showRefresh?:boolean)=>Promise<void>;moreConversations:()=>Promise<void>;openChat:(id:number)=>Promise<void>;older:()=>Promise<void>;read:()=>Promise<void>;
  setView:(patch:Partial<ViewState>)=>void;setDraft:(text:string)=>void;setMode:(mode:'reply'|'note')=>Promise<void>;send:(template?:Template,variables?:Record<string,string>)=>Promise<boolean>;
  retryMessage:(message:Message)=>Promise<boolean>;transition:(action:string,payload?:Record<string,unknown>)=>Promise<boolean>;feature:(endpoint:string,payload:Record<string,unknown>)=>Promise<boolean>;themeToggle:()=>void;toggleOffline:()=>void;toggleSlow:()=>void;inject:()=>Promise<void>;toggleWindow:()=>Promise<void>;setPreferences:(patch:Partial<Preferences>)=>void;notify:(message:string)=>void;
};
export const useApp=create<State>((set,get)=>({
  demoUnlocked:false,connections:initialConnections,connectionDraft:null,ready:false,accounts:[],active:null,repo:null,transport:null,route:'inbox',theme:'light',view:defaultView(),conversations:[],messages:{},conversationId:0,draft:'',mode:'reply',attachment:null,cursor:null,replyMode:'public',syncing:false,refreshingList:false,offline:false,slow:false,error:'',toast:'',lastSync:0,listComplete:true,preferences:prefs,pushStatus:null,pushBusy:false,unseen:0,performance:[],
  boot:async()=>{
    try{const raw=await AsyncStorage.getItem(metadataKey);const meta:Metadata=raw?JSON.parse(raw):{accounts:[],activeId:null,theme:'light'};set({demoUnlocked:false,connections:meta.connections||initialConnections,accounts:meta.accounts,theme:meta.theme});
      const a=bootAccount(meta.accounts,meta.activeId);if(a)await get().switchAccount(a);else set({route:'accounts',connectionDraft:null});
    }catch(e){set({error:String(e),route:'accounts'})}finally{set({ready:true})}
  },
  saveConnection:async value=>{set({connections:[...get().connections.filter(x=>x.origin!==value.origin),value]});await persistMeta()},
  configure:value=>{chatNavigation.invalidate();void flushDraft();set({connectionDraft:value||{name:'Novo Mautic',origin:''},route:'connection',error:''})},
  switchAccount:async(a)=>{
    if(a.mode==='mock'&&!get().demoUnlocked){get().notify(t("demo.locked"));return}
    if(a.mode!=='mock'&&a.mode!=='live')return;
    chatNavigation.invalidate();await flushDraft();const epoch=++generation;set({pushStatus:null,pushBusy:false,active:a,repo:null,transport:null,conversations:[],messages:{},conversationId:0,draft:'',mode:'reply',attachment:null,view:defaultView(),syncing:false,refreshingList:false,lastSync:0,listComplete:true,error:'',offline:false,slow:false,unseen:0,route:'accounts'});
    const session=await readSession(accountStorageId(a));if(epoch!==generation)return;
    if(!session||(session.expiresAt<Date.now()&&!session.refreshToken)){set({active:{...a,expired:true},route:'login'});return}
    try{const {repo,transport}=await runtime(a);if(transport instanceof MockTransport){transport.offline=false;transport.latency=180;}await repo.recover();const [list,view,settings,lastSync,listComplete]=await Promise.all([repo.cachedList(),repo.view(),repo.disk.get<Preferences>('ui:preferences'),repo.disk.get<number>('sync:last'),repo.disk.get<boolean>('sync:list-complete')]);if(epoch!==generation)return;set({repo,transport,conversations:list,view,conversationId:Number.isSafeInteger(view.lastChat)&&Number(view.lastChat)>0?Number(view.lastChat):0,preferences:settings||prefs,lastSync:lastSync||0,listComplete:listComplete!==false,route:'inbox'});await persistMeta();void get().sync();}
    catch(e){if(epoch===generation)set({error:String(e),route:'accounts'})}
  },
  connect:async(config,result,name)=>{const id=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,config.origin+'|'+result.user.id);const a:Account={id,origin:config.origin,name:name||config.name,user:result.user,config,mode:'live'};await saveSession(id,result.session);set({accounts:[...get().accounts.filter(x=>x.id!==id),a]});await get().switchAccount(a);await persistMeta()},
  unlockDemo:async()=>{const accounts=demoAccounts.map(a=>({...a,mode:'mock' as const}));for(const a of accounts)await saveSession(accountStorageId(a),{accessToken:'mock-'+a.id,expiresAt:Date.now()+604800000});set({demoUnlocked:true,accounts:[...get().accounts.filter(a=>a.mode!=='mock'),...accounts]});await persistMeta()},
  hideDemo:async()=>{const s=get();if(s.active?.mode==='mock'){chatNavigation.invalidate();await flushDraft();++generation;set({active:null,repo:null,transport:null,conversations:[],messages:{},conversationId:0,draft:'',attachment:null,view:defaultView(),route:'accounts',syncing:false,refreshingList:false,error:'',toast:'',offline:false,slow:false,unseen:0,lastSync:0,listComplete:true,pushStatus:null,pushBusy:false})}set({demoUnlocked:false});await persistMeta()},
  logout:async(remove=false,localOnly=false)=>{const s=get();if(!s.active||loggingOut.has(s.active.id))return;const id=s.active.id;loggingOut.add(id);try{chatNavigation.invalidate();await flushDraft();++generation;if(s.transport instanceof MockTransport)s.transport.offline=true;else if(s.repo&&!localOnly){if(Platform.OS==='ios')await removeNativePush(s.repo.api).catch(()=>{});await s.repo.api.request({method:'DELETE',path:'/inbox/mobile/session'}).catch(()=>{});}await s.transport?.settle();await s.repo?.settle();await s.repo?.disk.clear();await s.repo?.disk.close();const storageId=accountStorageId(s.active);await deleteAccountDisk(storageId);runtimes.delete(storageId);await deleteSession(storageId);set({repo:null,transport:null,active:null,pushStatus:null,pushBusy:false,conversations:[],messages:{},conversationId:0,draft:'',attachment:null,view:defaultView(),route:'accounts',accounts:remove?s.accounts.filter(a=>a.id!==id):s.accounts.map(a=>a.id===id?{...a,expired:true}:a)});await persistMeta()}finally{loggingOut.delete(id)}},
  navigate:r=>{if(r==='diagnostics'&&get().active?.mode!=='mock')return;chatNavigation.invalidate();void flushDraft();set({route:r,error:''})},back:()=>{chatNavigation.invalidate();void flushDraft();set({route:get().route==='contact'?'chat':'inbox',error:''})},
  sync:async(force=true,showRefresh=false)=>{const s=get();if(!s.repo||s.syncing||s.offline)return;const epoch=generation;set({syncing:true,refreshingList:showRefresh,error:''});try{if(force||s.active?.mode!=='live'||Date.now()-s.lastSync>=30000){const conversations=await s.repo.list();const listComplete=await s.repo.disk.get<boolean>('sync:list-complete');if(epoch!==generation)return;set({conversations,lastSync:Date.now(),listComplete:listComplete!==false})}if(s.route==='chat'&&get().route==='chat'&&get().conversationId===s.conversationId){if(s.active?.mode==='live'){const fresh=await s.repo.detail(s.conversationId);if(epoch!==generation)return;set({conversations:get().conversations.map(c=>c.id===fresh.id?fresh:c)})}const messages=s.active?.mode==='live'?await s.repo.refreshHistory(s.conversationId):(await s.repo.poll(s.conversationId),await s.repo.cachedMessages(s.conversationId));if(epoch===generation&&!await s.repo.isRevoked(s.conversationId)){const failed=newDeliveryFailure(get().messages[s.conversationId]||[],messages);set({messages:{...get().messages,[s.conversationId]:messages}});if(failed&&get().route==='chat'&&get().conversationId===s.conversationId)get().notify(failed.failure||t('chat.retryUnavailable'))}}
      if(s.active?.mode==='live'&&Platform.OS!=='web'){
        const saved=await s.repo.disk.get<number>('notification:cursor');
        const batch=await s.repo.api.request<any>({method:'GET',path:'/inbox/mobile/notifications',query:saved===null?{}:{cursor:saved}});
        const permitted=(await Notifications.getPermissionsAsync()).granted;
        for(const notification of batch.notifications){if(epoch!==generation)return;const conversation=notification.conversation as Conversation|undefined;const data={accountId:s.active.id,conversationId:Number(notification.state_id)};if(Platform.OS==='ios'||!permitted||!conversation||notification.suppressed||suppressNotification(get(),data))continue;
          const identifier='inbox-'+s.active.id+'-'+(s.preferences.grouped!==false?notification.state_id:notification.id);const channelId='inbox-'+s.active.id+'-'+Number(s.preferences.sound)+Number(s.preferences.vibration);
          if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(channelId,{name:s.active.name,importance:Notifications.AndroidImportance.HIGH,sound:s.preferences.sound?'default':null,enableVibrate:s.preferences.vibration});
          if(s.preferences.grouped!==false)await Notifications.dismissNotificationAsync(identifier);
          await Notifications.scheduleNotificationAsync({identifier,content:{title:s.active.name+' · '+conversation.contact_name,body:s.preferences.preview?conversation.preview:t("push.newMessage"),data,sound:s.preferences.sound&&!s.preferences.quiet},trigger:Platform.OS==='android'?{channelId}:null});
        }
        if(epoch===generation)await s.repo.disk.put('notification:cursor',batch.notification_cursor);
      }
    }catch(e){if(epoch===generation)set({error:e instanceof Error?e.message:String(e)})}finally{if(epoch===generation)set({syncing:false,refreshingList:false})}},
  moreConversations:async()=>{const s=get();if(!s.repo||s.syncing||s.offline||s.listComplete)return;const epoch=generation;set({syncing:true,error:''});try{const conversations=await s.repo.more();const listComplete=await s.repo.disk.get<boolean>('sync:list-complete');if(epoch===generation)set({conversations,listComplete:listComplete!==false,lastSync:Date.now()})}catch(e){if(epoch===generation)set({error:e instanceof Error?e.message:String(e)})}finally{if(epoch===generation)set({syncing:false})}},
  openChat:async id=>{
    const start=performance.now();const s=get();if(!s.repo)return;const epoch=generation;
    await chatNavigation.open(id,s.repo,{
      valid:()=>epoch===generation&&get().repo===s.repo,
      flushDraft,memory:s.messages[id],offline:s.offline,live:s.active?.mode==='live',
      cached:(items,draft,cursor)=>{set({conversationId:id,messages:{...get().messages,[id]:items},draft,mode:'reply',replyMode:initialReplyMode(get().conversations.find(c=>c.id===id)),attachment:null,cursor,route:'chat',unseen:0,error:'',performance:[...get().performance,performance.now()-start].slice(-100)});get().setView({lastChat:id})},
      detail:detail=>set({conversations:get().conversations.some(c=>c.id===id)?get().conversations.map(c=>c.id===id?detail:c):[...get().conversations,detail],replyMode:initialReplyMode(detail)}),
      history:(items,cursor)=>set({messages:{...get().messages,[id]:items},cursor}),
      error:e=>set({error:e instanceof Error?e.message:String(e)}),
    });
  },
  older:async()=>{const s=get();if(!s.repo||!s.cursor||s.offline)return;const epoch=generation;try{const p=await s.repo.history(s.conversationId,s.cursor);const items=await s.repo.cachedMessages(s.conversationId);if(epoch===generation&&get().conversationId===s.conversationId)set({messages:{...get().messages,[s.conversationId]:items},cursor:p.next_cursor})}catch(e){get().notify(e instanceof Error?e.message:String(e))}},
  read:async()=>{const s=get();const c=s.conversations.find(c=>c.id===s.conversationId);if(!s.repo||s.offline||!c?.unread)return;const epoch=generation;try{const fresh=await s.repo.transition(c.id,c.version,'read');if(epoch===generation)set({conversations:get().conversations.map(c=>c.id===fresh.id?fresh:c)})}catch{}},
  setView:patch=>{const view={...get().view,...patch};set({view});void get().repo?.disk.put('ui:view',view)},
  setDraft:text=>{chatNavigation.editedDraft();set({draft:text});const s=get();if(!s.repo)return;const key='draft:'+s.conversationId+':'+s.mode;draftFlush=()=>s.repo!.disk.put(key,text);if(draftTimer)clearTimeout(draftTimer);draftTimer=setTimeout(()=>{void flushDraft()},120)},
  setMode:async mode=>{const s=get();if(!s.repo)return;const epoch=generation;await chatNavigation.changeMode(s.conversationId,mode,s.repo,{flushDraft,valid:()=>epoch===generation&&get().repo===s.repo&&get().route==='chat'&&get().conversationId===s.conversationId,apply:draft=>set({mode,draft,attachment:null})})},
  send:async(template,variables)=>{
    const s=get();const epoch=generation;
    if(!s.repo||s.offline){get().notify(t("store.offlineDraft"));return false}
    const key=s.active?.id+':'+s.conversationId+':'+s.mode;
    if(sendingChats.has(key))return false;
    sendingChats.add(key);
    try{
      const current=chatNavigation.guard(()=>epoch===generation&&get().repo===s.repo&&get().route==='chat'&&get().conversationId===s.conversationId);
      await flushDraft();if(!current())return false;
      let body=s.draft.trim();if(template)body=template.preview.replace(/\{\{(\w+)\}\}/g,(_,token)=>variables?.['BODY:'+token]||'');
      if(!body&&!s.attachment)return false;
      const id=Crypto.randomUUID().replace(/-/g,'');
      const entry={request_id:id,conversationId:s.conversationId,body:body||s.attachment!.name,mode:s.mode,timestamp:new Date().toISOString(),status:'sending' as const,...(template?{template_id:template.id,variables}:{}),...(s.attachment?{attachment:s.attachment}:{}),replyMode:s.replyMode};
      const local:Message={kind:s.mode==='note'?'note':'outbound',id:'local-'+id,request_id:id,body:entry.body,timestamp:entry.timestamp,status:'sending',direction:'outbound',attachment:s.attachment||undefined};
      // Clear the captured composer synchronously, before any network or disk wait.
      set({draft:'',attachment:null,messages:{...get().messages,[s.conversationId]:[...(get().messages[s.conversationId]||[]),local]}});
      const clearing=s.repo.disk.put('draft:'+s.conversationId+':'+s.mode,'').catch(()=>{});
      let accepted=false;
      try{const result=await s.repo.send(entry);accepted=result.item?.status!=='failed';if(epoch===generation)get().notify(!accepted?(result.item?.failure||t("chat.retryUnavailable")):s.mode==='note'?t("store.noteSaved"):s.active?.mode==='mock'?t("store.demoAccepted"):t("store.accepted"))}
      catch(e){if(epoch===generation)get().notify(e instanceof Error?e.message:String(e))}
      finally{
        await clearing;
        const [items,conversations]=await Promise.all([s.repo.cachedMessages(s.conversationId),s.repo.cachedList()]);
        if(epoch===generation&&!await s.repo.isRevoked(s.conversationId))set({messages:{...get().messages,[s.conversationId]:items},conversations});
      }
      return accepted;
    }finally{sendingChats.delete(key)}
  },
  retryMessage:async message=>{
    const s=get(),epoch=generation;if(!s.repo||s.offline){s.notify(t('store.offlineDraft'));return false}
    const key=s.active?.id+':'+s.conversationId+':reply';if(sendingChats.has(key))return false;
    sendingChats.add(key);
    const current=()=>epoch===generation&&get().repo===s.repo&&get().route==='chat'&&get().conversationId===s.conversationId;
    try{
      const result=await s.repo.retryMessage(s.conversationId,message,Crypto.randomUUID().replace(/-/g,''));
      if(current())s.notify(result==='registered'?t('chat.retryRegistered'):t('chat.retryAlreadyRegistered'));
      return true;
    }catch(e){if(current())s.notify(e instanceof Error?e.message:String(e));return false}
    finally{
      try{const [items,conversations]=await Promise.all([s.repo.cachedMessages(s.conversationId),s.repo.cachedList()]);if(epoch===generation&&!await s.repo.isRevoked(s.conversationId))set({messages:{...get().messages,[s.conversationId]:items},conversations})}
      finally{sendingChats.delete(key)}
    }
  },
  transition:async(action,payload={})=>{const s=get();const c=s.conversations.find(c=>c.id===s.conversationId);if(!s.repo||!c||s.offline){get().notify(t("store.connectChange"));return false}const epoch=generation;try{const fresh=await s.repo.transition(c.id,c.version,action,payload);if(epoch===generation)set({conversations:get().conversations.map(c=>c.id===fresh.id?fresh:c)});if(epoch!==generation)return false;get().notify(action==='take'?t("store.taken"):t("store.updated"));return true}catch(e){if(epoch===generation){get().notify(e instanceof Error?e.message:String(e));await get().sync()}return false}},
  feature:async(endpoint,payload)=>{const s=get();const c=s.conversations.find(x=>x.id===s.conversationId);if(!s.repo||!c||s.offline){s.notify(t("store.connectChange"));return false}const epoch=generation;try{const updated=await s.repo.api.request<Conversation>({method:'POST',path:`/inbox/${endpoint==='moderation'?'mobile':'api'}/conversations/${c.id}/${endpoint}`,body:{...payload,version:c.version}});await s.repo.saveConversations([updated]);if(epoch!==generation)return false;set({conversations:get().conversations.map(x=>x.id===updated.id?updated:x)});await get().sync();get().notify(s.active?.mode==='mock'?t("store.demoSaved"):t("store.saved"));return true}catch(e){if(epoch===generation){get().notify(e instanceof Error?e.message:String(e));await get().sync()}return false}},
  themeToggle:()=>{set({theme:get().theme==='light'?'dark':'light'});void persistMeta()},
  toggleOffline:()=>{const value=!get().offline;if(get().transport instanceof MockTransport)(get().transport as MockTransport).offline=value;set({offline:value});if(!value)void get().sync()},
  toggleSlow:()=>{const value=!get().slow;if(get().transport instanceof MockTransport)(get().transport as MockTransport).latency=value?1200:180;set({slow:value})},
  inject:async()=>{const s=get();if(!(s.transport instanceof MockTransport)||!s.repo||s.offline)return;const epoch=generation;await s.transport.inject(s.conversationId);await s.repo.poll(s.conversationId);const [items,conversations]=await Promise.all([s.repo.cachedMessages(s.conversationId),s.repo.cachedList()]);if(epoch!==generation)return;set({messages:{...get().messages,[s.conversationId]:items},conversations,unseen:get().unseen+1});get().notify(t("store.demoNewMessage"))},
  toggleWindow:async()=>{if(get().offline)return;const transport=get().transport;if(transport instanceof MockTransport)await transport.closeWindow(get().conversationId);await get().sync();get().notify(t("store.demoWindowClosed"))},
  refreshPush:async()=>{const s=get();if(Platform.OS!=='ios'||s.active?.mode!=='live'||!s.repo)return;try{const status=await nativePushStatus(s.repo.api);if(get().active?.id===s.active.id)set({pushStatus:status})}catch(e){if(get().active?.id===s.active.id)set({pushStatus:null})}},
  enablePush:async(enabled)=>{const s=get();if(!s.repo||s.active?.mode!=='live')return;const epoch=generation;const valid=()=>epoch===generation&&get().active?.id===s.active?.id&&get().repo===s.repo;set({pushBusy:true});try{if(enabled)await activateNativePush();if(!valid())return;s.setPreferences({remotePush:enabled});await synchronizeNativePush();if(!valid())return;await get().refreshPush();if(valid())get().notify(enabled?t("push.activated"):t("push.deactivated"))}catch(e){if(valid())get().notify(e instanceof Error?e.message:String(e))}finally{if(valid())set({pushBusy:false})}},
  testPush:async()=>{const s=get();if(!s.repo)return;set({pushBusy:true});try{await synchronizeNativePush();await testNativePush(s.repo.api);get().notify(t("push.testRequested"))}catch(e){get().notify(e instanceof Error?e.message:String(e))}finally{set({pushBusy:false})}},
  setPreferences:patch=>{const preferences={...get().preferences,...patch};set({preferences});void get().repo?.disk.put('ui:preferences',preferences).then(()=>synchronizeNativePush()).catch(()=>{})},
  notify:message=>{set({toast:message});setTimeout(()=>{if(get().toast===message)set({toast:''})},4000)},
}));

let pushSync:Promise<void>|undefined;
let pushSyncAgain=false;
/** Each connection uses its own transport and preferences, including inactive accounts. */
export function synchronizeNativePush(){
 if(Platform.OS!=='ios')return Promise.resolve();
 if(pushSync){pushSyncAgain=true;return pushSync;}
 return pushSync=(async()=>{
  do {pushSyncAgain=false;
  const initial=useApp.getState();
  await syncPushAccounts(initial.accounts,async account=>{
   if(account.mode!=='live'||account.expired)return;
   if(!await readSession(account.id))return;
   const rt=await runtime(account);const current=useApp.getState();
   if(!current.accounts.some(a=>a.id===account.id&&!a.expired)||loggingOut.has(account.id))return;
   const settings=current.active?.id===account.id?current.preferences:(await rt.repo.disk.get<Preferences>('ui:preferences')||prefs);
   if(!settings.remotePush||!await permissionGranted()){await removeNativePush(rt.transport).catch(()=>{});if(useApp.getState().active?.id===account.id)await useApp.getState().refreshPush();return;}
   const status=await registerNativePush(rt.transport,account,settings,current.active?.id===account.id&&current.route==='chat'?current.conversationId:0);
   if(useApp.getState().active?.id===account.id)useApp.setState({pushStatus:status});
  },()=>useApp.getState().active?.id,account=>{
   if(useApp.getState().active?.id===account.id)useApp.setState({pushStatus:null});
  });
 }while(pushSyncAgain);
 })().finally(()=>{pushSync=undefined});
}
export async function notificationPreferences(accountId:unknown){const state=useApp.getState();if(state.active?.id===accountId)return state.preferences;const account=state.accounts.find(a=>a.id===accountId&&!a.expired);return account?(await (await runtime(account)).repo.disk.get<Preferences>('ui:preferences')||prefs):null}
