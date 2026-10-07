import {t} from '../i18n/engine.ts';
import {ApiError,type Page,type Transport} from '../api/types.ts';
export type CrmOption={id:number;name:string};
export type CatalogueKind='campaign'|'segment';
export const CATALOGUE_PAGE_SIZE=20;
type Cache={get:<T>(key:string)=>Promise<T|null>;put:(key:string,value:any)=>Promise<unknown>};
export async function loadCataloguePage(repo:{api:Transport;disk:Cache},kind:CatalogueKind,search:string,cursor:string|null,offline:boolean):Promise<Page<CrmOption>>{
 const query=search.trim().slice(0,100);
 const key='crm:catalogue:'+JSON.stringify([kind,query,cursor]);
 if(offline){const saved=await repo.disk.get<Page<CrmOption>>(key);if(saved)return saved;throw new ApiError(0,'offline_catalogue',t("crm.offlineSearch"));}
 const page=await repo.api.request<Page<CrmOption>>({method:'GET',path:'/inbox/mobile/crm-options',query:{kind,search:query,limit:CATALOGUE_PAGE_SIZE,...(cursor?{cursor}:{})}});
 if(!Array.isArray(page.items)||page.items.length>CATALOGUE_PAGE_SIZE||page.items.some(x=>!Number.isSafeInteger(x.id)||x.id<=0||typeof x.name!=='string')||!(page.next_cursor===null||typeof page.next_cursor==='string'))throw new ApiError(502,'invalid_catalogue',t("crm.invalidResponse"));
 await repo.disk.put(key,page);
 return page;
}
