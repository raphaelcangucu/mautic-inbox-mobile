import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedAssistantProposals,assistantConfirmation} from '../src/api/assistant-actions.ts';
const proposal={id:'a'.repeat(48),agent_key:'admin',expires_at:'2026-10-07T23:00:00Z',tool:'mautic_reply_inbox',target:{id:12,name:'Test visitor',channel:'webchat'},fields:{body:'Real test',mode:'private'}};
test('assistant proposals bind the selected agent and require concrete targets',()=>{
 assert.equal(checkedAssistantProposals([proposal],'admin').length,1);
 for(const override of [{id:'../x'},{agent_key:'other'},{tool:'delete'},{expires_at:'wrong'},{target:{id:0}},{fields:{body:'',mode:'private'}}])assert.throws(()=>checkedAssistantProposals([{...proposal,...override}],'admin'));
 assert.throws(()=>checkedAssistantProposals([proposal,proposal],'admin'));
 assert.deepEqual(checkedAssistantProposals(undefined,'admin'),[]);
});
test('confirmation only carries an opaque proposal ID, agent and explicit confirmation',()=>{
 const [p]=checkedAssistantProposals([proposal],'admin');
 assert.deepEqual(assistantConfirmation(p,'admin',Date.parse('2026-10-07T22:00:00Z')),{proposal_id:p.id,agent_key:'admin',confirm:true});
 assert.throws(()=>assistantConfirmation(p,'other',Date.parse('2026-10-07T22:00:00Z')));
 assert.throws(()=>assistantConfirmation(p,'admin',Date.parse('2026-10-07T23:00:00Z')));
});
