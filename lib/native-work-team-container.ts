/** Volatile presentation capability installed only by the native Team reader.
 * It grants no identity, membership or data access; every existing server check remains.
 */
export type NativeWorkTeamContainer={version:1;nonce:string;leaseId:string;accountId:string;teamId:string|null;linking:boolean};
type NativeTeamWindow=Window&{__cgNativeWorkTeamContainer?:NativeWorkTeamContainer;__cgNativeWorkTeamLease?:string;webkit?:{messageHandlers?:{cinegeniusWorkTeamContainer?:{postMessage:(value:unknown)=>void}}}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function nativeWorkTeamContainer():NativeWorkTeamContainer|null {
 if(typeof window==='undefined')return null;
 const host=window as NativeTeamWindow,value=host.__cgNativeWorkTeamContainer;
 if(typeof host.webkit?.messageHandlers?.cinegeniusWorkTeamContainer?.postMessage!=='function'||!value||value.version!==1||!uuid.test(value.nonce)||!uuid.test(value.leaseId)||typeof value.accountId!=='string'||!value.accountId||value.accountId.length>200||typeof value.linking!=='boolean'||value.teamId!==null&&!uuid.test(value.teamId))return null;
 return value;
}
export function nativeWorkTeamContainerAvailable(){return nativeWorkTeamContainer()!==null;}
export function nativeWorkTeamContainerServer(){return false;}
export function nativeWorkTeamContainerSubscribe(){return()=>{};}
export function nativeWorkTeamLease(container:NativeWorkTeamContainer){return (window as NativeTeamWindow).__cgNativeWorkTeamLease??container.leaseId;}
export function postNativeWorkTeamContainer(container:NativeWorkTeamContainer,action:'ready'|'cover'|'close'|'link'|'leaveGranted'|'leaveStayed'|'resumeFailed',extra:Record<string,string>={}) {
 if(nativeWorkTeamContainer()!==container)return;
 (window as NativeTeamWindow).webkit!.messageHandlers!.cinegeniusWorkTeamContainer!.postMessage({version:1,nonce:container.nonce,accountId:container.accountId,action,leaseId:nativeWorkTeamLease(container),...extra});
}
export function nativeWorkTeamLeaveRequest(event:Event,container:NativeWorkTeamContainer):string|null {
 const detail=(event as CustomEvent<unknown>).detail;
 if(!detail||typeof detail!=='object')return null;
 const value=detail as Record<string,unknown>;
 return value.nonce===container.nonce&&value.accountId===container.accountId&&value.leaseId===nativeWorkTeamLease(container)&&typeof value.requestId==='string'&&uuid.test(value.requestId)?value.requestId:null;
}
