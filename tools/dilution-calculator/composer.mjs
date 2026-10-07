import {compose,UNITS,TOOL_VERSION,COMPOSER_VERSION} from './composer-core.mjs';
const $=s=>document.querySelector(s),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind=u=>['M','mM','uM','nM'].includes(u)?'molar':['g/L','mg/mL','mg/L','ug/mL','%w/v'].includes(u)?'mass':u;
const cross=r=>r.mode==='stock'&&kind(r.unit)!==kind(r.stockUnit)&&['molar','mass'].includes(kind(r.unit))&&['molar','mass'].includes(kind(r.stockUnit));
const blank=()=>({name:'',target:'',unit:'mM',mode:'solid',mw:'',stock:'',stockUnit:'mM'});
let recipes=[],selected=null,rows=[blank()],dirty=false,result=null;
const altered=()=>selected&&(rows.length!==selected.rows.length||rows.some((r,i)=>['name','target','unit'].some(k=>r[k]!==selected.rows[i]?.[k])));
function opts(values,value){return values.map(u=>`<option value="${escape(u)}"${u===value?' selected':''}>${escape(u.replace('uM','µM').replace('ug','µg'))}</option>`).join('');}
function input(i,key,value,placeholder=''){return `<input data-key="${key}" aria-label="${i+1}행 ${({name:'시약명',target:'목표 농도',mw:'MW',stock:'Stock 농도'})[key]}" value="${escape(value)}" placeholder="${escape(placeholder)}"${key!=='name'?' inputmode="decimal"':''}>`;}
function units(i,key,value){return `<select data-key="${key}" aria-label="${i+1}행 ${key==='unit'?'목표 단위':'Stock 단위'}">${opts(UNITS,value)}</select>`;}
function draw(){
 $('#composer-rows').innerHTML=rows.map((r,i)=>{
  let source;
  if(r.mode==='solid')source=kind(r.unit)==='molar'?input(i,'mw',r.mw,'MW (g/mol)')+'<span class="field-note">MW · g/mol</span>':'<span class="field-note">MW 불필요</span>';
  else if(r.mode==='pure')source='<span class="field-note">희석하지 않은 액체 · 100% v/v</span>';
  else source=`<div class="value-unit">${input(i,'stock',r.stock,'원액 농도')}${units(i,'stockUnit',r.stockUnit)}</div>`+(cross(r)?input(i,'mw',r.mw,'환산 MW (g/mol)'):'<span class="field-note">보유 Stock 농도</span>');
  return `<tr data-row="${i}"><td>${input(i,'name',r.name,'시약명')}</td><td><select data-key="mode" aria-label="${i+1}행 조제 방법">${[['solid','고체'],['stock','Stock 용액'],['pure','액체 원액']].map(([v,t])=>`<option value="${v}"${r.mode===v?' selected':''}>${t}</option>`).join('')}</select></td><td><div class="value-unit">${input(i,'target',r.target,'농도')}${units(i,'unit',r.unit)}</div></td><td>${source}</td><td><output data-amount>—</output><span data-actual class="field-note"></span></td><td><button type="button" data-delete="${i}" aria-label="${i+1}행 삭제">삭제</button></td></tr>`;
 }).join('');
}
function invalidate(){result=null;$('#composer-copy').disabled=true;$('#makeup-result').textContent='계산 후 표시';$('#composer-copy-status').textContent='';$('#composer-status').textContent='조건이 변경되었습니다. 조제 계산을 눌러 사용량을 확인하세요.';document.querySelectorAll('[data-amount]').forEach(e=>{e.textContent='—';e.classList.remove('error');});document.querySelectorAll('[data-actual]').forEach(e=>e.textContent='');}
function heading(){const s=selected;$('#preset-heading').textContent=s?`${s.name}${altered()?' · 수정한 조성':''} — ${s.purpose}${s.ph?' · '+s.ph:''}`:'직접 작성한 조성';}
function setPreset(p){selected=p;rows=p?structuredClone(p.rows):[blank()];dirty=false;$('#composer-fold').value='1';$('#composer-notes').value='';$('#preset-select').value=p?.id||'';$('#restore-preset').disabled=!p;heading();$('#preset-notes').innerHTML=p?`${p.note?'<p>'+escape(p.note)+'</p>':''}<p>${p.sources.map(s=>`<a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.label)}</a>`).join('')}</p>`:'<p>성분과 목표 농도를 직접 입력하세요. MW와 Stock 농도는 보유 시약 기준입니다.</p>';draw();invalidate();$('#composer-status').textContent='농도와 MW 또는 Stock 농도를 입력하고 계산하세요.';}
function canReplace(){return !dirty||confirm('입력한 변경 내용을 버리고 새 조성을 불러올까요?');}
$('#composer-version').textContent=`도구 v${TOOL_VERSION} · 조제 v${COMPOSER_VERSION}`;
$('#load-preset').addEventListener('click',()=>{const p=recipes.find(p=>p.id===$('#preset-select').value);if(p&&canReplace())setPreset(p);});
$('#new-composition').addEventListener('click',()=>{if(canReplace())setPreset(null);});
$('#restore-preset').addEventListener('click',()=>{if(selected&&canReplace())setPreset(selected);});
$('#add-reagent').addEventListener('click',()=>{rows.push(blank());dirty=true;heading();draw();invalidate();});
$('#composer-rows').addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;rows.splice(Number(b.dataset.delete),1);dirty=true;heading();draw();invalidate();});
function changeRow(e){const control=e.target.closest('[data-key]');if(!control)return;const i=Number(control.closest('[data-row]').dataset.row),r=rows[i];r[control.dataset.key]=control.value;dirty=true;heading();invalidate();if(e.type==='change'&&control.tagName==='SELECT'){
 if(control.dataset.key==='mode'&&r.mode==='pure'){r.unit='%v/v';}
 draw();
}}
$('#composer-rows').addEventListener('input',changeRow);$('#composer-rows').addEventListener('change',changeRow);
['composer-volume','composer-volume-unit','composer-fold','makeup-name'].forEach(id=>$('#'+id).addEventListener('input',()=>{dirty=true;heading();invalidate();}));
$('#composer-notes').addEventListener('input',()=>{dirty=true;$('#composer-copy-status').textContent='';});
const batch=()=>({volume:$('#composer-volume').value,unit:$('#composer-volume-unit').value,fold:$('#composer-fold').value,solvent:$('#makeup-name').value});
$('#composer-form').addEventListener('submit',e=>{
 e.preventDefault();result=compose(batch(),rows);document.querySelectorAll('[data-row]').forEach((tr,i)=>{const r=result.rows[i],a=tr.querySelector('[data-amount]');a.textContent=r?.error||r?.amount||'—';a.classList.toggle('error',!!r?.error);tr.querySelector('[data-actual]').textContent=r?.actual?'제조 농도 '+r.actual:'';});
 const missing=result.rows.filter(r=>r.error).length;$('#composer-status').textContent=result.complete?'계산 완료 · 성분별 사용량을 확인하세요.':result.errors.length?result.errors.join(' '):`${missing}개 성분의 입력을 확인하세요. 필요한 내용은 해당 행에 표시했습니다.`;
 $('#composer-copy').disabled=!result.complete;$('#makeup-result').textContent=result.complete?'최종 '+batch().volume+' '+batch().unit+'까지':'입력 확인 필요';
});
function safeCell(s){s=String(s??'');return /^[=+\-@]/.test(s)?"'"+s:s;}
function clipboard(){
 const b=batch(),title=selected?.name||'직접 작성한 버퍼';const table=[['시약','조제 방법','목표 농도 (1X)','제조 농도','MW (g/mol)','Stock 농도','사용량'],...rows.map((r,i)=>[r.name,({solid:'고체',stock:'Stock 용액',pure:'액체 원액'})[r.mode],r.target+' '+r.unit,result.rows[i].actual,(r.mode==='solid'&&kind(r.unit)==='molar'||cross(r))?r.mw:'',r.mode==='stock'?r.stock+' '+r.stockUnit:'',result.rows[i].amount]),[b.solvent.trim()||'DW','최종 부피 맞춤','—','—','—','—','최종 '+b.volume+' '+b.unit+'까지']];
 const notes=[title+(altered()?' · 사용자 수정 조성':''),`최종 부피 ${b.volume} ${b.unit} / 제조 농도 ${b.fold}X`,'용매 자체의 성분과 pH 조절량은 사용량 계산에 포함되지 않습니다.',selected?.ph||'',selected?.note||'',$('#composer-notes').value,...(selected?.sources||[]).map(s=>s.label+': '+s.url),`도구 ${TOOL_VERSION} / 조제 알고리즘 ${COMPOSER_VERSION}`].filter(Boolean);
 const text=[notes.slice(0,2).map(safeCell).join('\n'),...table.map(row=>row.map(s=>safeCell(s).replace(/[\t\r\n]/g,' ')).join('\t')),...notes.slice(2).map(safeCell)].join('\n');
 const cell=s=>`<td style="border:none;padding:5px 10px;white-space:nowrap;mso-number-format:'\\@'">${escape(safeCell(s))}</td>`;
 const html='<html><body><table style="font-family:맑은 고딕,Malgun Gothic,sans-serif;font-size:9pt;border-collapse:collapse;border:none">'+notes.slice(0,2).map(s=>`<tr><td colspan="7" style="border:none;padding:6px">${escape(safeCell(s))}</td></tr>`).join('')+table.map(row=>'<tr>'+row.map(cell).join('')+'</tr>').join('')+notes.slice(2).map(s=>`<tr><td colspan="7" style="border:none;padding:6px;white-space:normal">${escape(safeCell(s))}</td></tr>`).join('')+'</table></body></html>';
 return {text,html};
}
$('#composer-copy').addEventListener('click',async()=>{if(!result?.complete)return;const snapshot=result,{text,html}=clipboard();try{if(typeof ClipboardItem!=='undefined')await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);else await navigator.clipboard.writeText(text);if(result===snapshot)$('#composer-copy-status').textContent='조제표를 복사했습니다.';}catch{if(result===snapshot)$('#composer-copy-status').textContent='클립보드 접근이 허용되지 않았습니다.';}});
try{const response=await fetch('./presets.json');if(!response.ok)throw Error();recipes=(await response.json()).recipes;$('#preset-select').innerHTML='<option value="">직접 작성</option>'+recipes.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');setPreset(recipes.find(p=>p.id==='te-am9849'));}catch{$('#preset-select').innerHTML='<option value="">직접 작성</option>';setPreset(null);$('#composer-status').textContent='프리셋을 읽지 못했습니다. 직접 작성은 사용할 수 있습니다.';}
