// SPDX-License-Identifier: GPL-2.0-or-later
import {relationshipPlans,executeRelationship} from './relationship-core.mjs';
import {loadVerifiedPairEngine} from './pair-loader.mjs';
import {loadFixedParameters} from './fixed-nn.mjs';
let busy=false;
self.onmessage=async({data:q})=>{if(busy)return;busy=true;const envelope={requestId:q?.requestId,revision:q?.revision};try{const plans=relationshipPlans(q),needNative=plans.some(p=>p.native.some(e=>e.status==='ready'));
 const [engine,params]=await Promise.all([needNative?loadVerifiedPairEngine():null,q.submode==='fixed'?loadFixedParameters():null]);
 const result=await executeRelationship(q,engine?.run,params,(completed,total)=>postMessage({...envelope,type:'progress',completed,total}));postMessage({...envelope,type:'result',result});
 }catch(e){postMessage({...envelope,type:'error',message:e.message||'관계 계산 오류'});}finally{busy=false;}};
