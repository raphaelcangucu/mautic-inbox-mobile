import {t} from '../i18n/engine.ts';
export type QrConnection={id:number;name:string;status:string;can_pair:boolean};
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
 switch(value.stage){case 'ready':return t("qr.ready");case 'waiting':return value.image_base64?t("qr.waitingScan"):t("qr.preparing");case 'connected':return t("qr.connected");case 'reconnecting':return 'Reconectando · aguarde';default:return value.cause==='expired'?t("qr.expired"):value.cause==='unpaired'?t("qr.reconnect"):t("qr.unavailable");}
}
