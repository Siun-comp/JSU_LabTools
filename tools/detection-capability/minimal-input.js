/* Minimum input adapter. Page-memory only; never runs statistics. */
'use strict';
window.MinimalInputs=(()=>{
 const keys=['lod','confirmation','lob','loq'],names={LoD:'lod',Confirmation:'confirmation',LoB:'lob',LoQ:'loq'};
 const state=Object.fromEntries(keys.map(k=>[k,{revision:0,source:null,undo:null,history:[]}])) ;
 const panel=k=>document.getElementById(k),clone=x=>structuredClone(x),values=(p,s)=>[...p.querySelectorAll(s)].map(x=>x.value);
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 function capture(k){const p=panel(k),[unit,setting]=values(p,'.settings input'),[group,reference]=values(p,'.context input');return {key:k,unit,setting,group,reference,dataKind:p.querySelector('.data-kind').value,rows:values(p,'tbody input').reduce((a,v,i)=>{if(i%3===0)a.push([]);a.at(-1).push(v);return a;},[]),blank:k==='lob'?p.querySelector('textarea').value:'',samples:k==='loq'?[...p.querySelectorAll('.sample')].map(s=>{const [name,reference,source]=values(s,'input');return {name,reference,source,measurements:s.querySelector('textarea').value};}):[]};}
 const stamp=k=>JSON.stringify(capture(k));
 function render(k,d){const p=panel(k);p.querySelectorAll('.settings input').forEach((e,i)=>e.value=[d.unit,d.setting][i]);p.querySelectorAll('.context input').forEach((e,i)=>e.value=[d.group,d.reference][i]);p.querySelector('.data-kind').value=d.dataKind;
  if(k==='lod'||k==='confirmation'){p.querySelector('tbody').replaceChildren();for(const vals of d.rows){row(p);[...p.querySelector('tbody').lastElementChild.querySelectorAll('input')].forEach((e,i)=>e.value=vals[i]);}}
  if(k==='lob')p.querySelector('textarea').value=d.blank;
  if(k==='loq'){p.querySelector('.samples').replaceChildren();for(const item of d.samples){sample(p);const s=p.querySelector('.samples').lastElementChild;s.querySelectorAll('input').forEach((e,i)=>e.value=[item.name,item.reference,item.source][i]);s.querySelector('textarea').value=item.measurements;}}
 }
 function note(k,message){panel(k).querySelector('.input-feedback').textContent=message;document.dispatchEvent(new CustomEvent('minimal-input-change',{detail:{module:k}}));}
 function touch(k){state[k].revision++;panel(k).querySelector('.undo-input').disabled=true;note(k,`입력이 변경되었습니다. 다시 계산하세요.${state[k].source?' · 적용 이후 편집됨':''}`);}
 function numeric(s){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)&&!(n===0&&/[1-9]/.test(s.split(/[eE]/)[0]))?n:null;}
 // Decimal percent/unit encoding, not rounding of calculated statistics.
 function shiftDecimal(s,places){const [mantissa,exponent='0']=String(s).split(/[eE]/);return numeric(mantissa+'e'+(Number(exponent)+places));}
 function parseTSV(text,width){if(text.length>1000000)throw Error('붙여넣기 한도는 1,000,000자입니다.');const rows=[];let row=[],v='',quoted=false,closed=false;const push=()=>{row.push(v);v='';closed=false;};
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){v+='"';i++;}else{quoted=false;closed=true;}}else v+=c;continue;}
   if(c==='"'&&v===''&&!closed){quoted=true;continue;}if(c==='\t'){push();continue;}if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;push();rows.push(row);row=[];continue;}if(closed)throw Error('따옴표 뒤에는 탭/줄바꿈만 허용됩니다.');v+=c;
  }if(quoted)throw Error('닫히지 않은 따옴표가 있습니다.');push();rows.push(row);const used=rows.filter(r=>r.some(x=>x!==''));if(!used.length)throw Error('붙여넣을 데이터가 없습니다.');if(used.length>1000)throw Error('최대 1,000행입니다.');if(used.some(r=>r.length!==width))throw Error(`헤더 없이 ${width}열을 복사하세요. 빈 칸도 탭으로 구분합니다.`);return used;
 }
 function validate(d,dataOnly=false){const errors=[],warnings=[],rows=d.rows.filter(r=>r.some(v=>v!==''));const num=(s,label,test=()=>true)=>{const n=numeric(s);if(n===null||!test(n)){errors.push(label+' 값을 확인하세요.');return null;}return n;};
  let data={};if(d.key==='lod'||d.key==='confirmation'){if(!rows.length)errors.push('농도별 데이터가 없습니다.');if(rows.length>1000)errors.push('1,000행을 초과했습니다.');const rowNumbers=d.rows.flatMap((r,i)=>r.some(v=>v!=='')?[i+1]:[]),seen=new Map();data.rows=rows.map((r,i)=>{const rowNumber=rowNumbers[i],c=num(r[0],`${rowNumber}행 농도`,n=>n>0),n=num(r[1],`${rowNumber}행 N`,n=>Number.isSafeInteger(n)&&n>0),positive=num(r[2],`${rowNumber}행 양성 수`,n=>Number.isSafeInteger(n)&&n>=0);if(c!==null){if(seen.has(c))errors.push(`${rowNumber}행 농도가 ${seen.get(c)}행과 중복됩니다. 원 행을 확인하세요. 자동 합산하지 않습니다.`);else seen.set(c,rowNumber);}if(n!==null&&positive!==null&&positive>n)errors.push(`${rowNumber}행 양성 수가 N보다 큽니다.`);return {concentration:c,n,positive};});}
  const list=(text,label)=>{let rs;try{rs=parseTSV(text,1);}catch(e){errors.push(label+': '+e.message);return [];}return rs.map((r,i)=>num(r[0],`${label} ${i+1}행`));};
  if(d.key==='lob')data.values=list(d.blank,'Blank');
  if(d.key==='loq'){const ss=d.samples.filter(s=>Object.values(s).some(v=>v!==''));if(!ss.length)errors.push('검체 데이터가 없습니다.');if(ss.length>8)errors.push('최대 8검체입니다.');const seen=new Set();data.samples=ss.map((s,i)=>{if(!s.name.trim()||seen.has(s.name))errors.push(`검체 ${i+1} 이름 누락/중복`);seen.add(s.name);const ref=num(s.reference,`검체 ${i+1} 기준값`,n=>n>0),vs=list(s.measurements,`검체 ${i+1}`);if(vs.length<2)errors.push(`검체 ${i+1}: SD 계산에 필요한 값 부족`);if(!s.source.trim())warnings.push(`검체 ${i+1}: 기준값 출처 미기재`);return {sampleName:s.name,referenceValue:ref,referenceSource:s.source,values:vs};});}
  let fraction=null;if(!dataOnly){if(!d.unit.trim())errors.push('단위를 입력하세요.');if(d.setting===''){(['confirmation','loq'].includes(d.key)?warnings:errors).push('분석 설정/사전 기준 미기재');}else{const p=num(d.setting,'설정 (%)',n=>d.key==='loq'?n>0:d.key==='confirmation'?n>=0&&n<=100:n>0&&n<100);fraction=p===null?null:shiftDecimal(d.setting,-2);if(p!==null&&fraction===null)errors.push('설정 (%) 변환의 수치 범위를 확인하세요.');}}
  return {errors,warnings,data:{module:d.key,unit:d.unit,setting:fraction,groupLabel:d.group,sourceReference:d.reference,dataKind:d.dataKind,...data}};
 }
 const dialog=make('dialog','');dialog.id='input-transfer';dialog.setAttribute('aria-label','입력 변경 확인');document.body.append(dialog);
 function offer(k,d,source,current=()=>true){const before=capture(k),fingerprint=stamp(k),rev=state[k].revision;dialog.replaceChildren();dialog.append(make('h2',configs[k].title+' 입력 적용'));
  dialog.append(make('p',source.kind==='paste'&&k==='loq'?`검체 ${source.target+1}의 측정값 목록과 모듈 자료 구분을 교체합니다. 나머지 입력과 원본 파일은 유지합니다. 통계를 계산하지 않습니다.`:'이 모듈의 기존 입력을 아래 내용으로 교체합니다. 다른 모듈과 원본 파일은 변경하지 않습니다. 통계를 계산하지 않습니다.'));
  if(source.kind==='unit-conversion')dialog.append(make('p',`${source.fromUnit} → ${source.toUnit} · 값 × 10^${source.power} · 원 입력/출처 보존 · 적용 후 다시 계산하세요.`));
  const check=validate(d);dialog.append(make('p',`자료: ${d.dataKind||'미기재'} · 단위: ${d.unit||'미기재'} · 설정: ${d.setting||'미기재'}%`));
  const content=d.key==='lob'?d.blank:d.key==='loq'?d.samples.map(s=>`${s.name} / 기준값 ${s.reference}\n${s.measurements}`).join('\n\n'):d.rows.map(r=>r.join('\t')).join('\n');const pre=make('pre',content);pre.className='transfer-preview';dialog.append(pre);
  if(check.errors.length||check.warnings.length)dialog.append(make('p','입력 후 보완 필요: '+[...check.errors,...check.warnings].slice(0,6).join(' / ')));
  const apply=make('button',source.kind==='unit-conversion'?'확인 후 변환':'확인 후 교체'),cancel=make('button','취소'),feedback=make('p','');feedback.id='transfer-feedback';cancel.onclick=()=>dialog.close();dialog.append(apply,cancel,feedback);
  apply.onclick=()=>{if(!current()||stamp(k)!==fingerprint||state[k].revision!==rev){feedback.textContent='입력 또는 선택 파일이 변경되었습니다. 취소하고 다시 확인하세요.';apply.disabled=true;return;}
   const oldSource=clone(state[k].source);render(k,d);state[k].revision++;state[k].source={...clone(source),appliedStamp:stamp(k)};state[k].history.push({before,after:clone(d),source:clone(source)});state[k].undo={before,oldSource,after:stamp(k),revision:state[k].revision};panel(k).querySelector('.undo-input').disabled=false;note(k,`${source.kind==='file'?'파일':source.kind==='unit-conversion'?'단위 변환':'Excel 붙여넣기'} 적용${d.dataKind?' · '+d.dataKind:''} · 다시 계산하세요.`);dialog.close();select(k);};
  if(!dialog.open)dialog.showModal();
 }
 function paste(k,target=null,initial=''){dialog.replaceChildren();dialog.append(make('h2',configs[k].title+' Excel 붙여넣기'));const width=['lod','confirmation'].includes(k)?3:1;dialog.append(make('p',width===3?'농도 · N · 양성 수의 3열을 헤더 없이 복사하세요. 확인 후 표 전체를 교체합니다.':'측정값 한 열을 복사하세요. 확인 후 선택한 측정값 목록 전체를 교체합니다.'));
  const kindLabel=make('label','자료 구분 (모듈 전체에 적용)'),kind=document.createElement('select');kind.id='paste-kind';for(const v of ['','실제','합성']){const o=make('option',v||'미선택');o.value=v;kind.append(o);}kindLabel.append(kind);const kindDetails=make('details','');kindDetails.append(make('summary','자료 구분 (선택)'),kindLabel);dialog.append(kindDetails);
  const text=document.createElement('textarea');text.id='paste-values';text.setAttribute('aria-label','붙여넣을 Excel 값');text.value=initial;const next=make('button','붙여넣기 미리보기'),cancel=make('button','취소'),feedback=make('p','');feedback.id='paste-feedback';dialog.append(text,next,cancel,feedback);cancel.onclick=()=>dialog.close();
  next.onclick=()=>{try{const rs=parseTSV(text.value,width);for(let r=0;r<rs.length;r++)for(const v of rs[r])if(numeric(v)===null)throw Error(`${r+1}행: 빈칸·ND·수식·비숫자 값을 확인하세요. 원문은 그대로 남습니다.`);const d=capture(k);if(width===3){d.rows=rs;const check=validate(d,true);if(check.errors.length)throw Error(check.errors[0]);}else if(k==='lob')d.blank=rs.map(r=>r[0]).join('\n');else{if(target===null||!d.samples[target])throw Error('적용할 검체를 다시 선택하세요.');d.samples[target].measurements=rs.map(r=>r[0]).join('\n');}
   d.dataKind=kind.value;const source={kind:'paste',text:text.value,previous:clone(state[k].source),target};offer(k,d,source);
  }catch(e){feedback.textContent=e.message;}};
  if(!dialog.open)dialog.showModal();text.focus();
 }
 function fileCandidate(r,name){const k=names[name],cells=r.raw[name],get=ref=>cells.get(ref)?.value??'',d={key:k,unit:get('B4'),setting:get('B5')===''?'':String(shiftDecimal(get('B5'),2)??'범위 초과'),group:get('B6'),reference:get('B7'),dataKind:['실제','합성'].includes(r.dataKind)?r.dataKind:'',rows:[],blank:'',samples:[]};
  if(k==='lod'||k==='confirmation'){for(let n=11;n<=1010;n++){const v=['A','B','C'].map(c=>get(c+n));if(v.some(x=>x!==''))d.rows.push(v);}}
  if(k==='lob')d.blank=[...cells.values()].filter(c=>c.column===0&&c.row>=11&&c.row<=1010&&c.value!=='').sort((a,b)=>a.row-b.row).map(c=>c.value).join('\n');
  if(k==='loq')for(let c=1;c<=8;c++){const letter=String.fromCharCode(65+c),s={name:get(letter+'10'),reference:get(letter+'11'),source:get(letter+'12'),measurements:[...cells.values()].filter(x=>x.column===c&&x.row>=15&&x.row<=1014&&x.value!=='').sort((a,b)=>a.row-b.row).map(x=>x.value).join('\n')};if(Object.values(s).some(v=>v!==''))d.samples.push(s);}
  return d;
 }
 for(const k of keys){const p=panel(k),tools=make('div','');tools.className='actions';const kindLabel=make('label','자료 구분 '),kind=document.createElement('select');kind.className='data-kind';kind.setAttribute('aria-label',configs[k].title+' 자료 구분');for(const v of ['','실제','합성']){const o=make('option',v||'미선택');o.value=v;kind.append(o);}kindLabel.append(kind);p.querySelector('.context').append(kindLabel);
  const pasteButton=make('button','Excel 붙여넣기'),check=make('button','입력 확인'),undo=make('button','적용 되돌리기');undo.className='undo-input';undo.disabled=true;
  if(k!=='loq'){pasteButton.onclick=()=>paste(k);tools.append(pasteButton);}else{const hint=make('p','검체의 측정값 칸에서 Ctrl+V로 붙여넣으세요.');hint.className='hint';tools.append(hint);}
  check.onclick=()=>{const c=validate(capture(k));note(k,c.errors.length?'보완: '+c.errors.slice(0,6).join(' / '):'기초 입력 확인 · 통계 미계산'+(c.warnings.length?' · '+c.warnings.join(' / '):''));};
  undo.onclick=()=>{const u=state[k].undo;if(!u||u.after!==stamp(k)||u.revision!==state[k].revision){undo.disabled=true;note(k,'적용 이후 입력이 변경되어 되돌리기를 차단했습니다.');return;}render(k,u.before);state[k].source=u.oldSource;state[k].revision++;state[k].history.push({undo:true,restored:clone(u.before)});state[k].undo=null;undo.disabled=true;note(k,'적용 전 입력으로 복원했습니다. 통계 미계산');};
  tools.append(undo);p.querySelector('.context').append(check);const feedback=make('p','값과 단위·설정을 입력한 뒤 위의 계산 버튼을 누르세요. 입력 확인은 기초 형식만 검사합니다.');feedback.className='input-feedback hint';feedback.setAttribute('role','status');const kindHelp=make('p','실제: 시험에서 얻은 데이터 / 합성: 연습·시연용 데이터. 자료 구분은 결과 표시에만 쓰이며 계산식은 같습니다. 선택하지 않아도 계산할 수 있습니다.');kindHelp.className='hint data-kind-help';p.querySelector('.context').append(kindHelp);p.append(tools,feedback);
  p.addEventListener('input',e=>{if(!e.target.matches('select'))touch(k);});p.addEventListener('change',e=>{if(e.target.matches('select'))touch(k);});p.addEventListener('click',e=>{if(e.target.closest('.add'))touch(k);});
  p.addEventListener('paste',e=>{const t=e.target;if(!t.matches('tbody input,textarea'))return;const text=e.clipboardData?.getData('text/plain');if(text===undefined)return;if(t.matches('tbody input')&&!/[\t\r\n]/.test(text))return;e.preventDefault();const index=k==='loq'?[...p.querySelectorAll('.sample')].indexOf(t.closest('.sample')):null;paste(k,index,text);});
 }
 return {capture,validate,parseTSV,
  exportProject:()=>Object.fromEntries(keys.map(k=>[k,{raw:capture(k),revision:state[k].revision,source:clone(state[k].source),history:clone(state[k].history)}])),
  restoreProject(modules){if(!window.ProjectFileContract?.validModules(modules))throw Error('지원하지 않는 작업 입력 구조입니다.');if(dialog.open)dialog.close();for(const k of keys){const d=clone(modules[k]);render(k,d.raw);state[k].revision=Math.max(state[k].revision,d.revision)+1;state[k].source=d.source;state[k].history=d.history;state[k].undo=null;panel(k).querySelector('.undo-input').disabled=true;note(k,'작업 파일에서 입력 복원 · 다시 계산하세요.');}},
  snapshot:k=>({raw:capture(k),...validate(capture(k)),revision:state[k].revision,source:clone(state[k].source),modifiedSinceSource:!!state[k].source&&state[k].source.appliedStamp!==stamp(k)}),
  offerFile(r,name,current){const s=r.sheets.find(s=>s.name===name);if(!s||!s.count||r.blockingBySheet[name]||r.blockingBySheet['안내'])return;const d=fileCandidate(r,name);offer(names[name],d,{kind:'file',filename:r.filename,sha256:r.sha256,version:r.version,dataKind:r.dataKind,sheet:name,originalCells:[...r.raw[name].values()],originalSetting:r.raw[name].get('B5')?.value},current);},
  offerConversion(k,d,source){offer(k,d,source);},
  cancelFile(){if(dialog.open)dialog.close();}};
})();
