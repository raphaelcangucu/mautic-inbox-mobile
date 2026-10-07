import {t} from '../i18n/engine.ts';
import type {Transport} from './types.ts';

export type AssistantDisclosure={version:1;policy_id:string;provider:string;provider_id:string;model:string;privacy_url:string};
export type AssistantConsent={accountId:string;origin:string;policyId:string;acceptedAt:string};
export const assistantConsentKey='assistant:sharing-consent:v1';

export function checkedAssistantDisclosure(raw:unknown):AssistantDisclosure{
 const d=raw as AssistantDisclosure;
 if(!d||d.version!==1||!['policy_id','provider','provider_id','model'].every(k=>typeof d[k as keyof AssistantDisclosure]==='string'&&String(d[k as keyof AssistantDisclosure]).length>0&&String(d[k as keyof AssistantDisclosure]).length<=160))throw Error(t("ai.missingProvider"));
 let url:URL;try{url=new URL(d.privacy_url)}catch{throw Error(t("ai.noPolicy"))}
 if(url.protocol!=='https:'||url.username||url.password)throw Error(t("ai.invalidPolicy"));
 return d;
}
export function assistantConsentMatches(saved:AssistantConsent|null|undefined,d:AssistantDisclosure,accountId:string,origin:string){
 return !!saved&&saved.accountId===accountId&&saved.origin===origin&&saved.policyId===d.policy_id&&Number.isFinite(Date.parse(saved.acceptedAt));
}
/** The UI must obtain explicit consent before calling this data-bearing request. */
export async function askConsentedAssistant<T>(api:Transport,d:AssistantDisclosure,saved:AssistantConsent|null,accountId:string,origin:string,body:Record<string,unknown>):Promise<T>{
 if(!assistantConsentMatches(saved,d,accountId,origin))throw Error(t("ai.consentRequired"));
 return api.request<T>({method:'POST',path:'/inbox/mobile/assistant/messages',body:{...body,sharing_policy_id:d.policy_id}});
}
