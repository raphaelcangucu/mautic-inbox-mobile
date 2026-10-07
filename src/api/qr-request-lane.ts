import {t} from '../i18n/engine.ts';
/** User actions wait for an existing status read; periodic reads never displace an action. */
export class QrRequestLane {
 private reading:Promise<unknown>|null=null;
 private acting=false;
 async poll<T>(task:()=>Promise<T>):Promise<T|undefined>{
  if(this.reading||this.acting)return undefined;
  const reading=Promise.resolve().then(task);this.reading=reading;
  try{return await reading}finally{if(this.reading===reading)this.reading=null}
 }
 async action<T>(task:()=>Promise<T>):Promise<T>{
  if(this.acting)throw new Error(t("qr.waitAction"));
  this.acting=true;
  try{await this.reading?.catch(()=>{});return await task()}finally{this.acting=false}
 }
}
