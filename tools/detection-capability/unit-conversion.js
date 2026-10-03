/* Same-measurand decimal unit scaling only. See UNIT_CONVERSION_SPEC.md. */
'use strict';
window.UnitConversion=(()=>{
 const units=[];
 for(const [name,family,n] of [['copies','copies',0],['IU','IU',0],['mg','mass',-3],['µg','mass',-6],['ng','mass',-9],['pg','mass',-12]])for(const [v,e] of [['mL',-3],['µL',-6]])units.push({id:name+'/'+v,family,power:n-e});
 // Case aliases for names and litre spelling, not a blanket SI-prefix fold.
 // In particular M (mega) must never silently become m (milli).
 function normalize(s){
  if(typeof s!=='string')return '';
  const parts=s.trim().split('/').map(x=>x.trim());if(parts.length!==2)return s.trim();
  let [amount,volume]=parts;
  if(/^copies$/i.test(amount))amount='copies';
  else if(/^iu$/i.test(amount))amount='IU';
  else{const m=/^(m|[uUµμ]|n|p)[gG]$/.exec(amount);if(m)amount=(/[uUµμ]/.test(m[1])?'µ':m[1])+'g';}
  const v=/^(m|[uUµμ])[lL]$/.exec(volume);if(v)volume=(/[uUµμ]/.test(v[1])?'µ':v[1])+'L';
  return amount+'/'+volume;
 }
 const resolve=s=>units.find(u=>u.id===normalize(s));
 function convert(raw,target){const from=resolve(raw.unit),to=resolve(target);if(!from||!to||from.family!==to.family)throw Error('지원하지 않는 단위 변환입니다. 희석·신호·copies↔IU 환산은 포함하지 않습니다.');
  const errors=MinimalInputs.validate(raw).errors;if(errors.length)throw Error(errors[0]);
  const d=structuredClone(raw),power=from.power-to.power,preview=[],seen=new Map();
  function value(s){const [mantissa,exponent='0']=s.split(/[eE]/),n=Number(mantissa+'e'+(Number(exponent)+power)),original=Number(s);if(!Number.isFinite(n)||(n===0&&original!==0))throw Error('환산 수치 범위를 벗어났습니다. 입력은 변경하지 않습니다.');if(seen.has(n)&&seen.get(n)!==original)throw Error('환산 후 서로 다른 값이 구별되지 않습니다.');seen.set(n,original);preview.push([s,String(n)]);return String(n);}
  function list(s){return MinimalInputs.parseTSV(s,1).map(r=>value(r[0])).join('\n');}
  if(['lod','confirmation'].includes(d.key))d.rows=d.rows.map(r=>r.some(v=>v!=='')?[value(r[0]),r[1],r[2]]:r);
  if(d.key==='lob')d.blank=list(d.blank);
  if(d.key==='loq')d.samples=d.samples.map(s=>Object.values(s).some(v=>v!=='')?{...s,reference:value(s.reference),measurements:list(s.measurements)}:s);
  d.unit=to.id;return {raw:d,preview,power,from:from.id,to:to.id,noOp:from.id===to.id};
 }
 const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const dialog=el('dialog','');dialog.id='unit-conversion';dialog.setAttribute('aria-label','단위 변환');document.body.append(dialog);
 function open(k){const snapshot=MinimalInputs.snapshot(k),raw=snapshot.raw,from=resolve(raw.unit);dialog.replaceChildren();dialog.append(el('h2','단위 변환'),el('p',`현재 단위: ${raw.unit||'미기재'}`),el('p','동일 시료의 단위 표기만 바꿉니다. 희석·추출·반응당 환산은 포함하지 않습니다. 단위만 잘못 적었다면 입력란에서 직접 수정하세요.'));
  const close=el('button','취소');close.onclick=()=>dialog.close();if(!from){dialog.append(el('p','이 단위는 자동 환산을 지원하지 않습니다. 기존 분석의 지원 조건은 변경되지 않습니다.'),close);dialog.showModal();return;}
  const label=el('label','목표 단위 '),select=el('select','');select.id='unit-target';for(const u of units.filter(u=>u.family===from.family)){const o=el('option',u.id);o.value=u.id;select.append(o);}select.value=from.id;label.append(select);
  const feedback=el('p',''),preview=el('pre','');preview.className='transfer-preview';preview.style.maxHeight='240px';preview.style.overflow='auto';const next=el('button','변경값 확인');next.id='unit-preview';let candidate=null;
  function refresh(){candidate=null;try{candidate=convert(raw,select.value);feedback.textContent=candidate.noOp?'현재와 같은 단위입니다. 변경하지 않습니다.':`값 × 10^${candidate.power} · 변경 대상 ${candidate.preview.length}개 · N/양성 수/% 기준 유지`;preview.textContent=candidate.preview.map(([a,b],i)=>`${i+1}: ${a} → ${b}`).join('\n');next.disabled=candidate.noOp;}catch(e){feedback.textContent=e.message;preview.textContent='';next.disabled=true;}}
  select.onchange=refresh;next.onclick=()=>{if(JSON.stringify(MinimalInputs.capture(k))!==JSON.stringify(raw)||MinimalInputs.snapshot(k).revision!==snapshot.revision){feedback.textContent='입력이 변경되었습니다. 취소 후 다시 확인하세요.';next.disabled=true;return;}dialog.close();MinimalInputs.offerConversion(k,candidate.raw,{kind:'unit-conversion',version:'decimal-unit-1',fromUnit:raw.unit,toUnit:candidate.to,fromId:candidate.from,power:candidate.power,factor:10**candidate.power,previous:snapshot.source});};
  dialog.append(label,feedback,preview,next,close);refresh();dialog.showModal();
 }
 for(const k of ['lod','confirmation','lob','loq']){const b=el('button','단위 변환…');b.type='button';b.className='unit-convert';b.onclick=()=>open(k);document.querySelector('#'+k+' .settings').append(b);}
 return {units,resolve,convert};
})();
