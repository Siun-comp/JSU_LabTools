'use strict';
(()=>{
 const file=document.querySelector('#v3-file'),status=document.querySelector('#v3-status'),output=document.querySelector('#v3-output'),cell=document.querySelector('#v3-cell');let revision=0;
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 file.addEventListener('change',async()=>{
  const token=++revision;window.MinimalInputs?.cancelFile();output.replaceChildren();cell.hidden=true;cell.textContent='';const selected=file.files[0];
  if(!selected){status.textContent='파일을 선택하세요.';return;}status.textContent='읽는 중…';
  try{
   const r=await WorkbookV3Preview.read(selected);if(token!==revision)return;
   status.textContent=`읽기 완료 · ${r.filename} · ${r.dataKind} · 보완/확인 ${r.issueCount}건`;
   for(const s of r.sheets){const section=el('details','');section.className='v3-module';const countLabel=['LoD','Confirmation'].includes(s.name)?'농도 행':'측정값 입력';section.append(el('summary',`${s.name}: ${s.count} ${countLabel}${s.sampleCount===null?'':` / ${s.sampleCount}검체`} · ${s.status}`));
    const labels={LoD:'목표 검출확률',Confirmation:'사전 관측 검출률 기준',LoB:'Blank 초과확률 α',LoQ:'허용 총오차'};
    section.open=s.count>0;
    section.append(el('p',`단위: ${s.unit||'미기재'} · ${labels[s.name]}: ${s.setting===null?'미기재/확인 필요':MinimalInputs.shiftDecimal(String(s.setting),2)+'%'} · 공통 설정 ${s.settings}칸 기입`));
    section.append(el('p','아래는 원값 미리보기입니다. 숫자 형식/필수 검사만 수행하며 통계값을 계산하지 않습니다.'));
    const wrap=el('div','');wrap.className='input-preview-table scroll';const table=el('table',''),head=el('tr',''),headers=['LoD','Confirmation'].includes(s.name)?['Excel 행','농도','분석 대상 수 N','양성 수']:s.name==='LoB'?['Excel 행','Blank 측정값']:['검체','기준값','측정값 개수','원값 · Excel 셀'];
    for(const h of headers){const th=el('th',h);th.scope='col';head.append(th);}const thead=el('thead','');thead.append(head);table.append(thead);const body=el('tbody','');
    for(const row of s.preview){const tr=el('tr',''),values=row.label!==undefined?[row.label,row.reference||'[빈칸]',String(row.count),row.preview.map(c=>c.value+' ('+c.ref+')').join(' / ')]:[String(row.row),...row.preview.map(c=>c.value===''?'[빈칸]':c.value)];for(const value of values)tr.append(el('td',value));body.append(tr);}table.append(body);wrap.append(table);section.append(wrap,el('p','앞3행 또는 검체별 앞3값 미리보기입니다. 원 문자열과 Excel 행 위치를 유지합니다.'));
    const raw=el('details','');raw.append(el('summary','저장 원값 · 셀 위치'));raw.append(el('p',`설정 원값: ${s.setting===null?'미기재':s.setting+' (비율)'}`));for(const row of s.preview)raw.append(el('pre',row.preview.map(c=>`${c.ref}: ${c.value===''?'[빈칸]':c.value}`).join('\n')));section.append(raw);
    const apply=el('button',`${s.name} 입력 적용 검토`);apply.type='button';apply.disabled=!s.count||!!r.blockingBySheet[s.name]||!!r.blockingBySheet['안내'];apply.onclick=()=>MinimalInputs.offerFile(r,s.name,()=>token===revision);section.append(apply);if(apply.disabled&&s.count)section.append(el('p','보완 오류를 먼저 수정하세요. 확인 안내만 있는 경우에는 적용 전 내용을 검토할 수 있습니다.'));output.append(section);
   }
   if(r.items.length){const issues=el('details','');issues.id='v3-issues';issues.append(el('summary',`보완 위치 ${r.issueCount}건${r.issueCount>200?' · 최초 200건 표시':''}`));
    for(const i of r.items){const p=el('p',''),b=el('button',`${i.name}!${i.ref} · ${i.level}: ${i.message}`);b.type='button';b.onclick=()=>{cell.hidden=false;cell.textContent=`${i.name}!${i.ref}\n원값: ${JSON.stringify(i.raw)}\n${i.message}\nExcel에서 수정 후 파일을 다시 선택하세요. 원값은 자동 변경하지 않습니다.`;cell.focus();};p.append(b);issues.append(p);}output.append(issues);
   }
   const trace=el('details','');trace.append(el('summary','파일 근거'));trace.append(el('p',`${r.version} · SHA-256 ${r.sha256}`));output.append(trace);
  }catch(e){if(token!==revision)return;output.replaceChildren();cell.hidden=true;cell.textContent='';status.textContent='읽기 중단 · '+e.message;}
 });
})();
