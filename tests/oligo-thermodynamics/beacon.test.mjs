import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {normalize,selection,reverseComplement} from '../../tools/oligo-thermodynamics/sequence.mjs';
import {makeBeaconRequest,beaconPlans,executeBeacon,decorateBeacon,validateBeaconResult,compareBeacon} from '../../tools/oligo-thermodynamics/beacon-core.mjs';
import {assessStem,regionProfile,assessTarget} from '../../tools/oligo-thermodynamics/beacon-structure.mjs';
import {recordsText,recordsHTML,recordsRows} from '../../tools/oligo-thermodynamics/beacon-report.mjs';
import {createPairEngine} from '../../tools/oligo-thermodynamics/pair-loader.mjs';
const run=await createPairEngine(await fs.readFile(new URL('../../tools/oligo-thermodynamics/engine/pair/thal-pair.wasm',import.meta.url)));
const R='ATGCGCGATCTAGCTAGCGA',raw='AAA'+R+'TTT';
const c={temperature:60,na:50,k:0,nh4:0,mg:3,dntp:.8,a:200,b:600};
const input=(r=R)=>({raw:'AAA'+r+'TTT',parsed:normalize('AAA'+r+'TTT'),range:selection(r.length+6,4,r.length+3),parentName:'=source <R>',coordinateDraft:false,role:'Beacon',memo:'synthetic only',conditions:c});
const target=t=>({raw:t,parsed:normalize(t),range:t?selection(t.length,1,t.length):null,coordinateDraft:false,name:'=Target',origin:'user-entered',generatedFromRecognition:null});
const settings=(r=R)=>({stem5Raw:'CCT',stem3Raw:'AGG',stem3Mode:'linked',target:target(reverseComplement(r)),siteMode:'auto',siteStartRaw:'',siteEndRaw:'',apiRaw:'200'});
const request=(i=input(),s=settings())=>makeBeaconRequest(i,s,1,0);
const result=async(i=input(),s=settings())=>decorateBeacon(await executeBeacon(request(i,s),run),{parentRaw:i.raw,targetRaw:s.target.raw,calculatedAt:'2026-10-28T00:00:00Z'});
test('minimum loop and exact length61 are dependency limits rather than automatic clipping',async()=>{
 const low=await result(input('AT'),settings('AT'));assert.equal(low.entries[0].status,'unsupported');assert.equal(low.entries[2].status,'unsupported');assert(low.entries[1].calculation);
 const r='ATGCA'.repeat(10)+'A',s={...settings(r),stem5Raw:'GCGAC'};const v=await result(input(r),s);assert.equal(v.request.design.assembly.length,61);assert.equal(v.entries[0].status,'unsupported');assert(v.entries[2].calculation);assert.equal(v.request.design.recognition.sequence.length,51);
});
test('Target flanks leave fixed isolated Beacon hairpin unchanged and change only the requested Target scope',async()=>{
 const x=await result(),s={...settings(),target:target('AAAA'+reverseComplement(R)+'TTTT'),siteMode:'explicit',siteStartRaw:'5',siteEndRaw:'24'},y=await result(input(),s);
 assert.equal(x.entries[0].status,y.entries[0].status);assert.deepEqual(x.entries[0].calculation.thermodynamics,y.entries[0].calculation.thermodynamics);assert.equal(x.entries[0].calculation.request.strandA,y.entries[0].calculation.request.strandA);assert.notEqual(x.entries[2].calculation.request.strandB,y.entries[2].calculation.request.strandB);
});
test('post-matrix exact-stem branch allows only same-reaction closed-reference deltas',async()=>{
 const i={...input('AAAAAA'),conditions:{...c,temperature:37}},a=await result(i,{...settings('AAAAAA'),stem5Raw:'GCGC'}),b=await result(i,{...settings('AAAAAA'),stem5Raw:'GCGCGC'});
 assert.equal(a.annotations.stem.status,'exact-intended');assert.equal(b.annotations.stem.status,'exact-intended');assert.equal(a.annotations.stem.expectedCount,4);assert.equal(b.annotations.stem.expectedCount,6);
 const diff=compareBeacon(b,a).analyses['beacon-hairpin'];assert.equal(diff.dg,b.entries[0].calculation.thermodynamics.dg-a.entries[0].calculation.thermodynamics.dg);
 const rows=recordsRows([b],{base:a}),v=Object.fromEntries(rows[0].map((h,i)=>[h,rows[1][i]]));assert.equal(v.duplex_ddG_kcal_mol,'');assert.equal(JSON.parse(v.beacon_comparison_json).dg,diff.dg);
});
test('assembly, role-specific API and two parent coordinate systems remain explicit',()=>{
 const r=request(),p=beaconPlans(r);assert.equal(r.design.assembly.sequence,'CCT'+R+'AGG');assert.deepEqual(r.design.assembly.regions,{S5:[1,3],R:[4,23],S3:[24,26]});
 assert.deepEqual(r.design.assembly.expectedPairs,[{left:1,right:26},{left:2,right:25},{left:3,right:24}]);
 assert.equal(p[0].request.conditions.dnaConcentrationNm,200);assert.equal(p[1].request.conditions.dnaConcentrationNm,600);assert.equal(p[2].request.conditions.dnaConcentrationNm,200);
 assert.equal(p[2].request.input1Role,'independent-recognition-fragment');
});
test('missing Target does not block valid Beacon hairpin and has no zero placeholders',async()=>{
 const r=await result(input(),{...settings(),target:target('')});assert.equal(r.entries[0].calculation.request.strandA,'CCT'+R+'AGG');
 assert(r.entries.slice(1).every(e=>e.status==='not-requested'&&!('calculation'in e)));assert.equal(r.annotations.target.unpairedCount,null);
});
test('invalid or overlength assembly permits only independent valid molecules',async()=>{
 for(const s of [{...settings(),stem5Raw:'N'},{...settings(),stem5Raw:'G'.repeat(30)}]){
  const r=await result(input(),s);assert(!r.entries[0].calculation);assert(!r.entries[3].calculation);assert(r.entries[1].calculation);assert(r.entries[2].calculation);
 }
});
test('invalid API blocks two dimers but preserves concentration-independent hairpins',async()=>{
 const r=await result(input(),{...settings(),apiRaw:''});assert(r.entries.slice(0,2).every(e=>e.calculation));assert(r.entries.slice(2).every(e=>e.status==='invalid-input'&&!e.calculation));
});
test('noncanonical arms remain raw model inputs without an invented expected stem',async()=>{
 const r=await result(input(),{...settings(),stem3Mode:'manual',stem3Raw:'TTT'});assert.equal(r.request.design.assembly.canonical,false);assert.equal(r.annotations.stem.status,'not-defined');assert.equal(r.annotations.stem.matchedCount,null);
});
test('explicit site is optional, range/length checked, and never changes native input sequences',()=>{
 const s={...settings(),target:target('AAAA'+reverseComplement(R)+'TTTT')};assert.equal(request(input(),s).design.site.status,'unspecified');
 const a=request(input(),{...s,siteMode:'explicit',siteStartRaw:'5',siteEndRaw:'24'});assert.equal(a.design.site.complementary,true);
 const b=request(input(),{...s,siteMode:'explicit',siteStartRaw:'5',siteEndRaw:'23'});assert.equal(b.design.site.status,'invalid');
 assert.deepEqual(beaconPlans(a).map(p=>p.request?.strandA),beaconPlans(b).map(p=>p.request?.strandA));
});
test('hand-derived stem graph oracle distinguishes exact, extra, partial, shifted and unknown',()=>{
 const assembly={canonical:true,expectedPairs:[{left:1,right:15},{left:2,right:14},{left:3,right:13}]};
 const entry=pairs=>({status:'ok',calculation:{structure:{status:'ok',pairs}}});
 assert.equal(assessStem(assembly,entry(assembly.expectedPairs)).status,'exact-intended');
 assert.equal(assessStem(assembly,entry([...assembly.expectedPairs,{left:4,right:12}])).status,'stem-plus-extra');
 assert.equal(assessStem(assembly,entry(assembly.expectedPairs.slice(1))).status,'partial-stem');
 assert.equal(assessStem(assembly,entry([{left:1,right:14},{left:2,right:13}])).status,'alternative-structure');
 assert.equal(assessStem(assembly,{status:'no-structure'}).matchedCount,null);
 assert.equal(assessStem(assembly,{status:'ok',calculation:{structure:{status:'unavailable'}}}).status,'unavailable');
});
test('single-returned-structure profile maps parent positions and counts runs without probabilities',()=>{
 const e={status:'ok',calculation:{structure:{status:'ok',pairs:[{left:1,right:7},{left:2,right:6}]}}};
 const r=regionProfile(e,3,7,'region',()=> 'S5',i=>100+i);assert.equal(r.unpairedCount,3);assert.deepEqual(r.longestUnpaired,{start:3,end:5,length:3});assert.equal(r.bases[0].parent,103);assert.equal(r.bases[3].state,'paired-with-S5');
 assert.equal(regionProfile({status:'no-structure'},1,20,'unknown').unpairedCount,null);assert(!('probability'in r));
});
test('target alignment oracle distinguishes intended, stem-only and wrong target register',()=>{
 const r=request(),n=R.length,entry=pairs=>({analysisId:'beacon-target-any',status:'ok',calculation:{structure:{status:'ok',pairs}}});
 const p=Array.from({length:n},(_,i)=>({a:4+i,b:n-i,bases:'A–T',watsonCrick:true}));
 const a=assessTarget(r,entry(p));assert.equal(a.status,'intended-only');assert.equal(a.contacts[0].parentR,4);assert.equal(a.contacts[0].parentTarget,20);
 assert.equal(assessTarget(r,entry([{a:1,b:1,watsonCrick:true}])).status,'stem-only');
 assert.equal(assessTarget(r,entry(p.slice(1))).status,'partial-or-alternative');
 const shifted=assessTarget(r,entry(p.slice(1).map(x=>({...x,b:x.b+1}))));assert.equal(shifted.intendedGeometryCount,0);assert.equal(shifted.recognitionContactCount,19);assert.deepEqual(shifted.unboundRecognition,[1]);
 const nonWC=assessTarget(r,entry(p.map((x,i)=>({...x,watsonCrick:i!==0}))));assert.equal(nonWC.intendedGeometryCount,20);assert.equal(nonWC.intendedWCCount,19);assert.equal(nonWC.nonWCContacts.length,1);assert.equal(nonWC.status,'partial-or-alternative');
 const s={...settings(),target:target('AAAA'+reverseComplement(R)+'TTTT'),siteMode:'explicit',siteStartRaw:'5',siteEndRaw:'24'},long=request(input(),s);
 const extra=assessTarget(long,entry([...p.map(x=>({...x,b:x.b+4})),{a:1,b:1,watsonCrick:true}]));assert.equal(extra.status,'intended-plus-other');assert.equal(extra.stemContactCount,1);assert.equal(extra.outsideSiteCount,1);
});
test('tampered request, units, raw structure, graph annotations and missing fields fail closed',async()=>{
 const good=await result();for(const mutate of [r=>r.request.design.assembly.sequence='A'.repeat(26),r=>r.entries.pop(),r=>r.entries[3].calculation.units.dg='cal/mol',
  r=>r.entries[3].calculation.thermodynamics.dg+=1,r=>r.entries[3].calculation.structure.pairs[0].a++,r=>r.annotations.stem.matchedCount=123]){
  const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateBeaconResult(bad,good.request));
 }
});
test('same R/Target negative control survives stem edits and metadata/site changes',async()=>{
 const a=await result(),b=await result(input(),{...settings(),stem5Raw:'GCGAC'});
 for(const i of [1,2])assert.deepEqual(a.entries[i].calculation.thermodynamics,b.entries[i].calculation.thermodynamics);
 assert.equal(compareBeacon(a,{request:{}}).analyses['beacon-hairpin'].dg,null);
 const changed=await result({...input(),conditions:{...c,mg:0}});assert.equal(compareBeacon(a,changed).analyses['beacon-target-any'].dg,null);
});
test('exports preserve both parent opt-ins, source/analysis roles, partial blanks and escaped text',async()=>{
 const r=await result(),rows=recordsRows([r]);assert.equal(rows.length,5);assert(rows[0].includes('beacon_stem5_5to3'));
 assert(!recordsText([r]).includes(raw));assert(recordsText([r],{includeParent:true}).includes(raw));assert(recordsHTML([r]).includes('&lt;R&gt;'));
 assert(!rows[0].includes('beacon_target_raw_explicitly_included'));assert(recordsRows([r],{includeParent:true})[0].includes('beacon_target_raw_explicitly_included'));
 const p=await result(input(),{...settings(),target:target('')}),data=recordsRows([p]);assert(data.slice(2).every(row=>row[data[0].indexOf('dG_kcal_mol')]===''));
});
