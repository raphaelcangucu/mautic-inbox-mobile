import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {checkedPreference,resolveLanguage} from '../src/i18n/language.ts';

function harness(saved:string|null=null){
  const reads:string[]=[];const writes:{key:string;value:string}[]=[];const changes:string[]=[];
  let device=['en-US'];let failWrite=false;let release:(()=>void)|null=null;
  let holdNext=false;
  const store={value:{} as any,getState(){return this.value},setState(value:any){this.value={...this.value,...value}}};
  const storage={async getItem(key:string){reads.push(key);return saved},async setItem(key:string,value:string){if(holdNext){holdNext=false;await new Promise<void>(resolve=>{release=resolve})}if(failWrite)throw Error('disk unavailable');saved=value;writes.push({key,value})}};
  const exports:any={};
  const modules:any={'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-localization':{getLocales:()=>device.map(languageTag=>({languageTag}))},zustand:{create:(initial:any)=>{store.value=initial();return store}},'./engine':{i18n:{async changeLanguage(language:string){changes.push(language)}}},'./language':{checkedPreference,resolveLanguage}};
  const source=ts.transpileModule(fs.readFileSync(new URL('../src/i18n/preferences.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:(id:string)=>{assert.ok(id in modules,id);return modules[id]}});
  return {exports,store,reads,writes,changes,device:(value:string[])=>{device=value},fail:(value:boolean)=>{failWrite=value},hold:()=>{holdNext=true},release:()=>{assert.ok(release);release!()},saved:()=>saved};
}

test('language hydration and system refresh touch only language storage and respect manual choice',async()=>{
  const h=harness();await h.exports.initializeLanguage();assert.equal(h.store.value.language,'en');
  h.device(['es-ES']);await h.exports.refreshSystemLanguage();assert.equal(h.store.value.language,'es');
  await h.exports.setLanguagePreference('pt-BR');h.device(['en-US']);await h.exports.refreshSystemLanguage();assert.equal(h.store.value.language,'pt-BR');
  assert.deepEqual(h.reads,['mautic-inbox-language-v1']);assert.deepEqual(h.writes,[{key:'mautic-inbox-language-v1',value:'pt-BR'}]);
  const restart=harness(h.saved());await restart.exports.initializeLanguage();assert.equal(restart.store.value.preference,'pt-BR');assert.equal(restart.store.value.language,'pt-BR');
});

test('rapid choices serialize disk writes; a failed write preserves choice and later retries work',async()=>{
  const h=harness('en');await h.exports.initializeLanguage();h.hold();
  const first=h.exports.setLanguagePreference('es');const second=h.exports.setLanguagePreference('pt-BR');
  await new Promise(resolve=>setImmediate(resolve));h.release();await Promise.all([first,second]);
  assert.equal(h.saved(),'pt-BR');assert.equal(h.store.value.language,'pt-BR');
  assert.deepEqual(h.writes.map(row=>row.value),['es','pt-BR']);
  h.fail(true);await assert.rejects(h.exports.setLanguagePreference('en'));assert.equal(h.store.value.language,'pt-BR');assert.equal(h.saved(),'pt-BR');
  h.fail(false);await h.exports.setLanguagePreference('en');assert.equal(h.store.value.language,'en');
});
