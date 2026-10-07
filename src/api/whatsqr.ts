import {t} from '../i18n/engine.ts';
import {checkedOrigin} from './http.ts';
import type {Transport,Conversation} from './types.ts';
/** A normal authenticated Mautic page: never put device grants or QR material in its URL. */
export function qrPairingUrl(origin:string,assetId:number):string|null{
 if(!Number.isSafeInteger(assetId)||assetId<=0)return null;
 try{return checkedOrigin(origin)+`/s/whatsqr/connections/${assetId}/pair`}catch{return null}
}
export type QrConnection={id:number;name:string;phone?:string|null;status:string;can_pair:boolean};
export type QrCatalogue={items:QrConnection[];creation?:{can_create:boolean;profiles:{id:number;name:string}[]}};
export function qrPhone(value:string):string|null{const phone=value.trim().replace(/[\s().-]/g,'');return /^\+[1-9][0-9]{7,14}$/.test(phone)?phone:null}
export type QrPairing={id:number;name:string;stage:'ready'|'waiting'|'connected'|'reconnecting'|'not_done';cause:string|null;can_start:boolean;can_regenerate:boolean;image_base64:string|null;image_mime:'image/png';version:string;refresh_after:number};
export function pairingFromApi(raw:QrPairing,assetId:number):QrPairing{
 if(raw.id!==assetId||!['ready','waiting','connected','reconnecting','not_done'].includes(raw.stage)||typeof raw.version!=='string')throw Error(t("qr.invalidStatus"));
 const image=raw.stage==='waiting'?raw.image_base64:null;
 if(image&&(!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(image)||image.length>200000))throw Error(t("qr.invalidImage"));
 return {...raw,image_base64:image,image_mime:'image/png',can_start:raw.stage==='ready'&&raw.can_start===true,can_regenerate:raw.stage==='not_done'&&raw.can_regenerate===true,refresh_after:5};
}
export function qrImageCurrent(value:QrPairing|null,receivedAt:number,now=Date.now()){
 return !!value?.image_base64&&value.stage==='waiting'&&now>=receivedAt&&now-receivedAt<30000;
}
export function pairingLabel(value:QrPairing){
 switch(value.stage){case 'ready':return t("qr.ready");case 'waiting':return value.image_base64?t("qr.waitingScan"):t("qr.preparing");case 'connected':return t("qr.connected");case 'reconnecting':return t("qr.reconnecting");default:return value.cause==='service_down'?t("qr.serviceDown"):value.cause==='expired'?t("qr.expired"):value.cause==='unpaired'?t("qr.reconnect"):t("qr.unavailable");}
}
export function qrConnectionLabel(status:string){const labels={connected:'qr.connected',reconnecting:'qr.reconnecting',logged_out:'qr.reconnect',pairing:'qr.waitingScan',failed:'qr.unavailable',ambiguous_credential:'qr.reviewConfiguration'} as const;return t(Object.hasOwn(labels,status)?labels[status as keyof typeof labels]:'qr.unknownStatus')}
export function qrConversation(conversation:Conversation){return conversation.channel==='whatsapp'&&conversation.asset.type==='whatsapp_qr_session'}
export function qrNeedsRecovery(value:QrPairing){return value.stage!=='connected'}
/** Read-only diagnosis; this helper never resets credentials or resends a message. */
export async function inspectQrConnection(api:Transport,assetId:number):Promise<QrPairing|null>{
 try{return pairingFromApi(await api.request<QrPairing>({method:'GET',path:`/inbox/mobile/whatsqr/${assetId}`}),assetId)}catch{return null}
}
