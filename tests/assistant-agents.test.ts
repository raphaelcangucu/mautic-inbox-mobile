import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedAssistantAgents,chooseAssistantAgent,assistantHistoryKey} from '../src/api/assistant-agents.ts';
const a={key:'internal',name:'Internal',tools:['mautic_read_inbox'],read_only:true as const};
test('unauthorized and malformed agent metadata does not become a usable assistant',()=>{
  for(const raw of [null,{}, {items:null},{items:[{...a,read_only:false}]},{items:[{...a,tools:[123]}]},{items:[a,a]}])assert.throws(()=>checkedAssistantAgents(raw));
  assert.deepEqual(checkedAssistantAgents({items:[]}),[]);
  assert.equal(chooseAssistantAgent([],a.key),null);
});
test('only a currently authorized agent can be restored and its history stays separate',()=>{
  const items=checkedAssistantAgents({items:[a,{...a,key:'other'}]});
  assert.equal(chooseAssistantAgent(items,'other')?.key,'other');
  assert.equal(chooseAssistantAgent(items,'revoked')?.key,'internal');
  assert.notEqual(assistantHistoryKey('internal'),assistantHistoryKey('other'));
  assert.equal(assistantHistoryKey(''),'assistant:turns');
});
