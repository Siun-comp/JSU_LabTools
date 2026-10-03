/* Existing confirmation/LoQ R bodies over shared browser transport only. */
'use strict';
(function(root){
 function fields(output){const f={};if(typeof output!=='string'||output.length>500000)throw Error('invalid_response');for(const line of output.trim().split(/\r?\n/)){const pair=line.split('\t');if(pair.length!==2||Object.hasOwn(f,pair[0]))throw Error('invalid_response');f[pair[0]]=pair[1];}if(f.status!=='calculated')throw Error('execution_failed');return f;}
 function vector(f,key,length){const a=f[key]?.split(',');if(a?.length!==length||a.some(v=>!v.trim()||!Number.isFinite(Number(v))))throw Error('invalid_response');return a.map(Number);}
 function create(options={}){
  const contracts=options.contracts||{confirmation:root.ConfirmationContract,loq:root.LoQContract},sources=options.sources||root.ContinuousBrowserSources;
  const runtime=options.runtime||root.BrowserRRuntime.shared;
  function run(module,q,settings){if(!['confirmation','loq'].includes(module))return Promise.reject(Error('input_blocked'));const contract=contracts[module],source=sources[module];if(!contract||!source)return Promise.reject(Error('input_blocked'));
   const task={source,needsMASS:false,label:module==='confirmation'?'관측률·신뢰구간':'LoQ 총오차',validate:module==='confirmation'?contract.validate:q=>contract.validate(q).length===0,
    encode:module==='confirmation'?q=>q.k.map((k,i)=>[k,q.n[i]].join('\t')).join('\n')+'\n':q=>q.samples.flatMap((s,i)=>s.values.map(v=>[i+1,s.referenceValue,v].join('\t'))).join('\n')+'\n',
    decode:(output,q,env,stderr)=>{if(stderr)throw Error('execution_failed');const f=fields(output);if(f.rVersion!==env.rVersion||f.statsVersion!==env.statsVersion)throw Error('invalid_response');let e;
     if(module==='confirmation')e=contract.assemble(q,vector(f,'lower',q.c.length),vector(f,'upper',q.c.length),env);
     else{const keys=['n','mean','sd','bias','te','teFraction'],v=Object.fromEntries(keys.map(k=>[k,vector(f,k,q.samples.length)]));e=contract.assemble(q,q.samples.map((_,i)=>Object.fromEntries(keys.map(k=>[k,v[k][i]]))),env);}
     if(!contract.validResponse(e,q))throw Error('invalid_response');return e;}};
   return runtime.run(task,q,settings);
  }
  return {run,state:runtime.state};
 }
 const api={create,fields,vector};if(typeof module==='object'&&module.exports)module.exports=api;else root.BrowserContinuous={...api,...create()};
})(globalThis);
