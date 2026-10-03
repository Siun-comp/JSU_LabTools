/* Input presentation only. Reuses the existing parser, raw capture and change events. */
'use strict';
window.InputUX=(()=>{
 const M=MinimalInputs,keys=['lod','confirmation','lob','loq'],checked=new Set(),make=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const panel=k=>document.getElementById(k),same=(e,text)=>{if(e.textContent!==text)e.textContent=text;};
 function list(text){
  if(!text)return {count:0,valid:0,invalid:0};
  try{const rs=M.parseTSV(text,1),valid=rs.filter(r=>M.parseNumber(r[0])!==null).length;return {count:rs.length,valid,invalid:rs.length-valid};}
  catch{return {count:text.split(/\r\n|\r|\n/).filter(s=>s!=='').length,valid:null,invalid:null};}
 }
 function listText(text){const n=list(text);return n.valid===null?`입력 줄 ${n.count}개 · 열 형식 확인 필요`:`입력 ${n.count}개 · 유효 숫자 ${n.valid}개 · 확인 필요 ${n.invalid}개`;}
 function changed(k){panel(k).dispatchEvent(new Event('input',{bubbles:true}));}
 const deletion=make('dialog');deletion.id='sample-delete';deletion.setAttribute('aria-label','검체 삭제 확인');document.body.append(deletion);
 function remove(s){
  const p=panel('loq');if(p.querySelectorAll('.sample').length<=1)return;
  const raw=M.capture('loq'),items=[...p.querySelectorAll('.sample')],index=items.indexOf(s),item=raw.samples[index];if(!item)return;
  const act=()=>{s.remove();changed('loq');refresh('loq');};
  if(!Object.values(item).some(v=>v!=='')){act();return;}
  const stamp=JSON.stringify(raw),revision=M.snapshot('loq').revision;deletion.replaceChildren(make('h2','검체 삭제'),make('p',`${item.name||'검체 '+(index+1)}의 입력값을 삭제합니다. 현재 결과는 다시 계산해야 합니다.`));
  const yes=make('button','검체 삭제'),no=make('button','취소'),status=make('p');status.setAttribute('role','status');
  no.onclick=()=>deletion.close();yes.onclick=()=>{if(JSON.stringify(M.capture('loq'))!==stamp||M.snapshot('loq').revision!==revision||!s.isConnected){status.textContent='입력이 변경되었습니다. 취소 후 다시 확인하세요.';yes.disabled=true;return;}deletion.close();act();};deletion.append(yes,no,status);deletion.showModal();no.focus();
 }
 function decorateSample(s,index){
  if(!s.dataset.ux){
   s.dataset.ux='true';const h=s.querySelector('h3'),body=make('div');body.className='sample-body';
   for(const node of [...s.childNodes])if(node!==h)body.append(node);
   const bar=make('div');bar.className='sample-toolbar';const toggle=make('button','접기'),del=make('button','삭제');toggle.type=del.type='button';toggle.className='sample-toggle';del.className='sample-delete';toggle.setAttribute('aria-expanded','true');
   toggle.onclick=()=>{body.hidden=!body.hidden;toggle.textContent=body.hidden?'펼치기':'접기';toggle.setAttribute('aria-expanded',String(!body.hidden));};del.onclick=()=>remove(s);bar.append(h,toggle,del);
   const summary=make('p');summary.className='sample-summary';s.append(bar,summary,body);
   const labels=body.querySelectorAll('label');const fields=make('div');fields.className='sample-fields';fields.append(labels[0],labels[1]);body.prepend(fields);
   const source=body.querySelector('details');source.open=true;source.querySelector('summary').textContent='기준값 출처 · LoQ 후보 제공 시 필요';
   const paste=make('button','Excel 붙여넣기');paste.type='button';paste.className='sample-paste';paste.onclick=()=>M.openPaste('loq',[...panel('loq').querySelectorAll('.sample')].indexOf(s));
   const textarea=s.querySelector('textarea'),count=make('p');count.className='value-count';count.setAttribute('role','status');textarea.before(paste);textarea.after(count);
  }
  same(s.querySelector('h3'),'검체 '+(index+1));const raw=M.capture('loq').samples[index],n=list(raw.measurements),unit=M.capture('loq').unit;
  same(s.querySelector('.sample-summary'),`${raw.name||'이름 미입력'} · 기준값 ${raw.reference||'미입력'} ${unit} · 측정값 ${n.count}개 · 출처 ${raw.source.trim()?'기입':'미기입'}`);
  same(s.querySelector('.value-count'),listText(raw.measurements));s.querySelector('.sample-delete').disabled=panel('loq').querySelectorAll('.sample').length<=1;
 }
 function decorateRows(p,k){
  const head=p.querySelector('thead tr');if(!head.querySelector('.row-number')){const th=make('th','번호');th.scope='col';th.className='row-number';head.prepend(th);}
  const unit=M.capture(k).unit;same(head.children[1],'농도'+(unit?' ('+unit+')':''));same(head.children[2],'분석 대상 수 N');
  [...p.querySelectorAll('tbody tr')].forEach((tr,i)=>{let th=tr.querySelector('th');if(!th){th=make('th');th.scope='row';th.className='row-number';tr.prepend(th);}same(th,String(i+1));});
 }
 function clearErrors(p){for(const e of p.querySelectorAll('[aria-invalid]')){e.removeAttribute('aria-invalid');e.removeAttribute('aria-errormessage');}p.querySelectorAll('.field-issue').forEach(e=>e.remove());}
 function showIssues(k,focus=false){
  const p=panel(k);clearErrors(p);const raw=M.capture(k),s=M.snapshot(k),errors=[...s.errors];
  if(k==='lod')for(const e of LoDRequest.build(s).errors)if(!errors.includes(e))errors.push(e);
  if(k==='loq')for(const e of LoQResults.build(s).errors)if(!errors.includes(e))errors.push(e);
  if(k==='confirmation')for(const e of ConfirmationResults.build(s).errors)if(!errors.includes(e))errors.push(e);
  if(k==='lob'){
   const method=LoBAnalysis.method,n=list(raw.blank);
   if(raw.setting!==''&&M.shiftDecimal(raw.setting,-2)!==method.supportedAlpha)errors.push('현재 LoB는 α=5%만 지원합니다. 입력값은 유지합니다.');
   if(n.valid!==null&&(n.valid<method.minResults||n.valid>method.maxResults))errors.push(`현재 LoB 지원 범위는60–1,000개입니다. 유효 숫자 ${n.valid}개를 확인하세요.`);
  }
  const settings=[...p.querySelectorAll('.settings input')],fieldErrors=new Map();
  const put=(e,t)=>{if(e&&!fieldErrors.has(e))fieldErrors.set(e,t);};
  for(const text of errors){
   const r=text.match(/^(\d+)행/),sample=text.match(/^검체 (\d+)/);
   if(r){const tr=p.querySelectorAll('tbody tr')[Number(r[1])-1],inputs=tr?.querySelectorAll('input');put(inputs?.[text.includes('양성')?2:text.includes('N')?1:0],text);}
   else if(sample){const ss=p.querySelectorAll('.sample')[Number(sample[1])-1];put(text.includes('기준값')?ss?.querySelectorAll('input')[1]:text.includes('이름')?ss?.querySelector('input'):ss?.querySelector('textarea'),text);}
   else if(text.includes('단위')||text.includes('척도'))put(settings[0],text);
   else if(text.includes('설정')||text.includes('α='))put(settings[1],text);
   else if(k==='lob')put(p.querySelector('textarea'),text);
   else if(k==='lod'&&text.includes('농도'))put(p.querySelector('tbody input'),text);
  }
  let first;for(const [e,text]of fieldErrors){const note=make('span','확인 필요: '+text);note.className='field-issue';note.id=k+'-field-issue-'+fieldErrors.size+'-'+[...fieldErrors.keys()].indexOf(e);e.setAttribute('aria-invalid','true');e.setAttribute('aria-errormessage',note.id);e.after(note);first??=e;}
  const summary=p.querySelector('.input-issues');summary.replaceChildren();summary.hidden=!errors.length;
  if(errors.length){summary.append(make('strong',`입력 확인 필요 ${errors.length}건`));const ul=make('ul');for(const text of errors)ul.append(make('li',text));summary.append(ul);}
  if(focus&&first){const body=first.closest('.sample-body');if(body?.hidden){body.hidden=false;const b=body.closest('.sample').querySelector('.sample-toggle');b.textContent='접기';b.setAttribute('aria-expanded','true');}first.focus();first.scrollIntoView({block:'center'});}
 }
 function refresh(k){
  const p=panel(k),raw=M.capture(k);
  if(k==='lod'||k==='confirmation'){decorateRows(p,k);const n=raw.rows.filter(r=>r.some(v=>v!=='')).length;same(p.querySelector('.input-count'),`표시 행 ${raw.rows.length}개 · 작성 행 ${n}개`);}
  if(k==='lob')same(p.querySelector('.input-count'),listText(raw.blank));
  if(k==='loq'){const ss=[...p.querySelectorAll('.sample')];ss.forEach(decorateSample);p.querySelector('.add').disabled=ss.length>=8;same(p.querySelector('.input-count'),`검체 ${ss.length}/8개 · 작성 ${raw.samples.filter(s=>Object.values(s).some(v=>v!=='')).length}개`);}
  if(checked.has(k))showIssues(k);
 }
 for(const k of keys){
  const p=panel(k),toolbar=make('div');toolbar.className='data-toolbar';const title=make('h3',k==='lob'?'Blank 측정값':k==='loq'?'검체별 입력':'농도별 입력'),count=make('p');count.className='input-count';count.setAttribute('role','status');toolbar.append(title,count);p.querySelector('.settings').after(toolbar);
  const paste=[...p.querySelectorAll('button')].find(b=>b.textContent==='Excel 붙여넣기');if(paste)toolbar.append(paste);
  if(k==='lod'||k==='confirmation')toolbar.append(p.querySelector('.add'));
  const check=[...p.querySelectorAll('button')].find(b=>b.textContent==='입력 확인'),run=p.querySelector('#'+k+'-run');check.classList.add('input-check');run.parentElement.prepend(check);
  check.addEventListener('click',()=>{checked.add(k);showIssues(k,true);});run.addEventListener('click',()=>{checked.add(k);showIssues(k,true);});
  const issues=make('div');issues.className='input-issues';issues.setAttribute('role','status');issues.hidden=true;run.parentElement.after(issues);
  const prepare=p.querySelector('#lod-prepare');if(prepare){const d=make('details');d.className='input-detail-check';d.append(make('summary','자세한 입력 요약'),prepare);issues.after(d);}
  const helper=make('p');helper.className='input-support';
  if(k==='lob'){helper.textContent='현재 방법: α=5% · Blank 수치60–1,000개. 값이 클수록 신호가 커지는 원척도입니다. ND·Ct/Tt·log10 값은 자동 변환하지 않습니다.';toolbar.before(helper);p.querySelector('.settings input').placeholder='예: RFU 또는 ng/mL';}
  if(k==='loq'){helper.textContent='검체별 통계: 측정값2–1,000개.\nLoQ 후보: 4–8검체·각9개 이상·허용 총오차와 기준값 출처 등 조건 확인.\n이는 현재 지원 범위이며 시험설계 합격 기준이 아닙니다.';toolbar.after(helper);const add=p.querySelector('.add'),old=add.onclick;add.onclick=()=>{if(p.querySelectorAll('.sample').length>=8)return;old();refresh(k);};p.querySelector('.settings input').placeholder='예: copies/mL 또는 ng/mL';
   for(const [text,hidden]of [['모두 접기',true],['모두 펼치기',false]]){const b=make('button',text);b.type='button';b.onclick=()=>{for(const s of p.querySelectorAll('.sample')){s.querySelector('.sample-body').hidden=hidden;const t=s.querySelector('.sample-toggle');t.textContent=hidden?'펼치기':'접기';t.setAttribute('aria-expanded',String(!hidden));}};toolbar.append(b);}
  }
  p.addEventListener('input',()=>refresh(k));p.addEventListener('change',()=>refresh(k));p.addEventListener('click',e=>{if(e.target.closest('.add'))refresh(k);});
  const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('.sample,tr')||n.querySelector('.sample')))))refresh(k);});observer.observe(p,{childList:true,subtree:true});
  for(const hint of p.querySelectorAll('p.hint'))if(!hint.children.length)hint.textContent=hint.textContent.replace(/\. +/g,'.\n');
  refresh(k);
 }
 document.addEventListener('minimal-input-change',e=>{if(e.detail?.module)refresh(e.detail.module);});
 const transfer=document.getElementById('input-transfer');
 const previewObserver=new MutationObserver(()=>{
  const pre=transfer.querySelector('pre.transfer-preview');if(!pre||pre.dataset.ux)return;pre.dataset.ux='true';const name=transfer.querySelector('h2')?.textContent||'',isRows=name.startsWith('LoD'),isLoB=name.startsWith('LoB');if(!isRows&&!isLoB)return;
  const rows=pre.textContent.split('\n').filter(s=>s!=='').map(s=>s.split('\t')),wrap=make('div');wrap.className='input-preview-table scroll';const table=make('table'),head=make('tr');for(const text of isRows?['번호','농도','분석 대상 수 N','양성 수']:['번호','Blank 측정값']){const th=make('th',text);th.scope='col';head.append(th);}const thead=make('thead');thead.append(head);table.append(thead);const body=make('tbody');rows.slice(0,50).forEach((r,i)=>{const tr=make('tr');for(const v of [String(i+1),...r])tr.append(make('td',v));body.append(tr);});table.append(body);wrap.append(make('p',`${rows.length}행 · 원 입력 문자열${rows.length>50?' · 앞50행 표시':''}`),table);pre.before(wrap);const raw=make('details');raw.append(make('summary','전체 입력 원문'));pre.replaceWith(raw);raw.append(pre);
 });previewObserver.observe(transfer,{childList:true,subtree:true});
 return {refresh,showIssues,list};
})();
