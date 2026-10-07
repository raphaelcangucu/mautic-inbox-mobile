import test from 'node:test';
import assert from 'node:assert/strict';
import {resources} from '../src/i18n/catalogues.ts';
import {checkedPreference,resolveLanguage} from '../src/i18n/language.ts';
import {i18n,t,formatNumber,formatTime} from '../src/i18n/engine.ts';

test('system language uses supported preferences, region variants and a defined fallback',()=>{
  assert.equal(resolveLanguage('system',['es-MX','en-US']),'es');
  assert.equal(resolveLanguage('system',['fr-FR','pt-PT']),'pt-BR');
  assert.equal(resolveLanguage('system',['en_US']),'en');
  assert.equal(resolveLanguage('system',['ja-JP']),'en');
  assert.equal(resolveLanguage('pt-BR',['en-US']),'pt-BR');
  for(const invalid of [null,{},'de','PT','es-MX'])assert.equal(checkedPreference(invalid),'system');
});

test('bundled dictionaries have matching keys, nonempty translations and identical interpolation variables',()=>{
  const source=resources['pt-BR'].translation;
  const keys=Object.keys(source).sort();
  const variables=(value:string)=>[...value.matchAll(/\{\{([^}]+)\}\}/g)].map(match=>match[1]).sort();
  for(const language of ['en','es'] as const){
    const target=resources[language].translation;
    assert.deepEqual(Object.keys(target).sort(),keys);
    for(const key of keys as (keyof typeof source)[]){assert.ok(target[key].trim(),key);assert.deepEqual(variables(target[key]),variables(source[key]),key)}
  }
});

test('real translation engine handles singular/plural and locale formats',async()=>{
  await i18n.changeLanguage('en');
  assert.equal(t('nav.notificationsCount',{count:1}),'Notifications, 1 conversation waiting');
  assert.equal(t('nav.notificationsCount',{count:2}),'Notifications, 2 conversations waiting');
  assert.equal(t('nav.conversations'),'Conversations');
  assert.equal(formatNumber(1234),'1,234');
  await i18n.changeLanguage('es');
  assert.equal(t('nav.notificationsCount',{count:1}),'Notificaciones, 1 conversación en espera');
  assert.equal(t('nav.account'),'Cuenta');
  assert.ok(formatTime('2026-10-06T19:03:48Z').length>0);
  await i18n.changeLanguage('pt-BR');
  assert.equal(formatNumber(1234),'1.234');
  assert.equal(t('nav.notificationsCount',{count:2}),'Notificações, 2 conversas aguardando atendimento');
});

test('missing locale/key resolves to the shipped default dictionary',async()=>{
  const key='test.fallback';
  i18n.addResource('pt-BR','translation',key,'Fallback disponível');
  await i18n.changeLanguage('es');
  assert.equal(i18n.t(key),'Fallback disponível');
  assert.equal(i18n.t('test.unknown',{defaultValue:'Unavailable'}),'Unavailable');
  await i18n.changeLanguage('pt-BR');
});

test('API errors and private-window availability follow locale without rewriting cached server values',async()=>{
 const {ApiError}=await import('../src/api/types.ts');const {replyReason}=await import('../src/i18n/api-errors.ts');
 const error=new ApiError(403,'forbidden','Original system message (HTTP 403)');
 const unavailable='The private reply window for this comment has closed.';
 await i18n.changeLanguage('en');assert.match(error.message,/permission/);assert.match(error.message,/HTTP 403/);assert.equal(replyReason(unavailable),'The private reply window for this comment has closed.');
 await i18n.changeLanguage('es');assert.match(error.message,/permiso/);assert.match(replyReason(unavailable)!,/ventana/);assert.equal(replyReason('Custom server detail'),'Custom server detail');
 await i18n.changeLanguage('pt-BR');assert.match(error.message,/permissão/);assert.match(replyReason(unavailable)!,/janela/);
});

test('demo assistant recognizes localized suggestions and preserves CRM names',async()=>{
 const {MockTransport}=await import('../src/api/mock.ts');const {demoAccounts}=await import('../src/api/fixtures.ts');
 const data=new Map<string,unknown>();const disk:any={get:async(k:string)=>data.get(k)||null,put:async(k:string,v:unknown)=>{data.set(k,v)}};
 const api=new MockTransport(demoAccounts[0],disk);api.latency=0;
 await api.request({method:"POST",path:"/inbox/mobile/conversations/7/moderation",body:{version:1,action:"spam"}});
 for(const language of ['en','es','pt-BR'] as const){await i18n.changeLanguage(language);const waiting=await api.request<any>({method:'POST',path:'/inbox/mobile/assistant/messages',body:{message:language==='en'?'Who is waiting for a response?':language==='es'?'¿Quién está esperando una respuesta?':'Quem está aguardando resposta?'}});assert.equal(waiting.tool,'inbox_search_conversations · mock');assert.ok(!waiting.text.includes('Perfil suspeito'));const campaigns=await api.request<any>({method:'POST',path:'/inbox/mobile/assistant/messages',body:{message:'campaigns'}});assert.ok(campaigns.text.includes('Relatório da rodada'))}
 await i18n.changeLanguage('pt-BR');
});
