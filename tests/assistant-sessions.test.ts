import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedSessions,checkedSession,checkedSessionTurns,sessionTitle} from '../src/api/assistant-sessions.ts';

test('a session list ignores rows the screen could not draw',()=>{
  const rows=checkedSessions({items:[
    {id:7,title:'Resumo do dia',agent_key:'suporte',context_kind:'contact',context_id:44,turns:6,created:'2026-10-30T10:00:00+00:00',updated:'2026-10-31T09:00:00+00:00'},
    {id:0,title:'sem id'},{id:3},'texto solto',null,
    {id:9,title:'',agent_key:'',context_kind:'campanha',context_id:0,turns:-2,created:'',updated:''},
  ]});
  assert.equal(rows.length,3);
  assert.deepEqual(rows[0],{id:7,title:'Resumo do dia',agent_key:'suporte',context_kind:'contact',context_id:44,turns:6,created:'2026-10-30T10:00:00+00:00',updated:'2026-10-31T09:00:00+00:00'});
  assert.deepEqual(rows[1],{id:3,title:'',agent_key:'',context_kind:null,context_id:null,turns:0,created:'',updated:''});
  // Um contexto que o app não conhece não vira rótulo, e uma contagem negativa não vira número.
  assert.equal(rows[2].context_kind,null);
  assert.equal(rows[2].turns,0);
  assert.deepEqual(checkedSessions(null),[]);
  assert.deepEqual(checkedSessions({items:'nada'}),[]);
});

test('a resumed thread keeps only turns with a role and something written',()=>{
  const turns=checkedSessionTurns([
    {id:'a',role:'user',text:'quem está esperando?'},
    {id:'b',role:'system',text:'instrução'},
    {id:'c',role:'assistant',text:'   '},
    {role:'assistant',text:'três contatos'},
    {id:'d',role:'assistant',text:'li a caixa',tool:'read_inbox',conversationId:12},
    {id:'e',role:'assistant',text:'sem conversa',conversationId:0},
    'lixo',
  ]);
  assert.equal(turns.length,4);
  assert.equal(turns[1].id,'turn-1','um turno sem id ganha o seu');
  assert.equal(turns[2].tool,'read_inbox');
  assert.equal(turns[2].conversationId,12);
  assert.ok(!('conversationId' in turns[3]),'conversa zero não é conversa');
  assert.equal(checkedSessionTurns([{id:'f',role:'user',text:'a'.repeat(5000)}])[0].text.length,4000);
});

test('opening a session carries its thread, and a broken body carries none',()=>{
  const detail=checkedSession({id:4,title:'Campanhas',agent_key:'',context_kind:'conversation',context_id:2,turns:1,created:'',updated:'',history:[{id:'a',role:'user',text:'oi'}]});
  assert.equal(detail?.id,4);
  assert.equal(detail?.history.length,1);
  assert.equal(checkedSession({id:4,history:'nada'})?.history.length,0);
  assert.equal(checkedSession({title:'sem id'}),null);
});

test('a title comes from the question, on one line and bounded',()=>{
  assert.equal(sessionTitle('  quem   está\nesperando?  '),'quem está esperando?');
  assert.equal(sessionTitle('t'.repeat(200)).length,80);
  assert.equal(sessionTitle('   '),'');
});
