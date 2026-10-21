// SPDX-License-Identifier: GPL-2.0-or-later
import {makeRequest,inputKey,metadata,freeze,validateResult,compare,hasTm,UI_VERSION} from './analysis-core.mjs';
import {display,conditionText,STATUS,resultText,resultCSV} from './report.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
export function initAnalysis({readInput}){
 let revision=0,requestId=0,key=null,current=null,pending=null,worker=null,timer=null,debounce=null,state='idle',message='',pins=[],nextPin=1,baseId=null;
 const AUTO_DELAY=160;
 const expanded=new Set();
 function stop(){if(debounce!==null)clearTimeout(debounce);debounce=null;if(timer)clearTimeout(timer);timer=null;if(worker)worker.terminate();worker=null;pending=null;}
 function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
 function ready(){try{makeRequest(readInput(),1,revision);return '';}catch(e){return e.message;}}
 function buttons(){
  const reason=ready();$('calculate').disabled=Boolean(reason)||state==='running';$('cancel-calculation').disabled=!['running','queued'].includes(state);$('calculation-input-hint').textContent=reason||'';
  for(const id of ['copy-result','save-result','csv-result','pin-result'])$(id).disabled=!current;
  for(const id of ['copy-pins','save-pins','csv-pins','clear-pins'])$(id).disabled=pins.length===0;
  $('calculation-status').textContent=message||'서열과 유효한 구간을 입력하면 계산합니다.';$('calculation-status').dataset.state=state;
 }
 function metricList(values){
   const list=el('dl',undefined,'metrics');
   for(const [name,value,unit,help] of values){
    const label=el('dt',name),hint=button('?',()=>openMetric(help));hint.className='metric-help';hint.setAttribute('aria-label',`${name} 의미와 해석`);hint.setAttribute('aria-haspopup','dialog');label.append(hint);
    const available=Number.isFinite(value),valueNode=el('dd',available?display(value):'미지원',available?'':'metric-unavailable');if(available)valueNode.append(el('small',unit));list.append(label,valueNode);
   }
   return list;
 }
 function card(title,v,temp,reference=null){
  const box=el('article',undefined,'result-card');box.append(el('h3',title),el('p',STATUS[v.status],'analysis-state'));
  if(hasTm(v)){
   const values=v.status==='tm-only'?[['Tm · Mg',v.tm,'°C','tm'],['Tm−온도',v.tm-temp,'°C','margin']]:[['ΔG°',v.dg,'kcal/mol','dg'],['Tm',v.tm,'°C','tm'],['ΔH°',v.dh,'kcal/mol','dh'],['ΔS°',v.ds,'cal/(mol·K)','ds'],['Tm−온도',v.tm-temp,'°C','margin']];
   box.append(metricList(values));
  }
  if(reference){
   const block=el('div',undefined,'reference-block'),r=reference.result;
   block.setAttribute('role','group');block.setAttribute('aria-label','Mg=0 참고값 · 입력 Mg 효과 제외');
   block.append(el('h4','참고 · Mg=0'),el('p',`입력 Mg ${current.request.conditions.mg} mM 효과 제외`,'reference-context'),el('p',`${temp}°C · 나머지 조건 동일`,'reference-context'));
   if(r.status==='ok')block.append(metricList([['ΔG°',r.dg,'kcal/mol','dg'],['ΔH°',r.dh,'kcal/mol','dh'],['ΔS°',r.ds,'cal/(mol·K)','ds'],['Tm · Mg=0',r.tm,'°C','tm']]));
   else block.append(el('p',r.reason||STATUS[r.status],'hint'));
   block.append(el('p','dNTP 독립 효과 미반영','reference-context'));box.append(block);
  }
  if(v.reason&&(!reference||v.status!=='tm-only'))box.append(el('p',v.reason,'hint'));
  if(v.structure){const d=el('details'),s=el('summary','THAL 구조 텍스트');d.dataset.detail=title;d.append(s,el('pre',v.structure.trimEnd()));box.append(d);}
  return box;
 }
 function renderCurrent(){
  const area=$('current-result');for(const d of area.querySelectorAll('details')){if(d.open)expanded.add(d.dataset.detail);else expanded.delete(d.dataset.detail);}area.replaceChildren();
  if(current){const r=current.request;area.append(el('p',`${r.parent.name} · ${r.selection.start}–${r.selection.end} (${r.selection.length} nt) · ${r.role||'역할 미지정'}`,'result-origin'),el('p',conditionText(r.conditions),'hint'));
   const cards=el('div',undefined,'result-grid');cards.append(card('Duplex · 완전 상보',current.duplex,r.conditions.temperature,current.duplexMgZeroReference),card('A hairpin · Primer3',current.hairpinA,r.conditions.temperature),card('B hairpin · Primer3',current.hairpinB,r.conditions.temperature));area.append(cards);
   const details=el('details'),summary=el('summary','이번 계산의 적용값·모델·한계');details.dataset.detail='applied';details.append(summary,el('p',`Duplex: ${current.duplex.model||r.contract.duplex}`),el('p',`Hairpin: ${r.contract.hairpin}`),el('p','실제 적용값: '+JSON.stringify(current.applied),'hash-text'));
   if(current.duplexMgZeroReference)details.append(el('p','Mg=0 참고 계산 조건: '+JSON.stringify(current.duplexMgZeroReference.conditions),'hash-text'),el('p',current.duplexMgZeroReference.note,'hint'));
   const list=el('ul');for(const n of current.limitations)list.append(el('li',n));details.append(list,el('p',`엔진 ${r.contract.engineVersion} · 도구 ${UI_VERSION}`),el('p','manifest SHA-256: '+r.contract.manifest,'hash-text'),el('p','WASM SHA-256: '+r.contract.wasm,'hash-text'),el('p','duplex SHA-256: '+r.contract.duplexSHA,'hash-text'),el('p','sequence SHA-256: '+r.contract.sequenceSHA,'hash-text'));area.append(details);
  }else area.append(el('p',state==='queued'?'입력을 기다리는 중…':state==='running'?'최신 구간을 계산하는 중…':'현재 구간의 계산 결과가 여기에 표시됩니다.','result-placeholder'+(['queued','running'].includes(state)?' is-updating':'')));
  for(const d of area.querySelectorAll('details'))if(expanded.has(d.dataset.detail))d.open=true;
  buttons();
 }
 function renderPins(){
  const body=$('pins-body');body.replaceChildren();const base=pins.find(p=>p.id===baseId)||null;
  for(const p of pins){const r=p.request,row=el('tr'),pick=el('input');pick.type='radio';pick.name='comparison-base';pick.checked=baseId===p.id;pick.setAttribute('aria-label',`${p.id} 비교 기준 선택`);pick.addEventListener('change',()=>{baseId=p.id;renderPins();$('pins-body').querySelector('input:checked')?.focus();});const cell=el('td');cell.append(pick);row.append(cell);
   const d=compare(p,base),ok=p.duplex.status==='ok',tm=hasTm(p.duplex);
   for(const text of [`${p.id} · ${r.role||r.parent.name}`,`${r.selection.start}–${r.selection.end} / ${r.selection.length}`,`${r.conditions.temperature}°C`,ok?display(p.duplex.dg):p.duplex.status==='tm-only'?'미지원':STATUS[p.duplex.status],tm?display(p.duplex.tm):'—',tm?display(p.duplex.tm-r.conditions.temperature):'—',d.dg===null?'—':display(d.dg),d.tm===null?'—':display(d.tm),`${STATUS[p.hairpinA.status]} / ${STATUS[p.hairpinB.status]}`])row.append(el('td',text));
   body.append(row);const more=el('tr'),td=el('td');td.colSpan=10;const detail=el('details');detail.append(el('summary',`${p.id} 서열·조건·상세 결과`),el('p',conditionText(r.conditions),'hint'),el('p',d.notes.join(' '),'hint'),el('pre',resultText([p],{base})),button(`${p.id} 복사`,()=>copy([p])),button(`${p.id} 삭제`,()=>{pins=pins.filter(x=>x.id!==p.id);if(baseId===p.id)baseId=null;renderPins();}));
   const reference=p.duplexMgZeroReference;if(reference?.result.status==='ok'){const v=reference.result;td.append(el('p',`Mg=0 참고 · ΔG° ${display(v.dg)} kcal/mol · ΔH° ${display(v.dh)} kcal/mol · ΔS° ${display(v.ds)} cal/(mol·K) · Tm ${display(v.tm)}°C · 입력 Mg ${r.conditions.mg}mM 효과 제외`,'reference-summary'));}td.append(detail);more.append(td);body.append(more);
  }
  $('pins-empty').hidden=pins.length>0;$('pins-table').hidden=pins.length===0;$('pin-count').textContent=`${pins.length}/3`;
  const replacement=$('replace-pin'),selected=replacement.value;replacement.replaceChildren(new Option('교체할 보관 결과 선택',''));
  for(const p of pins)replacement.append(new Option(`${p.id} · ${p.request.role||p.request.parent.name}`,p.id));replacement.value=pins.some(x=>x.id===selected)?selected:'';
  $('replace-pin-label').hidden=pins.length<3;$('pin-result').textContent=pins.length<3?'현재 결과 보관':'선택 항목에 현재 결과 교체';buttons();
 }
 function syncInput(){
  const input=readInput(),next=inputKey(input),changed=next!==key;
  if(changed){const had=current||pending||['stale','queued'].includes(state);if(key!==null)revision++;stop();current=null;state=had?'stale':'idle';message=had?'입력 변경으로 이전 결과가 만료되었습니다.':'';
   if($('auto-calculate').checked&&!ready()){state='queued';message='자동 계산 대기 · 마지막 입력 후 160 ms';debounce=setTimeout(()=>{debounce=null;calculate();},AUTO_DELAY);}
  }
  key=next;if(current){const request=metadata(current.request,input);if(!changed&&JSON.stringify(request)===JSON.stringify(current.request)){buttons();return;}current=freeze({...current,request});}else if(!changed){buttons();return;}renderCurrent();
 }
 async function calculate(){
  const reason=ready();if(reason||state==='running'){buttons();return;}
  const input=readInput(),request=makeRequest(input,++requestId,revision);stop();current=null;state='running';message='계산 중 · 선택 당시 조건으로 분석합니다.';pending=request;renderCurrent();
  let mine;
  try{mine=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});worker=mine;}
  catch{stop();state='error';message='이 환경에서 계산 Worker를 시작할 수 없습니다.';renderCurrent();return;}
  const fail=text=>{if(worker!==mine)return;stop();current=null;state='error';message=text;renderCurrent();};
  timer=setTimeout(()=>fail('계산 시간이 초과되어 중단했습니다. 입력을 확인하고 다시 계산하세요.'),12000);
  mine.onerror=e=>{e.preventDefault();fail('계산 Worker를 실행하지 못했습니다. 다시 계산해 주세요.');};mine.onmessageerror=()=>fail('계산 응답을 읽지 못했습니다.');
  mine.onmessage=({data})=>{
   if(worker!==mine||!pending||pending.requestId!==data.requestId||pending.revision!==data.revision||revision!==request.revision)return;
   if(data.type==='error'){fail(data.message||'계산 엔진 오류');return;}
   try{
    const result=validateResult(data.result,request);stop();current=freeze({...result,request:metadata(result.request,readInput()),parentRaw:input.raw,calculatedAt:new Date().toISOString()});
    state=['duplex','hairpinA','hairpinB'].some(k=>['tm-only','unsupported','error'].includes(current[k].status))?'partial':'complete';message=state==='partial'?'부분 계산 완료 · 제공 항목과 미지원 사유를 확인하세요.':'모델 계산 완료 · 반응 조건과 계산 근거를 확인하세요.';renderCurrent();
   }catch(e){fail(e.message);}
  };
  mine.postMessage(request);
 }
 function options(){return {base:pins.find(p=>p.id===baseId)||null,includeParent:$('include-parent').checked};}
 async function copy(records){if(!records.length)return;const text=resultText(records,options());try{await navigator.clipboard.writeText(text);$('result-copy-status').textContent='분석 결과를 복사했습니다.';}catch{$('result-copy-status').textContent='클립보드 접근이 허용되지 않았습니다. TXT를 저장할 수 있습니다.';}}
 function download(records,type){if(!records.length)return;const csv=type==='csv',blob=new Blob([csv?resultCSV(records,options()):resultText(records,options())],{type:csv?'text/csv;charset=utf-8':'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`oligo-${records.length===1?'result':'comparison'}.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('result-copy-status').textContent=`${csv?'CSV':'TXT'}를 저장했습니다.`;}
 $('calculate').addEventListener('click',calculate);
 $('auto-calculate').addEventListener('change',()=>{
  if($('auto-calculate').checked){key=null;syncInput();}
  else{const hadWork=pending||debounce!==null;stop();if(hadWork){current=null;state='cancelled';message='자동 계산을 껐습니다. 지금 계산 버튼으로 실행하세요.';}renderCurrent();}
 });
 $('cancel-calculation').addEventListener('click',()=>{stop();current=null;state='cancelled';message='계산을 취소했습니다. 이전 결과는 현행값으로 복원하지 않습니다.';renderCurrent();});
 $('pin-result').addEventListener('click',()=>{if(!current)return;const id=$('replace-pin').value;if(pins.length===3&&!id){$('result-copy-status').textContent='교체할 보관 결과를 먼저 선택하세요.';return;}const saved=freeze({...structuredClone(current),id:`보관 ${nextPin++}`});if(pins.length<3)pins.push(saved);else{pins=pins.map(p=>p.id===id?saved:p);if(baseId===id)baseId=null;}renderPins();$('result-copy-status').textContent='계산 당시 결과를 메모리에 보관했습니다.';});
 $('clear-pins').addEventListener('click',()=>{pins=[];baseId=null;renderPins();$('result-copy-status').textContent='보관 결과를 비웠습니다.';});
 $('copy-result').addEventListener('click',()=>{if(current)copy([current]);});$('copy-pins').addEventListener('click',()=>copy(pins));
 for(const [id,which,type] of [['save-result','current','txt'],['csv-result','current','csv'],['save-pins','pins','txt'],['csv-pins','pins','csv']])$(id).addEventListener('click',()=>download(which==='current'?(current?[current]:[]):pins,type));
 for(const id of ['role','memo'])$(id).addEventListener('input',syncInput);
 let metricTrigger=null;
 function openMetric(id){const source=$('guide-'+id);if(!source)return;metricTrigger=document.activeElement;$('metric-title').textContent=source.querySelector('h3').textContent;$('metric-body').replaceChildren(...[...source.children].filter(n=>n.tagName!=='H3').map(n=>n.cloneNode(true)));$('metric-dialog').showModal();}
 $('close-metric').addEventListener('click',()=>$('metric-dialog').close());
 $('metric-dialog').addEventListener('close',()=>{if(metricTrigger?.isConnected)metricTrigger.focus();else if(!$('end-handle').disabled)$('end-handle').focus();else $('auto-calculate').focus();});
 $('focus-view').addEventListener('click',()=>{for(const id of ['input-panel','conditions-panel','strand-panel','export-panel','export-options'])$(id).open=false;$('analysis-workspace').scrollIntoView({block:'start'});$('start-handle').focus({preventScroll:true});});
 addEventListener('pagehide',stop);
 function reset(){stop();expanded.clear();current=null;pins=[];baseId=null;revision++;state='idle';message='';key=null;$('include-parent').checked=false;$('result-copy-status').textContent='';renderPins();renderCurrent();}
 renderPins();syncInput();return {syncInput,reset};
}
