import {t} from '../i18n/engine.ts';
import React,{useEffect,useRef,useState} from 'react';
import {View,Image,AppState,Alert,Platform,Share} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {Button,T,Card,Field,Tap,Icon} from './ui';
import {Sheet} from './Sheet';
import {QrRequestLane} from '../api/qr-request-lane';
import {pairingFromApi,pairingLabel,qrImageCurrent,qrPhone,qrPairingUrl,qrConnectionLabel,type QrConnection,type QrPairing,type QrCatalogue} from '../api/whatsqr';

/** Pairing material is ephemeral: never stored in the account's history/cache. */
export function WhatsQrConnections({assetId,request=0,hideTrigger=false,onConnected}:{assetId?:number;request?:number;hideTrigger?:boolean;onConnected?:()=>void}={}){
 const s=useApp();const c=useTheme();const [open,setOpen]=useState(false);const [connections,setConnections]=useState<QrConnection[]>([]);const [selected,setSelected]=useState<QrConnection|null>(null);const [detail,setDetail]=useState<QrPairing|null>(null);const [receivedAt,setReceivedAt]=useState(0);const [foreground,setForeground]=useState(AppState.currentState==='active');const [busy,setBusy]=useState(false);const [sharing,setSharing]=useState(false);const [error,setError]=useState('');const [actionError,setActionError]=useState('');const epoch=useRef(0);const lane=useRef(new QrRequestLane());const sharingNow=useRef(false);
 const account=s.active?.id;const repo=s.repo;const folder=FileSystem.cacheDirectory?FileSystem.cacheDirectory+'whatsqr-share/':null;
 const [creation,setCreation]=useState<QrCatalogue['creation']>();const [adding,setAdding]=useState(false);const [name,setName]=useState('');const [phone,setPhone]=useState('');const [profile,setProfile]=useState(0);const requestId=useRef('');
 const previousStage=useRef<string|null>(null);
 useEffect(()=>{requestId.current=Crypto.randomUUID()},[name,phone,profile]);
 function clear(){epoch.current++;setDetail(null);setReceivedAt(0);setBusy(false);setActionError('')}
 useEffect(()=>{clear();setOpen(false);setSelected(null);setConnections([]);setCreation(undefined);setAdding(false);setName('');setPhone('');setError('')},[account]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{setForeground(state==='active');if(state!=='active')clear()});return()=>{epoch.current++;listener.remove()}},[]);
 useEffect(()=>{if(s.offline)clear()},[s.offline]);
 useEffect(()=>{if(!detail?.image_base64||!receivedAt)return;const timer=setTimeout(()=>setDetail(null),Math.max(0,receivedAt+30000-Date.now()));return()=>clearTimeout(timer)},[detail?.version,receivedAt]);
 useEffect(()=>{if(folder)void FileSystem.deleteAsync(folder,{idempotent:true}).catch(()=>{})},[]);
 const valid=(generation:number)=>generation===epoch.current&&useApp.getState().active?.id===account;
 async function list(){if(!repo||s.offline)return;const generation=++epoch.current;setOpen(true);setSelected(null);setAdding(false);setCreation(undefined);setDetail(null);setConnections([]);setBusy(true);setError('');setActionError('');try{const data=await repo.api.request<QrCatalogue>({method:'GET',path:'/inbox/mobile/whatsqr'});if(valid(generation)){setConnections(data.items);setCreation(data.creation);setProfile(data.creation?.profiles[0]?.id||0);if(assetId){const target=data.items.find(item=>item.id===assetId);if(target?.can_pair)setSelected(target);else setError(t("qr.pairPermission"))}}}catch(e){if(valid(generation))setError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}}
 useEffect(()=>{if(request>0&&assetId&&repo)void list()},[request]);
 useEffect(()=>{previousStage.current=null},[selected?.id,account]);
 useEffect(()=>{if(!detail)return;const before=previousStage.current;previousStage.current=detail.stage;if(before&&before!=='connected'&&detail.stage==='connected')onConnected?.()},[detail?.stage]);
 useEffect(()=>{
  if(!open||selected||adding||!foreground||s.offline||!repo)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;const generation=epoch.current;
  async function refresh(){try{const data=await repo!.api.request<QrCatalogue>({method:'GET',path:'/inbox/mobile/whatsqr'});if(!stopped&&valid(generation)){setConnections(data.items);setCreation(data.creation);setError('')}}catch(e){if(!stopped&&valid(generation))setError(e instanceof Error?e.message:String(e))}finally{if(!stopped)timer=setTimeout(()=>void refresh(),10000)}}
  timer=setTimeout(()=>void refresh(),10000);return()=>{stopped=true;clearTimeout(timer)};
 },[open,selected?.id,adding,foreground,s.offline,account]);
 async function addNumber(){
  const normalized=qrPhone(phone);if(!repo||busy||s.offline||!creation?.can_create||!profile||!name.trim()||!normalized)return;
  const generation=epoch.current;const payload={name:name.trim(),phone_number:normalized,profile_id:profile,request_id:requestId.current};setBusy(true);setActionError('');
  try{await lane.current.action(async()=>{
   if(!valid(generation))return;
   const created=await repo.api.request<QrConnection>({method:'POST',path:'/inbox/mobile/whatsqr',body:payload});
   if(!valid(generation))return;
   setConnections(items=>[...items.filter(item=>item.id!==created.id),created]);setSelected(created);setAdding(false);setDetail(null);
   const fresh=pairingFromApi(await repo.api.request<QrPairing>({method:'POST',path:`/inbox/mobile/whatsqr/${created.id}/start`,body:{regenerate:false}}),created.id);
   if(valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setName('');setPhone('')}
  })}catch(e){if(valid(generation))setActionError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}
 }
 async function fetchStatus(id:number){if(!repo)throw Error(t("qr.signIn"));return pairingFromApi(await repo.api.request<QrPairing>({method:'GET',path:`/inbox/mobile/whatsqr/${id}`}),id)}
 async function refreshSelected(){if(!selected||busy||sharing||s.offline)return;const generation=epoch.current;setBusy(true);try{const fresh=await lane.current.action(()=>fetchStatus(selected.id));if(valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setError('')}}catch(e){if(valid(generation))setError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}}
 useEffect(()=>{
  if(!open||!selected||!foreground||s.offline)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;const generation=epoch.current;
  async function poll(){if(stopped)return;if(sharingNow.current){timer=setTimeout(()=>void poll(),5000);return}try{const fresh=await lane.current.poll(()=>fetchStatus(selected!.id));if(fresh&&!stopped&&valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setError('')}}catch(e){if(!stopped&&valid(generation)){setDetail(null);setError(e instanceof Error?e.message:String(e))}}finally{if(!stopped)timer=setTimeout(()=>void poll(),5000)}}
  void poll();return()=>{stopped=true;clearTimeout(timer)};
 },[open,selected?.id,foreground,s.offline,account]);
 async function start(regenerate=false){if(!repo||!selected||busy||sharing||s.offline)return;const generation=epoch.current;const id=selected.id;setBusy(true);setDetail(null);setActionError('');try{const fresh=await lane.current.action(async()=>{if(!valid(generation))return null;return pairingFromApi(await repo.api.request<QrPairing>({method:'POST',path:`/inbox/mobile/whatsqr/${id}/start`,body:{regenerate}}),id)});if(fresh&&valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setError('')}}catch(e){if(valid(generation))setActionError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}}
 async function share(){if(!selected||sharingNow.current||busy||s.offline)return;const generation=epoch.current;const id=selected.id;let file:string|null=null;sharingNow.current=true;setSharing(true);setActionError('');try{await lane.current.action(async()=>{
   if(Platform.OS==='web'||!folder||!await Sharing.isAvailableAsync())throw Error(t("qr.shareUnavailable"));
   if(!valid(generation))return;const fresh=await fetchStatus(id);if(!valid(generation))return;setDetail(fresh);setReceivedAt(Date.now());if(!qrImageCurrent(fresh,Date.now()))throw Error(t("qr.noCode"));
   await FileSystem.makeDirectoryAsync(folder,{intermediates:true});file=folder+'whatsapp-qr-'+id+'-'+Date.now()+'.png';await FileSystem.writeAsStringAsync(file,fresh.image_base64!,{encoding:FileSystem.EncodingType.Base64});
   if(!valid(generation))return;await Sharing.shareAsync(file,{mimeType:'image/png',UTI:'public.png',dialogTitle:t("qr.shareTitle")});
  });}catch(e){if(valid(generation)){setDetail(null);setActionError(e instanceof Error?e.message:String(e))}}finally{if(file)await FileSystem.deleteAsync(file,{idempotent:true}).catch(()=>{});sharingNow.current=false;setSharing(false)}
 }
 function close(){clear();setOpen(false);setSelected(null);setError('')}
 const pairingUrl=selected&&s.active?qrPairingUrl(s.active.origin,selected.id):null;
 async function usePairingLink(shareLink=false){
  if(!pairingUrl||sharingNow.current||busy)return;
  const generation=epoch.current;setActionError('');
  try{if(shareLink)await Share.share(Platform.OS==='ios'?{url:pairingUrl,title:t("qr.linkTitle")}:{message:pairingUrl,title:t("qr.linkTitle")});else await WebBrowser.openBrowserAsync(pairingUrl)}catch{if(valid(generation))setActionError(t("qr.linkError"))}
 }
 const current=qrImageCurrent(detail,receivedAt)&&foreground&&!s.offline;
 return <>{!hideTrigger&&<Button quiet label={t("qr.title")} testID="whatsqr-connections" disabled={!repo||s.offline} onPress={()=>void list()}/>}<Sheet title={selected?t("qr.connectTitle"):adding?t("qr.addNumber"):t("qr.connections")} visible={open} onClose={close}>
 {!selected?adding?<>
 <T muted size={12}>{t("qr.newNumberHint")}</T>
 <Field label={t("qr.numberName")} value={name} onChange={setName} testID="whatsqr-new-name"/>
 <Field label={t("qr.phone")} placeholder="+55 11 99999-9999" keyboardType="phone-pad" value={phone} onChange={setPhone} testID="whatsqr-new-phone"/>
 {!!phone&&!qrPhone(phone)&&<T size={12} color={c.warn}>{t("qr.phoneHint")}</T>}
 {(creation?.profiles.length||0)>1&&<><T bold size={12}>{t("qr.useConfiguration")}</T>{creation!.profiles.map(item=><Button key={item.id} quiet={profile!==item.id} label={item.name} disabled={busy} onPress={()=>setProfile(item.id)}/>)}</>}
 <Button label={busy?t("qr.creating"):t("qr.createAndGenerate")} disabled={busy||s.offline||!name.trim()||name.trim().length>80||!qrPhone(phone)||!profile} testID="whatsqr-create" onPress={()=>void addNumber()}/>
 <Button quiet label={t("common.cancel")} disabled={busy} onPress={()=>{setAdding(false);setActionError('')}}/>
 </>:<>
 {creation?.can_create&&<Button label={t("qr.addNumber")} testID="whatsqr-add-number" disabled={busy} onPress={()=>{setAdding(true);setName('');setPhone('');setActionError('')}}/>}
 {connections.map(connection=><Tap key={connection.id} label={connection.name+', '+qrConnectionLabel(connection.status)} disabled={!connection.can_pair} testID={'whatsqr-asset-'+connection.id} onPress={()=>{clear();setSelected(connection);setError('')}}><Card style={{width:'100%'}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{flex:1,gap:3}}><T bold size={14}>{connection.name}</T>{!!connection.phone&&<T muted size={12}>{connection.phone}</T>}<T size={11} color={connection.status==='connected'?c.ok:connection.status==='reconnecting'?c.blue:c.warn}>{qrConnectionLabel(connection.status)}</T></View><Icon name="chevron-forward" size={18} color={c.soft}/></View></Card></Tap>)}{!busy&&!connections.length&&!error&&<T muted size={12}>{t("qr.noNumbers")}</T>}
 {!busy&&!creation?.can_create&&!error&&<T muted size={12}>{t("qr.creationUnavailable")}</T>}
 </>:<>
 <T bold size={16}>{selected.name}</T><T size={12} muted>{s.active?.name} · {s.active?.origin.replace('https://','')}</T>{detail&&<T bold size={13} testID="whatsqr-status">{pairingLabel(detail)}</T>}
 {detail?.stage==='reconnecting'&&<T muted size={12}>{t("qr.reconnectingHint")}</T>}
 {detail?.cause==='service_down'&&<T muted size={12}>{t("qr.serviceDownHint")}</T>}
 {(error||detail?.cause==='service_down'||detail?.stage==='reconnecting')&&<Button quiet label={t("qr.refreshStatus")} testID="whatsqr-refresh" disabled={busy||sharing||s.offline} onPress={()=>void refreshSelected()}/>}
 {current?<View style={{alignItems:'center',gap:10}}><Image accessibilityLabel={t("qr.imageLabel")} testID="whatsqr-image" onError={()=>{setDetail(null);setError(t("qr.imageError"))}} source={{uri:'data:image/png;base64,'+detail!.image_base64}} resizeMode="contain" style={{width:'100%',maxWidth:320,aspectRatio:1,backgroundColor:'#FFFFFF',borderRadius:0}}/><T muted size={11}>{t("qr.autoRefresh")}</T><Button label={sharing?t("qr.sharing"):t("qr.shareImage")} testID="whatsqr-share" disabled={sharing||busy} onPress={()=>void share()}/></View>:detail?.stage==='waiting'?<T muted size={12}>{t("qr.waitingRefresh")}</T>:null}
 {detail?.can_start&&<Button label={t("qr.generate")} disabled={busy||sharing||s.offline} testID="whatsqr-start" onPress={()=>void start()}/>}
 {detail?.can_regenerate&&<Button label={t("qr.generateAnother")} disabled={busy||sharing||s.offline} onPress={()=>Alert.alert(t("qr.generateConfirm"),t("qr.replaceHint"),[{text:t("common.cancel"),style:'cancel'},{text:t("qr.generate"),onPress:()=>void start(true)}])}/>}
 {pairingUrl&&<Card><T bold size={12}>{t("qr.linkTitle")}</T><T muted size={11}>{t("qr.linkHint")}</T><T selectable size={11} color={c.blue} testID="whatsqr-pairing-url">{pairingUrl}</T><Button quiet label={t("qr.openLink")} testID="whatsqr-open-link" disabled={busy||sharing} onPress={()=>void usePairingLink()}/><Button quiet label={t("qr.shareLink")} testID="whatsqr-share-link" disabled={busy||sharing} onPress={()=>void usePairingLink(true)}/></Card>}
 <Card><T bold size={12}>{t("qr.howTo")}</T><T muted size={12}>{t("qr.instructions")}</T><T muted size={11}>{t("qr.shareHint")}</T></Card><Button quiet label={t("qr.backNumbers")} disabled={sharing} onPress={()=>{clear();setSelected(null);setError('')}}/>
 </>}{(busy||(selected&&!detail&&!error&&!actionError))&&<T muted size={12}>{t("qr.querying")}</T>}{(actionError||error)&&<T size={12} color={c.warn} accessibilityRole="alert">{actionError||error}</T>}{s.offline&&<T muted size={12}>{t("qr.offline")}</T>}
 </Sheet></>;
}
