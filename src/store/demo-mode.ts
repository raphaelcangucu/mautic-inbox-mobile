import type {Account} from '../api/types.ts';

/** Real accounts keep their existing encrypted cache; fixtures have a separate namespace. */
export const accountStorageId=(account:Account)=>account.mode==='mock'?'mock:'+account.id:account.id;
export const visibleAccounts=(accounts:Account[],unlocked:boolean)=>accounts.filter(a=>a.mode==='live'||(unlocked&&a.mode==='mock'));
export function bootAccount(accounts:Account[],activeId:string|null){
 const live=accounts.filter(a=>a.mode==='live');
 return live.find(a=>a.id===activeId)||live[0];
}

/** Build de e2e: abre a conta mockada sem o gesto, porque nenhum simulador iOS injeta aceleracao.
 *  O Expo embute EXPO_PUBLIC_MAUTIC_E2E_DEMO no bundle; sem a variavel no build, isto e sempre false. */
export const e2eDemoBuild=()=>process.env.EXPO_PUBLIC_MAUTIC_E2E_DEMO==='1';
