import {calculate,adjusted,checkPipette,proposePreparation,remainingTE,displayFormat,MASS_CONCENTRATION_UNITS,MASS_AMOUNT_UNITS,MOLAR_UNITS,COPY_CONCENTRATION_UNITS,COPY_AMOUNT_UNITS} from './core.mjs';
import {excelClipboard,nextComponentName} from './clipboard.mjs';
import {parseOligoPaste} from './paste.mjs';
const $=id=>document.getElementById(id),f=displayFormat;
let result=null,rowCount=0,copying=false,revision=0,pasteData=null;const counters={};
function cell(tr,value,tag='td'){const e=document.createElement(tag);e.textContent=value;tr.append(e);return e;}
function unitSelect(i,field){
 const select=document.createElement('select');select.dataset.field=field;select.setAttribute('aria-label',`${i}행 ${field==='targetUnit'?'목표':'Stock'} 단위`);
 const groups=field==='targetUnit'?[['반응당 copies',COPY_AMOUNT_UNITS],['반응당 질량',MASS_AMOUNT_UNITS],['질량 농도',MASS_CONCENTRATION_UNITS],['copies 농도',COPY_CONCENTRATION_UNITS],['몰농도',MOLAR_UNITS]]:[['질량 농도',MASS_CONCENTRATION_UNITS],['copies 농도',COPY_CONCENTRATION_UNITS],['몰농도',MOLAR_UNITS]];
 for(const [label,units] of groups){const group=document.createElement('optgroup');group.label=label;for(const unit of units){const option=document.createElement('option');option.value=unit;option.textContent=unit.replace('/rxn',' / 반응');group.append(option);}select.append(group);}
 select.value=field==='targetUnit'?'pg/rxn':'ng/µL';return select;
}
function copyBasis(i){
 const details=document.createElement('details');details.className='copy-basis';const summary=document.createElement('summary');summary.textContent='질량 ↔ copies 환산 정보';details.append(summary);
 const method=document.createElement('select');method.dataset.field='mwMethod';method.setAttribute('aria-label',`${i}행 copies 환산 방법`);
 for(const [value,text] of [['','방법 선택 (질량↔copies일 때 필수)'],['direct','분자량 직접 입력 (g/mol)'],['dsdna650','dsDNA 전체 길이 × 650 (근사)']]){const option=document.createElement('option');option.value=value;option.textContent=text;method.append(option);}details.append(method);
 for(const [field,label] of [['molecularWeight','전체 Plasmid 분자량 (g/mol)'],['lengthBp','전체 Plasmid 길이 (bp)']]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.dataset.field=field;input.inputMode=field==='lengthBp'?'numeric':'decimal';input.autocomplete='off';input.setAttribute('aria-label',`${i}행 ${label}`);wrap.append(input);details.append(wrap);}
 const note=document.createElement('p');note.textContent='copies끼리는 입력 불필요. 길이는 insert/amplicon이 아닌 전체 Plasmid이며, 650은 dsDNA 근사값입니다.';details.append(note);return details;
}

