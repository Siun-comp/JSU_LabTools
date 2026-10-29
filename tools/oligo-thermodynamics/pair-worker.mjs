// SPDX-License-Identifier: GPL-2.0-or-later
import {loadVerifiedPairEngine} from './pair-loader.mjs';
import {makePairSuite} from './pair-core.mjs';
let engine=null,busy=false,failed=false;
self.onmessage=async event=>{
  const {type,id,input}=event.data||{};
  if(type!=='calculate' || !Number.isSafeInteger(id) || id<1) return;
  if(busy || failed){self.postMessage({type:'error',id,message:failed?'Discard failed Worker and create a new instance':'Worker is busy',fatal:failed});return;}
  busy=true;let validated=false;
  try {
    const suite=makePairSuite(input);validated=true;
    engine??=await loadVerifiedPairEngine();
    const entries=[];
    for(const request of suite.requests){
      const calculation=engine.run(request);
      entries.push({analysisId:request.analysisId,reaction:request.reaction,calculation});
      self.postMessage({type:'progress',id,completed:entries.length,total:suite.requests.length});
    }
    self.postMessage({type:'result',id,result:{schemaVersion:suite.schemaVersion,basis:suite.basis,
      decisionUtility:'not-established',entries,engineVersion:engine.manifest.version,memoryBytes:engine.run.memoryBytes}});
  } catch(error) {
    failed=validated;
    self.postMessage({type:'error',id,message:String(error?.message||error),fatal:failed});
  } finally {busy=false;}
};
