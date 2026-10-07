import type {Account} from '../api/types.ts';

/** Real accounts keep their existing encrypted cache; fixtures have a separate namespace. */
export const accountStorageId=(account:Account)=>account.mode==='mock'?'mock:'+account.id:account.id;
export const visibleAccounts=(accounts:Account[],unlocked:boolean)=>accounts.filter(a=>a.mode==='live'||(unlocked&&a.mode==='mock'));
export function bootAccount(accounts:Account[],activeId:string|null){
 const live=accounts.filter(a=>a.mode==='live');
 return live.find(a=>a.id===activeId)||live[0];
}
