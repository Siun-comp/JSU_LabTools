// SPDX-License-Identifier: GPL-2.0-or-later
import {makeRequest,inputKey,metadata,freeze,validateResult,hasTm,UI_VERSION} from './analysis-core.mjs';
import {display,conditionText,STATUS,structureReport} from './report.mjs';
import {parseHairpin,textHTML} from './structure.mjs';
import {writeClipboard} from './clipboard.mjs';
import {makeSuiteRequest,validateSuiteResult,suiteMetadata,pointRecord,gridPoints} from './suite-core.mjs';
import {recordsText,recordsHTML,recordsCSV,compareRecords as compare} from './relationship-report.mjs';
import {beaconStructureText} from './beacon-report.mjs';
import {initRelationshipUI} from './relationship-ui.mjs';
import {isRelationshipRecord,isFixedRecord} from './relationship-core.mjs';
import {renderRelationship} from './relationship-view.mjs';
import {relationStructureText,fixedStructureText} from './relationship-report.mjs';
import {entryStructureText} from './workbench-report.mjs';
import {makeBeaconRequest,beaconCount,beaconPlans,validateBeaconResult,decorateBeacon,isBeacon} from './beacon-core.mjs';
import {initBeaconInput} from './beacon-input.mjs';
import {renderBeacon} from './beacon-view.mjs';
import {makeWorkbenchRequest,pairPartner,workbenchCount,validateWorkbenchResult,decorateWorkbench,isPair,workbenchPlans} from './pair-workbench-core.mjs';
import {renderWorkbench} from './pair-workbench-view.mjs';
import {renderSuite} from './suite-view.mjs';
import {conditionIssue,conditionFieldIssue} from './conditions.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
export function initAnalysis({readInput,refreshSelection=()=>{}}){
 let revision=0,requestId=0,key=null,current=null,pending=null,worker=null,timer=null,debounce=null,state='idle',message='',pins=[],nextPin=1,baseId=null,mode='basic',selectedPoint=0;
 let pairStructure='AB-heterodimer',rendered=null,renderedMode=null,waitingSince=null,noticeTimer=null;
 const openPins=new Set();
 const MODES=['basic','pair','terminal','temperature','relationship','beacon'];let relationshipUI=null;
 const beaconInput=initBeaconInput({readRecognition:readInput,onChange:syncInput});
 const pairSettings=()=>({partnerMode:$('partner-mode').value,partnerRaw:$('partner-raw').value,partnerName:$('partner-name').value,engineReferenceNm:$('pair-api').value,includeEnds:$('pair-ends').checked,includePCR:$('pair-pcr').checked});
 const AUTO_DELAY=160,expanded=new Set(),cache=new Map(),blocked=new Set(),selectedPoints=new Map();let settingsKeys={};
 const settings=()=>({n:$('window-size').value,start:$('scan-start').value,end:$('scan-end').value,step:$('scan-step').value,includeHairpin:$('scan-hairpin').checked});
 const settingKeys=()=>{const s=settings(),pair=pairSettings();return {
  basic:'',terminal:JSON.stringify([s.n]),temperature:JSON.stringify(s),beacon:JSON.stringify(beaconInput.read()),
  pair:JSON.stringify([pair.partnerMode,pair.partnerRaw,pair.engineReferenceNm,pair.includeEnds,pair.includePCR])
 };};
 function stop(){clearTimeout(noticeTimer);noticeTimer=null;if(debounce!==null)clearTimeout(debounce);debounce=null;if(timer)clearTimeout(timer);timer=null;if(worker)worker.terminate();worker=null;pending=null;}
 function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
 function ready(){try{if(mode==='basic')makeRequest(readInput(),1,revision);else if(mode==='beacon'){const r=makeBeaconRequest(readInput(),beaconInput.read(),1,revision);if(!beaconCount(r))return beaconPlans(r).map(p=>p.reason).filter(Boolean).join(' ');}else if(mode==='pair')makeWorkbenchRequest(readInput(),pairSettings(),1,revision);else makeSuiteRequest(readInput(),mode,settings(),1,revision);return '';}catch(e){return e.message;}}
 function recoveryIssue(input){
  const issue=conditionIssue(input.conditions);
  if(issue)return {...issue,panel:'conditions-panel',label:'반응 조건 수정'};
  if(mode==='beacon')return {label:'Beacon 입력·조건 확인'};
  if(!input.parsed.ok||!input.parsed.seq)return {field:'raw',panel:'input-panel',label:'서열 입력 확인'};
  if(input.coordinateDraft||input.range?.length<2||input.range?.length>60)return {field:'end',label:'선택 구간 수정'};
  if(mode==='pair'){
   try{pairPartner('',pairSettings());}catch{if($('partner-mode').value==='manual')return {field:'partner-raw',label:'B 가닥 수정'};}
   if(conditionFieldIssue('a',$('pair-api').value))return {field:'pair-api',label:'API 농도 수정'};
   if($('partner-name').value.trim().length>200)return {field:'partner-name',label:'B 이름 수정'};
   if(Number(input.conditions.na)+Number(input.conditions.k)+Number(input.conditions.nh4)===0&&Number(input.conditions.mg)<=Number(input.conditions.dntp))
    return {field:'na',panel:'conditions-panel',label:'반응 조건 수정'};
  }
  if(['terminal','temperature'].includes(mode)){
   const {n,start,end,step}=settings(),length=Number(n);
   if(!Number.isInteger(length)||length<3||length>10||length>input.range?.length)return {field:'window-size',label:'말단 길이 수정'};
   if(mode==='temperature'){
    try{gridPoints(start,end,step);}catch{return {field:conditionFieldIssue('temperature',start)?'scan-start':conditionFieldIssue('temperature',end)||Number(end)<Number(start)?'scan-end':'scan-step',label:'온도 격자 수정'};}
   }
  }
  return {field:'role',panel:'strand-panel',label:'입력 확인'};
 }
 function resultState(value,m){if(m==='beacon')return value.entries.some(e=>!['ok','no-structure'].includes(e.status))?'partial':'complete';if(m==='pair')return 'complete';const records=m==='basic'?[value]:value.points.flatMap(p=>p.entries.map(e=>e.record));return records.some(v=>['duplex','hairpinA','hairpinB'].some(k=>['tm-only','unsupported','error'].includes(v[k].status)))?'partial':'complete';}
 function currentRecord(){return current?(['basic','pair','beacon'].includes(mode)?current:pointRecord(current,selectedPoint)):null;}
 function exportRecords(){return !current?[]:['basic','pair','beacon'].includes(mode)?[current]:current.points.map((_,i)=>pointRecord(current,i));}
 function buttons(){
  if(mode==='relationship'){for(const id of ['copy-pins','save-pins','csv-pins','clear-pins'])$(id).disabled=pins.length===0;return;}
  $('partner-raw').disabled=$('partner-mode').value!=='manual';
  const reason=ready();$('calculate').disabled=Boolean(reason)||state==='running';$('cancel-calculation').disabled=!['running','queued'].includes(state);$('calculation-input-hint').textContent=reason;
  for(const id of ['copy-result','save-result','csv-result','pin-result'])$(id).disabled=!current;
  for(const id of ['copy-pins','save-pins','csv-pins','clear-pins'])$(id).disabled=pins.length===0;
  const inFlight=['queued','running'].includes(state);
  const retaining=rendered&&renderedMode===mode&&!current&&(inFlight||state==='stale');
  const delay=inFlight&&waitingSince!==null?250-(performance.now()-waitingSince):0;
  if(delay>0&&noticeTimer===null)noticeTimer=setTimeout(()=>{noticeTimer=null;buttons();},Math.ceil(delay));
  const statusNode=$('calculation-status');
  const label=retaining?(inFlight&&delay<=0?'이전 조건 · 새 결과 계산 중':'이전 조건의 결과'):
   delay>0?'':message||(!$('auto-calculate').checked&&!reason?'자동 계산 꺼짐 · 수동으로 실행하세요.':'서열과 구간을 선택하세요.');
  if(statusNode.textContent!==label)statusNode.textContent=label;
  statusNode.dataset.state=state;
  $('current-result').setAttribute('aria-busy',String(state==='running'));
  $('review-input').hidden=!reason;const input=readInput();
  $('review-input').textContent=reason?recoveryIssue(input).label:'입력 확인';
  $('window-size').setAttribute('aria-invalid',String(['terminal','temperature'].includes(mode)&&(!Number.isInteger(Number($('window-size').value))||Number($('window-size').value)<3||Number($('window-size').value)>10||Number($('window-size').value)>input.range?.length)));
  const r=currentRecord();if(!retaining)$('copy-scope').textContent=r?(mode==='beacon'?`출력 대상: Beacon4분석 · R 원본 ${r.request.selection?`${r.request.selection.start}–${r.request.selection.end}`:'미확정'} / Target ${r.request.design.target.selection?`${r.request.design.target.selection.start}–${r.request.design.target.selection.end}`:'미확정'}`:`출력 대상: ${mode==='temperature'?`온도표 전체 ${current.points.length}점 · 보관은 ${r.request.conditions.temperature}°C 행`:'현재 결과'} · 원본 선택 ${['basic','pair'].includes(mode)?r.request.selection.start:current.request.source.selection.start}–${['basic','pair'].includes(mode)?r.request.selection.end:current.request.source.selection.end}`):'출력 대상: 현재 결과 없음';
  $('calculate').textContent=mode==='temperature'?'온도 비교 실행':'지금 계산';$('copy-result').textContent=mode==='temperature'?'온도표 전체 복사':'현재 결과 복사';
  $('auto-scope').textContent=mode==='temperature'?'기본/말단/두 가닥/Beacon에 적용 · 온도 비교는 수동 실행':'160 ms';
  if(mode==='beacon'&&$('selection-summary').textContent.includes('독립 oligo'))$('selection-summary').textContent=$('selection-summary').textContent.replace('독립 oligo','인식 영역 R');
  $('analysis-heading').textContent=mode==='beacon'?'3. Beacon 설계 · THAL':mode==='basic'?'3. 열역학 분석':mode==='terminal'?'3. 말단 구간 비교':mode==='pair'?'3. 두 가닥 · THAL 모델':'3. 온도 비교';
 }
 function recoverBeacon(reason){const i=readInput();if(/인식 영역 R/.test(reason)||!i.parsed.ok&&!/Target|API/.test(reason)){$('input-panel').open=true;(i.coordinateDraft?$('start'):$('raw')).focus();}else beaconInput.focusError(reason);}
 function beaconCopy(record,entry,rawOnly){const text=beaconStructureText(record,entry,rawOnly);writeClipboard(text,textHTML(text)).then(format=>{$('result-copy-status').textContent=`Beacon 구조를 ${format==='formatted'?'서식 포함':'일반 텍스트로'} 복사했습니다.`;}).catch(()=>{$('result-copy-status').textContent='구조 복사 실패 · TXT를 사용하세요.';});}
 function pairCopy(record,entry,rawOnly){const text=entryStructureText(entry,record.request,{rawOnly});$('result-copy-status').textContent='';writeClipboard(text,textHTML(text)).then(format=>{$('result-copy-status').textContent=`${record.id||'현재'} ${entry.analysisId} 구조를 ${format==='formatted'?'서식 포함':'일반 텍스트로'} 복사했습니다.`;}).catch(()=>{$('result-copy-status').textContent='구조를 복사하지 못했습니다. TXT에서 확인하세요.';});}
 function metricList(values){
   const list=el('dl',undefined,'metrics');
   for(const [name,value,unit,help] of values){
    const label=el('dt',name),hint=button('?',()=>openMetric(help));hint.className='metric-help';hint.setAttribute('aria-label',`${name} 의미와 해석`);hint.setAttribute('aria-haspopup','dialog');label.append(hint);
    const available=Number.isFinite(value),valueNode=el('dd',available?display(value):'미지원',available?'':'metric-unavailable');if(available)valueNode.append(el('small',unit));list.append(label,valueNode);
   }
   return list;
 }
 function structureView(record,key){
  const r=record.request,raw=record[key].structure,sequence=key==='hairpinA'?r.strandA:r.strandB,s=parseHairpin(raw,sequence,r.contract.hairpin);
  const detail=el('details',undefined,'structure-detail');detail.dataset.detail=key+':structure';detail.append(el('summary','구조·염기쌍 확인'));
  if(s.status==='ok'){
   detail.append(el('p','5′→3′ · ( ) 염기쌍 · . 비결합','structure-caption'),el('pre',`seq  ${sequence}\nstr  ${s.dotBracket}`,'structure-text'));
   const pairs=el('details');pairs.dataset.detail=key+':pairs';pairs.append(el('summary',`염기쌍 좌표 · ${s.pairs.length}쌍`),el('p','독립 oligo의 1-based 좌표입니다.','hint'));
   const list=el('dl',undefined,'pair-list');for(const p of s.pairs)list.append(el('dt',`${p.left} ↔ ${p.right}`),el('dd',p.bases));pairs.append(list);detail.append(pairs);
  }else detail.append(el('p','구조 표기 변환 불가 · '+s.reason,'hint'));
  const copyButton=button('서열·구조·좌표 복사',()=>copyStructure(record,key));copyButton.setAttribute('aria-label',`${key==='hairpinA'?'A':'B'} hairpin 구조 복사`);detail.append(copyButton);
  const original=el('details');original.dataset.detail=key+':raw';original.append(el('summary','THAL 원문'),el('pre',raw,'structure-text'),button('THAL 원문 복사',()=>copyStructure(record,key,true)));detail.append(original,el('p','THAL 반환 구조의 표기입니다. 구조 확률·MFE를 새로 계산하지 않습니다.','structure-caption'));
  return detail;
 }
 function card(title,v,temp,reference=null,record=null,key=null){
  const box=el('article',undefined,'result-card');
  const compact=mode==='basic';
  box.append(el('h3',title),el('p',compact&&key?hairpinSummary(record,key):STATUS[v.status],'analysis-state'));
  function metrics(values,mainKeys){
   if(!mainKeys){box.append(metricList(values));return;}
   box.append(metricList(values.filter(([, , ,k])=>mainKeys.includes(k))));
   const extra=values.filter(([, , ,k])=>!mainKeys.includes(k));
   if(extra.length){const detail=el('details');detail.dataset.detail=title+':metrics';detail.append(el('summary','세부 열역학 값'),metricList(extra));box.append(detail);}
  }
  if(hasTm(v)){
   const values=v.status==='tm-only'?[['Tm · Mg',v.tm,'°C','tm'],['Tm−온도',v.tm-temp,'°C','margin']]:[['ΔG°',v.dg,'kcal/mol','dg'],['Tm',v.tm,'°C','tm'],['ΔH°',v.dh,'kcal/mol','dh'],['ΔS°',v.ds,'cal/(mol·K)','ds'],['Tm−온도',v.tm-temp,'°C','margin']];
   metrics(values,compact?(key?['dg']:['tm','margin','dg']):mode==='terminal'?['dg']:null);
  }
  if(reference){
   const block=el('div',undefined,'reference-block'),r=reference.result;
   block.setAttribute('role','group');block.setAttribute('aria-label','Mg=0 참고값 · 입력 Mg 효과 제외');
   block.append(el('h4','참고 · Mg=0'),el('p',`입력 Mg ${(record||current).request.conditions.mg} mM 효과 제외`,'reference-context'),el('p',`${temp}°C · 나머지 조건 동일`,'reference-context'));
   if(r.status==='ok'){
    block.append(metricList([['ΔG°',r.dg,'kcal/mol','dg']]));
    const detail=el('details');detail.dataset.detail=title+':reference';detail.append(el('summary','참고 Tm·ΔH·ΔS'),metricList([['ΔH°',r.dh,'kcal/mol','dh'],['ΔS°',r.ds,'cal/(mol·K)','ds'],['Tm · Mg=0',r.tm,'°C','tm']]));block.append(detail);
   }
   else block.append(el('p',r.reason||STATUS[r.status],'hint'));
   block.append(el('p','dNTP 독립 효과 미반영','reference-context'));box.append(block);
  }
  if(v.reason&&(!reference||v.status!=='tm-only'))box.append(el('p',v.reason,'hint'));
  if(v.status==='no-structure')box.append(el('p','이 설정에서 구조를 반환하지 않았습니다. 모든 접힘이 없다는 뜻은 아닙니다.','hint'));
  if(v.status==='unsupported'||v.status==='error')box.dataset.unavailable='true';
  if(v.structure&&record&&key)box.append(structureView(record,key));
  return box;
 }
 function renderCurrent(force=false){
  const area=$('current-result');
  const retained=rendered&&renderedMode===mode&&!current&&['stale','queued','running'].includes(state);
  area.dataset.freshness=retained?'stale':current?'fresh':'empty';
  if(retained){
   for(const control of area.querySelectorAll('button,input,select'))control.disabled=true;
   buttons();return;
  }
  if(current&&rendered===current&&renderedMode===mode&&!force){buttons();return;}
  rendered=current;renderedMode=mode;if(!['queued','running'].includes(state))waitingSince=null;
  for(const d of area.querySelectorAll('details')){if(d.open)expanded.add(d.dataset.detail);else expanded.delete(d.dataset.detail);}area.replaceChildren();
  if(current&&mode==='beacon'){area.append(renderBeacon(current,{onMetric:openMetric,onCopy:beaconCopy,onIssue:recoverBeacon}));}
  else if(current&&mode==='pair'){area.append(renderWorkbench(current,{onMetric:openMetric,onCopy:pairCopy,selected:pairStructure,onSelect:id=>pairStructure=id}));}
  else if(current&&mode!=='basic'){area.append(renderSuite(current,{selectedPoint,onSelect:index=>{selectedPoint=index;selectedPoints.set(mode,index);renderCurrent(true);document.querySelector(`input[name=scan-point][value="${index}"]`)?.focus();},duplexCard:(title,r)=>card(title,r.duplex,r.request.conditions.temperature,r.duplexMgZeroReference,r),hairpinCard:(title,r,key)=>card(title,r[key],r.request.conditions.temperature,null,r,key)}));}
  else if(current){const r=current.request;area.append(el('p',`${r.parent.name} · ${r.selection.start}–${r.selection.end} (${r.selection.length} nt) · ${r.role||'역할 미지정'} · ${new Date(current.calculatedAt).toLocaleTimeString('ko-KR')} 계산`,'result-origin'),el('p',conditionText(r.conditions),'hint'));
   const gc=100*[...r.strandA].filter(b=>b==='G'||b==='C').length/r.strandA.length;
   area.append(el('p',r.strandA.length+' nt · GC '+display(gc)+'%','selection-metrics'));
   const cards=el('div',undefined,'result-grid basic-result-grid');
   cards.append(card('Duplex · 완전 상보',current.duplex,r.conditions.temperature,current.duplexMgZeroReference),card('A hairpin · Primer3',current.hairpinA,r.conditions.temperature,null,current,'hairpinA'));area.append(cards);
   const complement=el('details');complement.dataset.detail='basic:complement';
   complement.append(el('summary','가상 완전 상보 B · hairpin'),card('B hairpin · Primer3',current.hairpinB,r.conditions.temperature,null,current,'hairpinB'));area.append(complement);
   const details=el('details'),summary=el('summary','이번 계산의 적용값·모델·한계');details.dataset.detail='applied';details.append(summary,el('p',`Duplex: ${current.duplex.model||r.contract.duplex}`),el('p',`Hairpin: ${r.contract.hairpin}`),el('p','실제 적용값: '+JSON.stringify(current.applied),'hash-text'));
   if(current.duplexMgZeroReference)details.append(el('p','Mg=0 참고 계산 조건: '+JSON.stringify(current.duplexMgZeroReference.conditions),'hash-text'),el('p',current.duplexMgZeroReference.note,'hint'));
   const list=el('ul');for(const n of current.limitations)list.append(el('li',n));details.append(list,el('p',`엔진 ${r.contract.engineVersion} · 도구 ${UI_VERSION}`),el('p','manifest SHA-256: '+r.contract.manifest,'hash-text'),el('p','WASM SHA-256: '+r.contract.wasm,'hash-text'),el('p','duplex SHA-256: '+r.contract.duplexSHA,'hash-text'),el('p','sequence SHA-256: '+r.contract.sequenceSHA,'hash-text'));area.append(details);
  }else area.append(el('p','현재 구간의 계산 결과가 여기에 표시됩니다.','result-placeholder'));
  for(const d of area.querySelectorAll('details'))if(expanded.has(d.dataset.detail))d.open=true;
  buttons();
 }
 function hairpinSummary(record,key){
  const v=record[key];
  if(v.status!=='ok')return STATUS[v.status];
  if(!v.structure)return '검출 · 구조 확인 불가';
  const seq=key==='hairpinA'?record.request.strandA:record.request.strandB;
  const structure=parseHairpin(v.structure,seq,record.request.contract.hairpin??record.request.contract.model);
  if(structure.status!=='ok')return '검출 · 구조 변환 불가';
  return structure.pairs.some(p=>p.right===seq.length)?'검출 · 3′ 끝 참여':'검출 · 3′ 끝 미참여';
 }
 function pinName(p){
  if(isRelationshipRecord(p))return p.row.name;
  return p.request.role||p.request.parent.name;
 }
 function pinConditions(p){
  const r=p.request,c=isRelationshipRecord(p)?p.row.conditions:r.conditions;
  return JSON.stringify([p.schemaVersion,r.contract,p.duplex?.model,p.duplex?.self,c,
   r.options?.engineReferenceNm,p.row?.api.value,p.row?.refRaw,r.design?.api]);
 }
 function renderPinDetail(td,p,base){
  const r=p.request,d=compare(p,base);
  td.append(el('p','계산 시각: '+p.calculatedAt,'hint'),el('p',conditionText(r.conditions),'hint'),el('p',d.notes.join(' '),'hint'));
  if(isRelationshipRecord(p))td.append(renderRelationship(p,{onMetric:openMetric,onCopy:relationshipCopy}));
  else if(isBeacon(p))td.append(renderBeacon(p,{onMetric:openMetric,onCopy:beaconCopy,base}));
  else{
   if(p.duplexMgZeroReference?.result.status==='ok')td.append(el('p','Mg=0 참고 · ΔG° '+display(p.duplexMgZeroReference.result.dg)+' kcal/mol','reference-summary'));
   if(isPair(p))td.append(renderWorkbench(p,{onMetric:openMetric,onCopy:pairCopy}));
   else for(const key of ['hairpinA','hairpinB'])if(p[key].structure)td.append(structureView(p,key));
   const report=el('details');report.append(el('summary','텍스트 결과 전체'));report.addEventListener('toggle',()=>{if(report.open&&report.childElementCount===1)report.append(el('pre',recordsText([p],{base})));});td.append(report);
  }
  td.append(button(p.id+' 복사',()=>copy([p])));
 }
 function renderPins(){
  const body=$('pins-body'),base=pins.find(p=>p.id===baseId)||null,sort=$('pin-sort').value;
  const filter=$('pin-match');filter.disabled=!base;
  const group=base&&filter.checked?pinConditions(base):null;
  const list=pins.filter(p=>group===null||pinConditions(p)===group);
  if(sort==='name')list.sort((a,b)=>pinName(a).localeCompare(pinName(b),'ko'));
  if(sort==='tm')list.sort((a,b)=>(b.duplex?.tm??-Infinity)-(a.duplex?.tm??-Infinity));
  if(sort==='dg')list.sort((a,b)=>(a.duplex?.dg??Infinity)-(b.duplex?.dg??Infinity));
  const fragment=document.createDocumentFragment();
  for(const p of list){
   const r=p.request,row=el('tr'),pick=el('input'),cell=el('td');
   pick.type='radio';pick.name='comparison-base';pick.checked=baseId===p.id;pick.setAttribute('aria-label',p.id+' 비교 기준 선택');
   pick.addEventListener('change',()=>{baseId=p.id;renderPins();body.querySelector('input:checked')?.focus({preventScroll:true});});
   cell.append(pick);row.append(cell);
   const rel=isRelationshipRecord(p),beacon=isBeacon(p),special=rel||beacon;
   const kind=rel?(isFixedRecord(p)?'고정 정렬':'관계'):beacon?'Beacon':isPair(p)?'두 가닥':'';
   const d=compare(p,base),tm=!special&&hasTm(p.duplex),ok=!special&&p.duplex.status==='ok';
   const coordinates=rel?p.row.a.selection:r.selection;
   const reference=p.duplexMgZeroReference?.result;
   const energy=ok?display(p.duplex.dg):reference?.status==='ok'?display(reference.dg)+' · Mg=0 참고':special?'상세 참조':'—';
   for(const value of [p.id+' · '+(kind?'['+kind+'] ':'')+pinName(p),
    coordinates?coordinates.start+'–'+coordinates.end+' / '+coordinates.length:'—',
    r.conditions.temperature+'°C',energy,tm?display(p.duplex.tm):'—',
    tm?display(p.duplex.tm-r.conditions.temperature):'—',d.dg===null?'—':display(d.dg),
    d.tm===null?'—':display(d.tm),special?'상세 참조':hairpinSummary(p,'hairpinA')+' / '+hairpinSummary(p,'hairpinB')])row.append(el('td',value));
   const actions=el('td'),toggle=button('상세',()=>{
    if(openPins.has(p.id)){openPins.delete(p.id);body.querySelector('[data-pin-detail="'+p.id+'"]')?.remove();}
    else{openPins.add(p.id);insertDetail();}
    toggle.setAttribute('aria-expanded',String(openPins.has(p.id)));
   });
   toggle.setAttribute('aria-label',p.id+' 상세');toggle.setAttribute('aria-expanded',String(openPins.has(p.id)));
   const insertDetail=()=>{
    const more=el('tr'),td=el('td');more.dataset.pinDetail=p.id;td.colSpan=11;
    renderPinDetail(td,p,base);more.append(td);row.after(more);
   };
   actions.append(toggle,button(p.id+' 삭제',()=>{
    pins=pins.filter(x=>x.id!==p.id);openPins.delete(p.id);
    if(baseId===p.id)baseId=null;
    renderPins();(body.querySelector('button')||$('comparison-panel').querySelector('summary')).focus({preventScroll:true});
   }));row.append(actions);fragment.append(row);if(openPins.has(p.id))insertDetail();
  }
  body.replaceChildren(fragment);
  $('pins-empty').hidden=pins.length>0;$('pins-table').hidden=pins.length===0;$('comparison-tools').hidden=pins.length===0;
  $('pin-count').textContent=pins.length+'개';
  $('comparison-summary').textContent=pins.length+'개 보관 · '+(base?'비교 기준 '+base.id:'기준 미선택');
  $('pin-filter-status').textContent=group===null?'':list.length+' / '+pins.length+'개 표시';
  buttons();
 }
 function schedule(){
  if(mode==='relationship')return;
  if(mode!=='temperature'&&$('auto-calculate').checked&&!blocked.has(mode)&&!ready()){waitingSince??=performance.now();state='queued';message='자동 계산 대기 · 마지막 입력 후160 ms';debounce=setTimeout(()=>{debounce=null;calculate();},AUTO_DELAY);}
  else if(mode==='temperature'&&!ready())message='온도 격자를 확인한 뒤 온도 비교 실행을 누르세요.';
 }
 function updated(value){
  const input=readInput();
  if(mode==='pair'||mode==='beacon'){
   const original=value.request;
   const name=mode==='beacon'?(input.parentName||input.parsed.name||'이름 없음').trim():(input.parentName.trim()||input.parsed.name||'이름 없음');
   if(original.parent.name===name&&original.role===input.role.trim()&&original.memo===input.memo.trim()&&(mode!=='pair'||original.partner.name===pairSettings().partnerName.trim()))
    return value.parentRaw===input.raw?value:{...value,parentRaw:input.raw};
   // Keep the computed values and rebuild only their input/provenance snapshots.
   const rebind=(entries,requests)=>entries.map((entry,index)=>entry.calculation?{...entry,calculation:{...entry.calculation,request:requests[index]}}:entry);
   if(mode==='pair'){
    const request=makeWorkbenchRequest(input,pairSettings(),original.requestId,original.revision);
    const plans=workbenchPlans(request);
    return {...value,request,parentRaw:input.raw,entries:rebind(value.entries,plans.actual),referenceEntries:rebind(value.referenceEntries,plans.reference)};
   }
   const request=makeBeaconRequest(input,beaconInput.read(),original.requestId,original.revision);
   return {...value,request,parentRaw:input.raw,entries:rebind(value.entries,beaconPlans(request).map(plan=>plan.request))};
  }
  if(mode==='basic')return {...value,request:metadata(value.request,input),parentRaw:input.raw};
  const updatedSuite=suiteMetadata(value,input);
  return {...updatedSuite,parentRaw:input.raw,points:updatedSuite.points.map(point=>({...point,entries:point.entries.map(entry=>({...entry,record:{...entry.record,parentRaw:input.raw}}))}))};
 }
 function syncInput(){
  relationshipUI?.syncShared();beaconInput.render();const input=readInput(),next=inputKey(input),nextSettings=settingKeys(),globalChange=next!==key;
  const affected=globalChange?MODES:['terminal','temperature','pair','beacon'].filter(m=>nextSettings[m]!==settingsKeys[m]);
  key=next;settingsKeys=nextSettings;
  for(const m of affected){cache.delete(m);blocked.delete(m);}
  if(affected.includes(mode)){
   $('result-copy-status').textContent='';const had=current||pending||['queued','stale'].includes(state);revision++;stop();waitingSince=performance.now();current=null;state=had?'stale':'idle';message=had?'입력 변경으로 이전 결과가 만료되었습니다.':'';schedule();renderCurrent();return;
  }
  if(current){const value=updated(current);if(JSON.stringify(value)!==JSON.stringify(current)){current=freeze(value);cache.set(mode,current);$('result-copy-status').textContent='';renderCurrent();return;}}
  buttons();
 }
 function selectPanel(){
  if(!['basic','pair'].includes(mode))$('advanced-modes').open=true;
  for(const m of MODES){const active=m===mode;$('tab-'+m).setAttribute('aria-selected',String(active));$('tab-'+m).tabIndex=active?0:-1;$('panel-'+m).hidden=!active;}
  if(mode==='relationship'){$('input-panel').open=false;relationshipUI?.activate();}else{relationshipUI?.deactivate();$('panel-'+mode).append($('analysis-workspace'));}$('terminal-settings').hidden=!['terminal','temperature'].includes(mode);$('grid-settings').hidden=mode!=='temperature';$('pair-settings').hidden=mode!=='pair';$('beacon-settings').hidden=mode!=='beacon';$('analysis-workspace').classList.toggle('is-beacon',mode==='beacon');$('selection-heading').textContent=mode==='beacon'?'2. 인식 영역 R 선택':'2. 독립 oligo 선택';document.querySelector('.analysis-intro').textContent=mode==='beacon'?'R·추가 stem·Target의 분자 역할을 구분해 계산합니다. 각 수치의 ?에서 의미와 한계를 확인하세요.':'선택 영역 자체를 독립 oligo로 계산합니다. 각 수치의 ?를 누르면 의미와 해석을 볼 수 있습니다.';beaconInput.render();
  refreshSelection();
 }
 function changeMode(next){
  if(next===mode)return;
  if(['queued','running'].includes(state))blocked.add(mode);
  stop();rendered=null;waitingSince=null;$('result-copy-status').textContent='';mode=next;current=cache.get(mode)||null;if(current){current=freeze(updated(current));cache.set(mode,current);}
  selectedPoint=selectedPoints.get(mode)||0;state=current?resultState(current,mode):blocked.has(mode)?'cancelled':'idle';message=current?'유효한 현재 결과를 다시 표시합니다.':blocked.has(mode)?'이 작업이 중단되었습니다. 지금 계산/온도 비교 실행으로 다시 시작하세요.':'';
  selectPanel();if(!current)schedule();renderCurrent();
 }
 async function calculate(){
  if(mode==='relationship')return;
  const reason=ready();if(reason||state==='running'){buttons();return;}
  const input=readInput(),beaconSettings=beaconInput.read(),runMode=mode,request=mode==='beacon'?makeBeaconRequest(input,beaconSettings,++requestId,revision):mode==='pair'?makeWorkbenchRequest(input,pairSettings(),++requestId,revision):mode==='basic'?makeRequest(input,++requestId,revision):makeSuiteRequest(input,mode,settings(),++requestId,revision);
  stop();waitingSince??=performance.now();blocked.delete(mode);cache.delete(mode);current=null;state='running';message='계산 중 · 시작 당시의 서열/조건으로 분석합니다.';pending=request;renderCurrent();
  let mine;
  try{mine=new Worker(new URL(runMode==='beacon'?'./beacon-worker.mjs':runMode==='basic'?'./worker.mjs':runMode==='pair'?'./pair-workbench-worker.mjs':'./suite-worker.mjs',import.meta.url),{type:'module'});worker=mine;}
  catch{stop();blocked.add(mode);state='error';message='이 환경에서 계산 Worker를 시작할 수 없습니다.';renderCurrent();return;}
  const fail=text=>{if(worker!==mine)return;stop();current=null;cache.delete(runMode);blocked.add(runMode);state='error';message=text;renderCurrent();};
  timer=setTimeout(()=>fail('계산 시간이 초과되어 중단했습니다. 입력/범위를 확인하고 다시 실행하세요.'),runMode==='temperature'?30000:12000);
  mine.onerror=e=>{e.preventDefault();fail('계산 Worker를 실행하지 못했습니다. 다시 계산해 주세요.');};mine.onmessageerror=()=>fail('계산 응답을 읽지 못했습니다.');let progress=0;
  mine.onmessage=({data})=>{
   if(worker!==mine||!pending||pending.requestId!==data.requestId||pending.revision!==data.revision||revision!==request.revision||mode!==runMode)return;
   if(data.type==='error'){fail(data.message||'계산 엔진 오류');return;}
   if(data.type==='progress'){
    if(runMode==='basic'||data.total!==(runMode==='beacon'?beaconCount(request):runMode==='pair'?workbenchCount(request):request.temperatures.length)||!Number.isInteger(data.completed)||data.completed<=progress||data.completed>data.total){fail('진행 응답이 요청과 일치하지 않습니다.');return;}
    progress=data.completed;message=`${runMode==='beacon'?'Beacon 분석':runMode==='pair'?'두 가닥 분석':'온도/조건 계산'} 중 · ${progress}/${data.total}${runMode==='pair'?'항목':'점'} 완료`;buttons();return;
   }
   if(data.type!=='result'){fail('알 수 없는 계산 응답입니다.');return;}
   try{
    const result=runMode==='beacon'?validateBeaconResult(data.result,request):runMode==='pair'?validateWorkbenchResult(data.result,request):runMode==='basic'?validateResult(data.result,request):validateSuiteResult(data.result,request),at=new Date().toISOString();stop();
    if(runMode==='beacon')current=freeze(decorateBeacon(result,{parentRaw:input.raw,targetRaw:beaconSettings.target.raw,calculatedAt:at}));
    else if(runMode==='pair')current=freeze(updated(decorateWorkbench(result,{parentRaw:readInput().raw,calculatedAt:at})));
    else if(runMode==='basic')current=freeze({...result,request:metadata(result.request,readInput()),parentRaw:readInput().raw,calculatedAt:at});
    else{const decorated=suiteMetadata(result,readInput());current=freeze({...decorated,parentRaw:readInput().raw,calculatedAt:at,points:decorated.points.map(p=>({...p,entries:p.entries.map(e=>({...e,record:{...e.record,calculatedAt:at,parentRaw:readInput().raw}}))}))});selectedPoint=Math.max(0,current.points.findIndex(p=>p.temperature===current.request.source.conditions.temperature));}
    selectedPoints.set(mode,selectedPoint);cache.set(mode,current);state=resultState(current,runMode);
    message=(runMode==='temperature'?`온도 비교 ${current.points.length}점 완료 · `:'')+(state==='partial'?'부분 계산 완료 · 항목별 상태 확인':'계산 완료');renderCurrent();
   }catch(e){fail(e.message);}
  };
  mine.postMessage(request);
 }
 function options(){return {base:pins.find(p=>p.id===baseId)||null,includeParent:$('include-parent').checked};}
 async function copy(records){if(!records.length)return;$('result-copy-status').textContent='';const opts=options(),text=recordsText(records,opts);try{const format=await writeClipboard(text,recordsHTML(records,opts));$('result-copy-status').textContent=`${records.length===1?records[0].id||'현재':'결과 전체'} 결과를 ${format==='formatted'?'서식 포함':'일반 텍스트로'} 복사했습니다.`;}catch{$('result-copy-status').textContent='복사하지 못했습니다. 결과 TXT를 저장해 주세요.';}}
 async function copyStructure(record,key,rawOnly=false){$('result-copy-status').textContent='';const text=rawOnly?record[key].structure:structureReport(record,key,{includeRaw:false});try{const format=await writeClipboard(text,textHTML(text));$('result-copy-status').textContent=`${record.id||'현재'} ${key==='hairpinA'?'A':'B'} ${rawOnly?'THAL 원문':'구조'}를 ${format==='formatted'?'서식 포함':'일반 텍스트로'} 복사했습니다.`;}catch{$('result-copy-status').textContent='구조를 복사하지 못했습니다. 결과 TXT에서 확인하세요.';}}
 function download(records,type){if(!records.length)return;const csv=type==='csv',blob=new Blob([csv?recordsCSV(records,options()):recordsText(records,options())],{type:csv?'text/csv;charset=utf-8':'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`oligo-${records.length===1?'result':'comparison'}.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('result-copy-status').textContent=`${csv?'CSV':'TXT'}를 저장했습니다.`;}
 for(const m of MODES){
  $('tab-'+m).addEventListener('click',()=>changeMode(m));
  $('tab-'+m).addEventListener('keydown',e=>{const modes=MODES,i=modes.indexOf(m);let next;if(e.key==='ArrowRight')next=modes[(i+1)%modes.length];if(e.key==='ArrowLeft')next=modes[(i+modes.length-1)%modes.length];if(e.key==='Home')next='basic';if(e.key==='End')next=modes.at(-1);if(next){e.preventDefault();changeMode(next);$('tab-'+next).focus();}});
 }
 for(const id of ['window-size','scan-start','scan-end','scan-step','scan-hairpin'])$(id).addEventListener('input',()=>{syncInput();refreshSelection();});
 for(const id of ['partner-mode','partner-raw','partner-name','pair-api','pair-ends','pair-pcr'])$(id).addEventListener('input',()=>{syncInput();refreshSelection();});
 $('partner-from-complement').addEventListener('click',()=>{try{const q=makeRequest(readInput(),1,revision);$('partner-raw').value=q.strandB;$('partner-mode').value='manual';syncInput();refreshSelection();$('partner-raw').focus();}catch(e){$('result-copy-status').textContent=e.message;}});
 $('calculate').addEventListener('click',calculate);
 $('auto-calculate').addEventListener('change',()=>{if(mode==='temperature'){buttons();return;}if($('auto-calculate').checked){blocked.delete(mode);if(!current){stop();schedule();}}else{const hadWork=pending||debounce!==null;stop();if(hadWork){blocked.add(mode);current=null;state='cancelled';message='자동 계산을 껐습니다. 직접 실행할 수 있습니다.';}}renderCurrent();});
 $('cancel-calculation').addEventListener('click',()=>{stop();blocked.add(mode);current=null;cache.delete(mode);state='cancelled';message='계산을 취소했습니다. 이전 결과를 현행값으로 복원하지 않습니다.';renderCurrent();});
 function pinRecord(value){
  if(!value)return false;
  const saved=freeze({...value,id:'보관 '+nextPin++});
  pins.push(saved);renderPins();$('comparison-panel').open=true;
  $('result-copy-status').textContent=saved.id+' · '+saved.request.conditions.temperature+'°C 결과를 비교표에 추가했습니다.';
  return true;
 }
 $('pin-result').addEventListener('click',()=>pinRecord(currentRecord()));
 for(const id of ['pin-sort','pin-match'])$(id).addEventListener('change',renderPins);
 $('clear-pins').addEventListener('click',()=>{pins=[];baseId=null;openPins.clear();renderPins();$('result-copy-status').textContent='보관 결과를 비웠습니다.';});
 $('copy-result').addEventListener('click',()=>copy(exportRecords()));$('copy-pins').addEventListener('click',()=>copy(pins));
 for(const [id,which,type] of [['save-result','current','txt'],['csv-result','current','csv'],['save-pins','pins','txt'],['csv-pins','pins','csv']])$(id).addEventListener('click',()=>download(which==='current'?exportRecords():pins,type));
 for(const id of ['role','memo'])$(id).addEventListener('input',syncInput);
 $('review-input').addEventListener('click',()=>{
  const issue=recoveryIssue(readInput());
  if(!issue.field){recoverBeacon(ready());return;}
  if(issue.panel)$(issue.panel).open=true;
  if(issue.panel==='conditions-panel'&&issue.field!=='temperature')$('ion-panel').open=true;
  $(issue.field).focus();
 });
 let metricTrigger=null;
 function openMetric(id){const source=$('guide-'+id);if(!source)return;metricTrigger=document.activeElement;$('metric-title').textContent=source.querySelector('h3').textContent;$('metric-body').replaceChildren(...[...source.children].filter(n=>n.tagName!=='H3').map(n=>n.cloneNode(true)));if(mode==='relationship')$('metric-body').prepend(el('p','현재 관계·mismatch 탭: THAL은 실제 입력 이온/온도의 반환 구조입니다. 고정 NN3/IMM는 Na-only/Mg0 참고이며 실제 B와 가상PM을 구분합니다. C_ref는 각 가닥의 동량 참고농도이며 실제 A/B·THAL API와 별도입니다. MM−PM만 같은 모델에서 차감합니다. 아래 기존 NN4 설명과 구분하세요.','pair-basis'));if(mode==='beacon')$('metric-body').prepend(el('p','현재 Beacon 탭은 입력 온도·이온의 고정 Primer3 THAL 모델입니다.4반응을 직접 빼지 않습니다. 지정 closed 참고는 반환 pair가 기대 stem과 정확히 같을 때만 연결하며 닫힘 분율·개방 비용·속도가 아닙니다. Dimer Tm은 실제 A/B와 별도인 명시적API 기준입니다. 아래 NN4/Mg0 설명과 구분하세요.','pair-basis'));if(mode==='pair')$('metric-body').prepend(el('p','현재 두 가닥 탭: 입력 온도/Mg를 반영한 THAL 근사 모델값입니다. Dimer Tm은 명시적 API 농도 기준이며 실제 A/B 혼합물 해석은 미확립입니다. 아래 NN4/Mg0 참고 설명과 구분하세요. PCR 상세의 값은 별도37°C/1M/API250nM 기준입니다.','pair-basis'));$('metric-dialog').showModal();}
 $('close-metric').addEventListener('click',()=>$('metric-dialog').close());
 $('metric-dialog').addEventListener('close',()=>{if(metricTrigger?.isConnected)metricTrigger.focus();else if(!$('end-handle').disabled)$('end-handle').focus();else $('auto-calculate').focus();});
 $('focus-view').addEventListener('click',()=>{if(mode==='relationship'){$('input-panel').open=false;$('conditions-panel').open=false;relationshipUI.focus();return;}for(const id of ['input-panel','conditions-panel','strand-panel','export-panel','export-options','beacon-options','beacon-input-help','beacon-stem-input','beacon-target-input','beacon-assembly'])$(id).open=false;$('analysis-workspace').classList.add('is-focused');if(mode==='beacon'){expanded.clear();for(const d of $('current-result').querySelectorAll('details'))d.open=false;}$('analysis-workspace').scrollIntoView({block:'start'});$('start-handle').focus({preventScroll:true});});
 addEventListener('pagehide',()=>{stop();relationshipUI?.deactivate();});
 function reset(){stop();relationshipUI?.reset();beaconInput.reset();expanded.clear();cache.clear();blocked.clear();selectedPoints.clear();current=null;pins=[];baseId=null;openPins.clear();$('pin-sort').value='added';$('pin-match').checked=false;$('advanced-modes').open=false;revision++;mode='basic';selectedPoint=0;pairStructure='AB-heterodimer';$('partner-mode').value='complement';$('partner-raw').value='';$('partner-name').value='';$('pair-api').value='200';$('pair-ends').checked=false;$('pair-pcr').checked=false;state='idle';message='';key=null;settingsKeys={};$('window-size').value='5';$('scan-start').value='50';$('scan-end').value='70';$('scan-step').value='5';$('scan-hairpin').checked=false;$('include-parent').checked=false;$('result-copy-status').textContent='';selectPanel();renderPins();renderCurrent();}
 function relationshipCopy(record,entry,rawOnly){const text=entry?relationStructureText(record,entry,rawOnly):fixedStructureText(record);writeClipboard(text,textHTML(text)).then(()=>$('result-copy-status').textContent='관계 구조를 복사했습니다.').catch(()=>$('result-copy-status').textContent='복사 실패 · TXT를 사용하세요.');}
 relationshipUI=initRelationshipUI({container:$('panel-relationship'),readInput,onPin:pinRecord,getBase:()=>pins.find(p=>p.id===baseId)||null,onMetric:openMetric});
 settingsKeys=settingKeys();selectPanel();renderPins();syncInput();return {syncInput,reset,mode:()=>mode,partner:()=>{try{return pairPartner(readInput().parsed.seq.slice(readInput().range.start-1,readInput().range.end),pairSettings());}catch{return '';}}};
}
