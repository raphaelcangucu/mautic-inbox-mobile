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
const moderation={...proposal,tool:'inbox_moderate',target:{id:8,name:'Author',channel:'instagram'},fields:{operation:'spam',reason:'Third-party ad',body:'Visit my shop',account:'Macro',scope:'inbox'}};
test('moderation proposals show exact comment, account, reason and truthful scope',()=>{
 assert.equal(checkedAssistantProposals([moderation],'admin').length,1);
 for(const fields of [{...moderation.fields,operation:'delete'},{...moderation.fields,scope:'instagram'},{...moderation.fields,reason:''},{...moderation.fields,account:undefined}])assert.throws(()=>checkedAssistantProposals([{...moderation,fields}],'admin'));
 assert.throws(()=>checkedAssistantProposals([{...moderation,target:{...moderation.target,channel:'whatsapp'}}],'admin'));
 assert.throws(()=>checkedAssistantProposals([{...moderation,fields:{...moderation.fields,operation:'hide',scope:'instagram'},target:{...moderation.target,channel:'facebook'}}],'admin'));
});
test('moderation and public social replies can review 20 comments while other actions retain their cap',()=>{
 const batch=Array.from({length:20},(_,i)=>({...moderation,id:(i+1).toString(16).padStart(48,'0'),target:{...moderation.target,id:i+1}}));
 assert.equal(checkedAssistantProposals(batch,'admin').length,20);
 assert.throws(()=>checkedAssistantProposals([...batch,{...moderation,id:'b'.repeat(48)}],'admin'));
 assert.throws(()=>checkedAssistantProposals([batch[0],{...batch[1],target:batch[0].target}],'admin'));
 assert.equal(checkedAssistantProposals(Array.from({length:20},(_,i)=>({...proposal,id:(i+1).toString(16).padStart(48,'0'),target:{id:i+1,name:'Comment',channel:'instagram'},fields:{body:'Public reply',mode:'public'}})),'admin').length,20);
 assert.throws(()=>checkedAssistantProposals(Array.from({length:4},(_,i)=>({...proposal,id:(i+1).toString(16).padStart(48,'0')})),'admin'));
});
