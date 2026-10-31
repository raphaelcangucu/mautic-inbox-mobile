import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {ApiError} from '../src/api/types.ts';
import {t} from '../src/i18n/engine.ts';
import {customTabsBrowser} from '../src/api/custom-tabs.ts';
import type {MobileConfig} from '../src/api/http.ts';

// auth.ts reaches for expo modules, so run the shipped source with those stubbed,
// as tests/browser-login.test.ts does.
function load(){
 const exports:any={};
 const source=ts.transpileModule(fs.readFileSync(new URL('../src/api/auth.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules:any={'../i18n/engine.ts':{t},'expo-auth-session':{AuthRequest:class{},ResponseType:{Code:'code'}},'expo-crypto':{randomUUID},'expo-web-browser':{maybeCompleteAuthSession(){}},'react-native':{Platform:{OS:'ios'}},'./types':{ApiError},'./custom-tabs':{customTabsBrowser}};
 vm.runInNewContext(source,{exports,require:(id:string)=>{assert.ok(id in modules);return modules[id]},Date,AbortController,setTimeout,clearTimeout});
 return exports.passwordLogin as (config:MobileConfig,identifier:string,secret:string,fetcher:typeof fetch)=>Promise<any>;
}
const passwordLogin=load();
const config={version:1,name:'Example',origin:'https://example.com',api_base:'https://example.com/inbox/mobile/api',authorization_endpoint:'https://example.com/s/inbox/mobile/authorize',token_endpoint:'https://example.com/inbox/mobile/token',redirect_uri:'mautic-inbox-demo://oauth/callback',capabilities:{password_login:true}} as MobileConfig;
const granted={access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:7,name:'Operator',email:'me@example.com'}};
const reply=(raw:unknown,status=200)=>(async()=>Response.json(raw as any,{status})) as typeof fetch;

test('password sign-in posts the trimmed identifier to the token endpoint and returns the session',async()=>{
 let body:any;const before=Date.now();
 const login=await passwordLogin(config,'  Apple-Review  ','senha-de-revisao',(async(url,options)=>{assert.equal(url,config.token_endpoint);assert.equal(options?.redirect,'error');body=JSON.parse(String(options?.body));return Response.json(granted)}) as typeof fetch);
 assert.deepEqual(body,{grant_type:'password',username:'Apple-Review',password:'senha-de-revisao'});
 assert.equal(login.user.id,7);assert.equal(login.session.refreshToken,'refresh');assert.ok(login.session.expiresAt>=before+3600000);
});
test('an instance that does not advertise password sign-in makes no network request',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;return Response.json(granted)}) as typeof fetch;
 await assert.rejects(passwordLogin({...config,capabilities:{}} as MobileConfig,'apple-review','senha',fetcher),/não aceita entrada por senha/);
 await assert.rejects(passwordLogin({...config,capabilities:{password_login:'yes'}} as MobileConfig,'apple-review','senha',fetcher),/não aceita entrada por senha/);
 assert.equal(calls,0);
});
test('a refused password says so without revealing whether the user exists',async()=>{
 for(const who of ['apple-review','ninguem@example.com'])await assert.rejects(passwordLogin(config,who,'errada',reply({error:'invalid_grant'},400)),/Usuário ou senha incorretos/);
});
test('throttling and a second factor send the operator somewhere useful',async()=>{
 await assert.rejects(passwordLogin(config,'apple-review','senha',reply({error:'rate_limited'},429)),/Muitas tentativas/);
 await assert.rejects(passwordLogin(config,'apple-review','senha',reply({error:'second_factor_required'},400)),/duas etapas/);
});
test('a malformed grant never becomes a session',async()=>{
 for(const raw of [{...granted,access_token:7},{...granted,refresh_token:null},{...granted,expires_in:0},{...granted,user:{id:0,email:'me@example.com'}},{...granted,user:{id:7}}])
  await assert.rejects(passwordLogin(config,'apple-review','senha',reply(raw)),/Resposta de login inválida/);
});
