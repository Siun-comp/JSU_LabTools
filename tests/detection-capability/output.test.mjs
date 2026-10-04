import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),source=fs.readFileSync(new URL('../../tools/detection-capability/result-export.js',import.meta.url),'utf8');
// Execute real output adapter functions with synthetic input and no browser/clipboard.
const functions=source.slice(source.indexOf(' const fieldNames='),source.indexOf(' const short='));
const report=source.slice(source.indexOf(' function reportPayload(x){'),source.indexOf(' excelButton.onclick='));
const api=vm.runInNewContext(`(()=>{const graphReady=()=>false,criterion=s=>s,sourceSummary=()=>"direct synthetic",BrowserExcel={version:"test"},AppRelease={version:"0.9.1-beta.3",developer:"Jang Si Un"},LoDCIContract={describe:()=>"held synthetic"};${functions}${report}return {tsv,summaryTSV,rows,reportPayload,cell};})()`);
const q={c:[1,2,3,4],n:[20,20,20,20]},e={status:'candidate',residualDF:2,pearson:2,deviance:4,expectedPositive:[1,8,12,19],expectedNegative:[19,12,8,1],diagnostics:[],coefficients:[0,1],modelDoseCandidate:3,method:{id:'binomial-probit-log10',sourceSHA256:'a'.repeat(64)},ci:{status:'held',lower:null,upper:null,confidence:.95},fittedProbability:[.05,.4,.6,.95]};
e.gof=require('../../tools/detection-capability/lod-gof-contract.js').fromFields({gofStatus:'calculated',pearsonP:String(Math.exp(-1)),devianceP:String(Math.exp(-2)),pearsonPerDF:'1'},e,q);
const x={k:'lod',e,s:{input:{data:{unit:'ng/mL',setting:.95,rows:[{concentration:1,n:20,positive:1}]},warnings:[],revision:1},observations:[{concentration:1,n:20,positive:1,negative:19,observedRate:.05}]}};
const text=api.tsv(x),summary=api.summaryTSV(x),payload=api.reportPayload(x);
for(const marker of ['Pearson 근사 p값','Deviance 근사 p값','Pearson/자유도','최소 기대 양성','최소 기대 음성','SMALL_EXPECTED_COUNT','chi-square-upper-tail','minimal-export-4','ciDispersion']){
 const actual=marker==='ciDispersion'?'현재 CI 분산계수':marker;assert(text.includes(actual),actual);
}
assert(text.includes(String(Math.exp(-1))));assert(summary.includes('자동 판정/CI 분산 보정 없음'));assert(payload.details.some(row=>row[0]==='적합도 진단 · 방법 · 버전'&&row[1]==='1.0.0'));assert(payload.details.some(row=>row[0]==='적합도 진단 · 방법 · 현재 CI 분산계수'&&row[1]===1));
assert.equal(api.cell('=1+1'),"'=1+1");assert.equal(api.cell('a\tb'),String.raw`a\tb`);assert.equal(payload.module,'lod');assert.equal(payload.graph,null);
const serialized=JSON.parse(JSON.stringify({archivedResults:{lod:e}}));assert.equal(serialized.archivedResults.lod.gof.pearsonP,Math.exp(-1));
console.log('PASS: real LoBDQ detail/summary TSV and Excel payload carry synthetic GOF values, method/version, warnings and CI dispersion; text protection retained. No OS clipboard/Excel test.');
