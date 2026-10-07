import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedAssistantDisclosure,askConsentedAssistant,type AssistantConsent} from '../src/api/assistant-consent.ts';
import type {Transport,ApiRequest} from '../src/api/types.ts';
const disclosure=checkedAssistantDisclosure({version:1,policy_id:'openai:v1',provider:'OpenAI',provider_id:'openai',model:'test',privacy_url:'https://openai.com/policies/privacy-policy/'});
const consent:AssistantConsent={accountId:'a',origin:'https://mautic.example',policyId:'openai:v1',acceptedAt:'2026-10-06T17:00:00Z'};
test('missing, revoked, changed-provider and other-account consents send no assistant data',async()=>{
 let sent=0;const api:Transport={request:async<T>(r:ApiRequest)=>{sent++;assert.equal(r.body?.sharing_policy_id,disclosure.policy_id);return {} as T}};
 for(const saved of [null,{...consent,policyId:'old-provider'},{...consent,accountId:'other'},{...consent,origin:'https://other.example'},{...consent,acceptedAt:'invalid'}]){
  await assert.rejects(askConsentedAssistant(api,disclosure,saved,'a','https://mautic.example',{message:'private question',history:[]}));
 }
 assert.equal(sent,0);
 await askConsentedAssistant(api,disclosure,consent,'a','https://mautic.example',{message:'approved question',history:[]});assert.equal(sent,1);
});
test('invalid provider metadata cannot be treated as an accepted disclosure',()=>{
 for(const raw of [null,{}, {...disclosure,version:2},{...disclosure,policy_id:''},{...disclosure,privacy_url:'http://example.com'},{...disclosure,privacy_url:'https://user:secret@example.com'}])assert.throws(()=>checkedAssistantDisclosure(raw));
});
