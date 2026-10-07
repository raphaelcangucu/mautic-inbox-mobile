/** A failed Mautic must not stop registration in the other connected instances. */
export async function syncPushAccounts<T extends {id:string}>(
 accounts:readonly T[],
 sync:(account:T)=>Promise<void>,
 activeId:()=>string|undefined,
 failed:(account:T,error:unknown)=>void,
){
 const errors=new Map<string,unknown>();
 for(const account of accounts){
  try{await sync(account)}catch(error){errors.set(account.id,error);failed(account,error)}
 }
 const active=activeId();
 if(active&&errors.has(active))throw errors.get(active);
}
