import {runAnalysis} from './core.mjs';
self.onmessage=({data})=>{try{let last=0;const result=runAnalysis(data.records,data.mode,data.options,progress=>{if(performance.now()-last>150){self.postMessage({progress});last=performance.now();}});self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};
