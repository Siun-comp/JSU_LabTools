// SPDX-License-Identifier: GPL-2.0-or-later
import {loadVerifiedPairEngine} from './pair-loader.mjs';
import {beaconPlans,executeBeacon} from './beacon-core.mjs';
let busy=false;
self.onmessage=async({data:request})=>{if(busy)return;busy=true;const envelope={requestId:request?.requestId,revision:request?.revision};
 try{beaconPlans(request);const {run}=await loadVerifiedPairEngine();const result=await executeBeacon(request,run,(completed,total)=>self.postMessage({type:'progress',...envelope,completed,total}));self.postMessage({type:'result',...envelope,result});}
 catch(e){self.postMessage({type:'error',...envelope,message:String(e?.message||e)});}finally{busy=false;}
};