function updateCount(){const rows=[...$('inputs').rows];$('row-count').textContent=`목록 ${rows.length}개 / 계산 포함 ${rows.filter(tr=>tr.querySelector('[data-field=enabled]').checked).length}개`;}
function addRow(type,seed={}){
 const generated=nextComponentName(type,counters,[...document.querySelectorAll('[data-field=name]')].map(el=>el.value));counters[type]=generated.count;
 const i=++rowCount,tr=document.createElement('tr');tr.dataset.type=type;cell(tr,String(i));
 for(const field of ['enabled','name','target','stock']){
  const td=document.createElement('td'),el=document.createElement('input');el.type=field==='enabled'?'checkbox':'text';el.dataset.field=field;
  el.setAttribute('aria-label',`${i}행 ${{enabled:'계산에 포함',name:'Oligo 이름',target:'목표 최종 반응 농도 µM',stock:'Stock 농도 µM'}[field]}`);
  if(type==='Plasmid'&&(field==='target'||field==='stock'))el.setAttribute('aria-label',`${i}행 ${field==='target'?'목표 최종 농도 또는 반응당 양':'Stock 농도'}`);
  el.autocomplete='off';if(field==='enabled')el.checked=seed.enabled!==false;
  else if(field==='name'){el.maxLength=100;el.value=seed.name??generated.name;}
  else{el.inputMode='decimal';el.value=seed[field]??(field==='stock'&&type!=='Plasmid'?'100':'');}
  td.append(el);if(type==='Plasmid'&&field==='name')td.append(copyBasis(i));
  if(field==='target'||field==='stock'){if(type==='Plasmid')td.append(unitSelect(i,field+'Unit'));else{const unit=document.createElement('span');unit.className='unit-label';unit.textContent='µM';td.append(unit);}}
  tr.append(td);
 }
 $('inputs').append(tr);updateCount();
}
function read(){return {reaction:$('reaction').value,mix:$('mix').value,count:$('count').value,rows:[...$('inputs').rows].map(tr=>({type:tr.dataset.type,...Object.fromEntries([...tr.querySelectorAll('input,select')].map(el=>[el.dataset.field,el.type==='checkbox'?el.checked:el.value]))}))};}
function invalidate(){revision++;$('copy-status').textContent='';if(result){result=null;$('results').hidden=true;$('message').textContent='입력이 변경되었습니다. 이론 부피를 다시 계산하세요.';}for(const tr of $('inputs').rows)tr.classList.toggle('excluded',!tr.querySelector('[data-field=enabled]').checked);updateCount();}
for(const button of document.querySelectorAll('[data-add-type]'))button.addEventListener('click',()=>{invalidate();addRow(button.dataset.addType);});
$('mix-form').addEventListener('input',invalidate);
$('mix-form').addEventListener('submit',event=>{event.preventDefault();result=null;$('results').hidden=true;$('message').textContent='';try{result=calculate(read());render();}catch(error){$('message').textContent=error.message;}});
function render(){
 const body=$('theory-body');body.replaceChildren();for(const r of result.rows){const tr=document.createElement('tr');[`${r.sourceIndex}. ${r.name}`,f(r.perReaction),f(r.batch),f(r.target)+' '+r.targetUnit,f(r.mixConcentration)+' '+r.mixUnit].forEach(v=>cell(tr,v));body.append(tr);}
 const te=document.createElement('tr');['TE',f(result.te),f(result.batchTE),'—','—'].forEach(v=>cell(te,v));body.append(te);
 $('summary').textContent=`최종 반응 ${f(result.reaction)} µL · Mix ${f(result.mix)} µL/반응 · ${result.count}반응 · 전체 Mix ${f(result.total)} µL. 이론 부피이며 분주 조정 미적용.`;
 const notes=result.rows.filter(r=>r.conversionNote).map(r=>r.name+': '+r.conversionNote);if(notes.length)$('summary').textContent+=' '+notes.join(' / ');
 const ab=$('adjust-body');ab.replaceChildren();for(const [i,r] of [...result.rows,{name:'TE',batch:result.batchTE}].entries()){
  const tr=document.createElement('tr');cell(tr,r.sourceIndex?`${r.sourceIndex}. ${r.name}`:r.name);cell(tr,f(r.batch));const proposed=cell(tr,'—');proposed.dataset.proposal=i;
  const td=cell(tr,''),el=document.createElement('input');el.type='text';el.inputMode='decimal';el.autocomplete='off';el.placeholder=i===result.rows.length?'Stock 선택 후 자동 계산':'부피 제안 후 직접 수정';
  el.setAttribute('aria-label',i===result.rows.length?'TE 잔여 전체량 µL':`${r.sourceIndex}행 ${r.name} 최종 선택량 µL`);el.dataset.index=i;if(i===result.rows.length)el.readOnly=true;td.append(el);ab.append(tr);
 }
 clearAdjustment();$('results').hidden=false;$('message').textContent='이론 배합량을 계산했습니다.';
}
function adjustmentInputs(){return [...$('adjust-body').querySelectorAll('input')];}
function clearAdjustment(){$('adjust-status').textContent='';$('adjust-output').replaceChildren();}
function deriveTE(){const inputs=adjustmentInputs();inputs.at(-1).value='';inputs.at(-1).value=remainingTE(result,inputs.slice(0,-1).map(el=>el.value));}
function reviewAdjustment(){
 clearAdjustment();if(!result)return;
 try{
  deriveTE();const volumes=adjustmentInputs().map(el=>el.value),settings={step:$('step').value,min:$('minimum').value,max:$('maximum').value};
  const a=adjusted(result,volumes.slice(0,-1),volumes.at(-1)),checks=volumes.map(v=>checkPipette(v,settings));
  const messages=checks.flatMap((c,i)=>c.valid?[]:[`${i===result.rows.length?'TE':result.rows[i].name}: ${c.note}`]);
  volumes.slice(0,-1).forEach((v,i)=>{if(Number(v)===0)messages.push(`${result.rows[i].name}: 0µL로 미분주합니다. 목표량이 충족되지 않습니다.`);});
  $('adjust-status').textContent=messages.join('\n');
  const out=$('adjust-output'),p=document.createElement('p');p.textContent=`선택 전체 Mix ${f(a.total)} µL / 목표 ${f(result.total)} µL · ${messages.length?'간격·범위 또는 미분주 항목을 확인하세요':settings.min.trim()&&settings.max.trim()?'입력한 간격·범위 확인 완료':'간격 확인 완료 · 최소/최대 범위 미입력'}. 장비 정확도 보증은 아닙니다.`;out.append(p);
  const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');table.className='result-table';['성분','예상 최종 농도 / 반응당 양','목표 대비 편차 (%)'].forEach(v=>cell(head,v,'th'));thead.append(head);table.append(thead);
  const body=document.createElement('tbody');for(const [i,r] of a.rows.entries()){const tr=document.createElement('tr');[`${result.rows[i].sourceIndex}. ${r.name}`,f(r.achieved)+' '+r.targetUnit,f(r.deviationPercent)].forEach(v=>cell(tr,v));body.append(tr);}table.append(body);
  const wrap=document.createElement('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','조정 후 예상 농도');wrap.append(table);out.append(wrap);
 }catch(error){$('adjust-status').textContent=error.message;}
}
$('suggest-adjustment').addEventListener('click',()=>{
 clearAdjustment();if(!result)return;try{
  const proposed=proposePreparation(result,$('step').value),values=[...proposed.volumes,proposed.te],inputs=adjustmentInputs();
  for(const [i,v] of values.entries()){$('adjust-body').querySelector(`[data-proposal="${i}"]`).textContent=f(Number(v));inputs[i].value=v;}
  reviewAdjustment();
 }catch(error){$('adjust-status').textContent=error.message;}
});
$('adjust-body').addEventListener('input',reviewAdjustment);
for(const id of ['step','minimum','maximum'])$(id).addEventListener('input',()=>{clearAdjustment();if(id==='step'){for(const el of adjustmentInputs())el.value='';for(const el of $('adjust-body').querySelectorAll('[data-proposal]'))el.textContent='—';}else if(result&&adjustmentInputs()[0]?.value)reviewAdjustment();});
$('check-adjustment').addEventListener('click',reviewAdjustment);
function clearPaste(){pasteData=null;$('apply-paste').disabled=true;$('paste-preview').replaceChildren();$('paste-status').textContent='';}
for(const id of ['paste-text','paste-header','paste-type','paste-mode'])$(id).addEventListener('input',clearPaste);
$('preview-paste').addEventListener('click',()=>{
 clearPaste();try{
  pasteData=parseOligoPaste($('paste-text').value,{header:$('paste-header').checked,type:$('paste-type').value});
  const existing=$('paste-mode').value==='append'?new Set([...document.querySelectorAll('[data-field=name]')].map(el=>el.value)):new Set();
  const duplicate=[...new Set([...pasteData.duplicates,...pasteData.rows.filter(r=>existing.has(r.name)).map(r=>r.name)])];
  $('paste-status').textContent=`${pasteData.rows.length}개 · 빈 Stock ${pasteData.defaults}개에 100µM 적용 · 빈줄 ${pasteData.blank}개 제외.${duplicate.length?' 같은 이름이 있습니다: '+duplicate.join(', ')+'. 자동 병합하지 않습니다.':''}${$('paste-mode').value==='replace'?' 목록 반영 시 기존 목록 전체를 교체합니다.':''}`;
  const table=document.createElement('table'),head=document.createElement('tr');['번호','이름','최종 농도 µM','Stock µM'].forEach(v=>cell(head,v,'th'));table.append(head);
  for(const [i,r] of pasteData.rows.entries()){const tr=document.createElement('tr');[i+1,r.name,r.target,r.stock+(r.defaultStock?' (기본값)':'')].forEach(v=>cell(tr,v));table.append(tr);} $('paste-preview').append(table);$('apply-paste').disabled=false;
 }catch(error){$('paste-status').textContent=error.message;}
});
$('apply-paste').addEventListener('click',()=>{
 if(!pasteData)return;const rows=pasteData.rows;invalidate();
 if($('paste-mode').value==='replace'){$('inputs').replaceChildren();rowCount=0;for(const key of Object.keys(counters))delete counters[key];}
 for(const r of rows)addRow(r.type,r);clearPaste();$('paste-status').textContent=`${rows.length}개를 반영했습니다. 이론 부피를 계산하세요.`;
});
$('copy-excel').addEventListener('click',async()=>{
 if(!result||copying)return;
 const atRevision=revision,payload=excelClipboard(result);copying=true;$('copy-excel').disabled=true;$('copy-status').textContent='';
 try{
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('이 브라우저는 서식 있는 복사를 지원하지 않습니다. Chrome의 HTTPS 또는 로컬 미리보기에서 실행하세요.');
  await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([payload.html],{type:'text/html'}),'text/plain':new Blob([payload.text],{type:'text/plain'})})]);
  if(atRevision!==revision)$('message').textContent='복사 중 입력이 변경되었습니다. 클립보드에는 변경 전 결과가 있습니다. 다시 계산 후 복사하세요.';
  $('copy-status').textContent=atRevision===revision?'복사했습니다. Excel의 A1 또는 빈 영역 시작 셀에 붙여넣고 원본 서식을 유지하세요. 맑은 고딕 9pt 표입니다.':'복사 중 입력이 변경되었습니다. 클립보드에는 변경 전 결과가 있습니다. 다시 계산 후 복사하세요.';
 }catch(error){$('copy-status').textContent='복사하지 못했습니다. '+(error.name==='NotAllowedError'?'브라우저의 클립보드 쓰기 권한을 확인하고 다시 누르세요.':error.message);}
 finally{copying=false;$('copy-excel').disabled=false;}
});

for(const type of ['F','R','P'])addRow(type);
