import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {ApiError} from '../src/api/types.ts';
import {t} from '../src/i18n/engine.ts';

function harness(reply: (request:any)=>any){
 const requests:any[]=[];const posts:any[]=[];
 class AuthRequest{
  state:string;codeVerifier='v'.repeat(64);
  constructor(public config:any){this.state=config.state??'expoState0';requests.push(this)}
  async promptAsync(discovery:any,options:any){this.config.discovery=discovery;this.config.options=options;return reply(this)}
 }
 const exports:any={};
 const source=ts.transpileModule(fs.readFileSync(new URL('../src/api/auth.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules:any={'../i18n/engine.ts':{t},'expo-auth-session':{AuthRequest,ResponseType:{Code:'code'}},'expo-crypto':{randomUUID},'expo-web-browser':{maybeCompleteAuthSession(){}},'react-native':{Platform:{OS:'ios'}},'./types':{ApiError}};
 vm.runInNewContext(source,{exports,require:(id:string)=>{assert.ok(id in modules);return modules[id]},Date,fetch:async(url:any,options:any)=>{posts.push({url,options});return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:9,name:'Apple Review',email:'review@example.test'}})}});
 return {browserLogin:exports.browserLogin,requests,posts};
}
const config={authorization_endpoint:'https://mautic.example/s/inbox/mobile/authorize',token_endpoint:'https://mautic.example/inbox/mobile/token',redirect_uri:'mautic-inbox-demo://oauth/callback'};
test('browser login uses server-compatible fresh state and PKCE, preserving separate user sign-in',async()=>{
 const h=harness(request=>({type:'success',params:{state:request.state,code:'test-code'}}));
 for(let i=0;i<2;i++)assert.equal((await h.browserLogin(config)).user.id,9);
 assert.notEqual(h.requests[0].state,h.requests[1].state);
 for(const request of h.requests){assert.match(request.state,/^[A-Za-z0-9._~-]{16,256}$/);assert.equal(request.config.usePKCE,true);assert.equal(request.config.redirectUri,config.redirect_uri);assert.equal(request.config.options.preferEphemeralSession,true)}
 for(const post of h.posts){assert.equal(post.url,config.token_endpoint);assert.equal(post.options.redirect,'error');assert.deepEqual(JSON.parse(post.options.body),{grant_type:'authorization_code',code:'test-code',code_verifier:'v'.repeat(64),redirect_uri:config.redirect_uri})}
});
test('mismatched state or cancelled browser cannot exchange a code',async()=>{
 for(const reply of [()=>({type:'success',params:{state:'foreign-state',code:'test-code'}}),()=>({type:'cancel'}),(request:any)=>({type:'success',params:{state:request.state}})]){
  const h=harness(reply);await assert.rejects(h.browserLogin(config),(e:any)=>e.code==='login_cancelled');assert.equal(h.posts.length,0);
 }
});
