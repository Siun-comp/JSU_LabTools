// SPDX-License-Identifier: GPL-2.0-or-later
// Exact coordinate bookkeeping only. No energy, probability or kinetic calculation.
const key=p=>`${p.left}:${p.right}`;
const absent=status=>({status,matchedCount:null,expectedCount:null,matched:[],missing:[],extra:[]});
export function assessStem(assembly,entry){
 if(!assembly.canonical)return absent('not-defined');
 if(entry.status!=='ok')return absent(entry.status);
 const s=entry.calculation.structure;if(s?.status!=='ok')return absent('unavailable');
 const expected=assembly.expectedPairs,P=new Set(s.pairs.map(key)),E=new Set(expected.map(key));
 const matched=expected.filter(p=>P.has(key(p))),missing=expected.filter(p=>!P.has(key(p))),extra=s.pairs.filter(p=>!E.has(key(p)));
 return {status:matched.length===expected.length?(extra.length?'stem-plus-extra':'exact-intended'):matched.length?'partial-stem':'alternative-structure',
  matchedCount:matched.length,expectedCount:expected.length,matched,missing,extra};
}
export function regionProfile(entry,start,end,label,regionOf=()=> 'same-region',parentOf=()=>null){
 if(entry.status!=='ok'||entry.calculation.structure?.status!=='ok'||!Number.isInteger(start)||!Number.isInteger(end)||end<start)
  return {status:entry.status==='ok'?'unavailable':entry.status,label,bases:[],unpairedCount:null,longestUnpaired:null};
 const partners=new Map();for(const p of entry.calculation.structure.pairs){partners.set(p.left,p.right);partners.set(p.right,p.left);}
 const bases=[];let unpairedCount=0,best=null,run=null;
 for(let i=start;i<=end;i++){
  const partner=partners.get(i)??null,state=partner===null?'unpaired-in-returned-structure':`paired-with-${regionOf(partner)}`;
  bases.push({position:i,local:i-start+1,parent:parentOf(i),partner,state});
  if(partner===null){unpairedCount++;run=run?{start:run.start,end:i,length:run.length+1}:{start:i,end:i,length:1};if(!best||run.length>best.length)best={...run};}else run=null;
 }
 return {status:'ok',label,bases,unpairedCount,longestUnpaired:best};
}
export function assessTarget(request,entry){
 const {assembly,recognition,target,site}=request.design;
 if(entry.status!=='ok'||entry.calculation.structure?.status!=='ok')return {status:entry.status==='ok'?'unavailable':entry.status,contacts:[],unboundRecognition:null,nonWCContacts:null,recognitionContactCount:null,intendedGeometryCount:null,intendedWCCount:null,stemContactCount:null,outsideSiteCount:null};
 const whole=entry.analysisId==='beacon-target-any',r=recognition.sequence.length,contacts=[];
 let geometry=0,wc=0,stem=0,outside=0;const R=new Set();
 for(const p of entry.calculation.structure.pairs){
  const localR=whole?p.a-assembly.a:p.a,inRecognition=localR>=1&&localR<=r;
  const intended=site.status==='defined'&&inRecognition&&p.b===site.end-localR+1;
  if(inRecognition)R.add(localR);else stem++;
  if(intended){geometry++;if(p.watsonCrick)wc++;}
  if(site.status==='defined'&&(p.b<site.start||p.b>site.end))outside++;
  contacts.push({...p,recognitionLocal:inRecognition?localR:null,beaconLocal:whole?p.a:assembly.status==='ok'?assembly.a+p.a:null,
   parentR:inRecognition&&recognition.selection?recognition.selection.start+localR-1:null,
   parentTarget:target.selection.start+p.b-1,intendedGeometry:intended});
 }
 let status=site.status==='defined'?(wc===r&&geometry===r&&!stem&&!outside&&contacts.length===r?'intended-only':stem&&!R.size?'stem-only':wc===r?'intended-plus-other':'partial-or-alternative'):'observed-contacts-only';
 if(site.status==='defined'&&!site.complementary)status='input-noncomplementary';
 return {status,contacts,unboundRecognition:Array.from({length:r},(_,i)=>i+1).filter(i=>!R.has(i)),nonWCContacts:contacts.filter(p=>!p.watsonCrick),recognitionContactCount:R.size,intendedGeometryCount:site.status==='defined'?geometry:null,
  intendedWCCount:site.status==='defined'?wc:null,stemContactCount:stem,outsideSiteCount:site.status==='defined'?outside:null};
}
export function beaconAnnotations(request,entries){
 const by=id=>entries.find(e=>e.analysisId===id),d=request.design;
 const region=i=>i<=d.assembly.a?'S5':i<=d.assembly.a+d.recognition.sequence.length?'R':'S3';
 const start=d.assembly.a+1,end=d.assembly.a+d.recognition.sequence.length;
 const scope=d.site.status==='defined'?[d.site.start,d.site.end]:[1,d.target.sequence.length];
 return {stem:assessStem(d.assembly,by('beacon-hairpin')),
  recognition:regionProfile(by('beacon-hairpin'),start,end,'Beacon 반환 구조의 인식 영역',region,i=>d.recognition.selection?d.recognition.selection.start+i-start:null),
  target:regionProfile(by('target-hairpin'),scope[0],scope[1],d.site.status==='defined'?'Target 반환 구조의 의도 site':'Target 반환 구조의 선택 전체',()=> 'Target',i=>d.target.selection?d.target.selection.start+i-1:null),
  recognitionTarget:assessTarget(request,by('recognition-target-any')),beaconTarget:assessTarget(request,by('beacon-target-any'))};
}
