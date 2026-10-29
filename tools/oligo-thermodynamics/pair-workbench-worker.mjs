// SPDX-License-Identifier: GPL-2.0-or-later
import {loadVerifiedPairEngine} from './pair-loader.mjs';
import {workbenchPlans,executeWorkbench} from './pair-workbench-core.mjs';
let busy=false;
self.onmessage=async({data:request})=>{
 if(busy)return;busy=true;
 const envelope={requestId:request?.requestId,revision:request?.revision};
 try{workbenchPlans(request);const {run}=await loadVerifiedPairEngine();
  const result=await executeWorkbench(request,run,(completed,total)=>self.postMessage({type:'progress',...envelope,completed,total}));
  self.postMessage({type:'result',...envelope,result});
 }catch(e){self.postMessage({type:'error',...envelope,message:String(e?.message||e)});}finally{busy=false;}
};
