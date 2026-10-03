'use strict';
window.ProjectFiles=(()=>{
 const C=ProjectFileContract,make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 let archived=Object.fromEntries(C.keys.map(k=>[k,null])),readSerial=0,savedStamp=null;
 const resultFloor=Object.fromEntries(C.keys.map(k=>[k,0]));
 const stamp=()=>JSON.stringify(MinimalInputs.exportProject());
 const bar=make('section','');bar.id='project-files';bar.setAttribute('aria-label','작업 저장 및 불러오기');
 const actions=make('div','');actions.className='actions';const save=make('button','작업 저장'),load=make('button','작업 불러오기'),file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='project-file';actions.append(save,load,file);
 const status=make('p','현재 입력은 자동 저장되지 않습니다. 작업 파일(.json)로 보관하세요.');status.className='hint';status.id='project-status';status.setAttribute('role','status');bar.append(actions,status);document.querySelector('header').append(bar);
 const dialog=make('dialog','');dialog.id='project-review';dialog.setAttribute('aria-label','작업 불러오기 확인');document.body.append(dialog);
 function build(){const results={lod:LoDRequest,confirmation:ConfirmationResults,lob:LoBResults,loq:LoQResults};return {format:'mdc-minimal-project',version:1,savedAt:new Date().toISOString(),activeModule:document.querySelector('nav button[aria-pressed=true]').dataset.module,modules:MinimalInputs.exportProject(),archivedResults:Object.fromEntries(C.keys.map(k=>{const s=results[k].snapshot();return [k,s&&s.input?.revision>=resultFloor[k]?s:archived[k]];}))};}
 save.onclick=()=>{try{const data=build(),text=JSON.stringify(data,null,2);C.parse(text);const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='MDC-work-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);savedStamp=stamp();status.textContent='작업 파일 다운로드를 요청했습니다. 다운로드 폴더에서 확인하세요. 계산 기록은 참고용이며 복원 후 다시 계산합니다.';}catch(e){status.textContent='저장 실패: '+e.message;}};
 load.onclick=()=>{file.value='';file.click();};
 file.onchange=async()=>{const selected=file.files[0],serial=++readSerial;if(dialog.open)dialog.close();if(!selected)return;const before=stamp();try{if(selected.size>C.MAX)throw Error('작업 파일은 최대 20 MB입니다.');const data=C.parse(await selected.text());if(serial!==readSerial)return;dialog.replaceChildren(make('h2','작업 불러오기'));
 dialog.append(make('p',selected.name),make('p','네 모듈의 현재 입력을 모두 교체합니다. 필요한 현재 작업은 취소 후 먼저 저장하세요. 저장된 계산 기록은 참고용으로만 보관하며 결과는 다시 계산해야 합니다.'));
 const pre=make('pre',C.keys.map(k=>{const d=data.modules[k].raw;return `${k}: 단위 ${d.unit||'미기재'} · ${d.dataKind||'자료 구분 미기재'} · ${k==='loq'?d.samples.length+' 검체':k==='lob'?(d.blank?d.blank.split(/\r?\n/).length:0)+' 입력 줄':d.rows.length+' 입력 행'}`;}).join('\n'));pre.className='transfer-preview';dialog.append(pre);
 const apply=make('button','현재 입력 교체 후 불러오기'),cancel=make('button','취소'),feedback=make('p','');cancel.onclick=()=>dialog.close();apply.onclick=()=>{if(serial!==readSerial||stamp()!==before){feedback.textContent='현재 입력이 변경되었습니다. 취소 후 파일을 다시 선택하세요.';apply.disabled=true;return;}MinimalInputs.restoreProject(data.modules);archived=structuredClone(data.archivedResults);for(const k of C.keys)resultFloor[k]=MinimalInputs.snapshot(k).revision;select(data.activeModule);savedStamp=stamp();status.textContent='입력·설정·출처를 복원했습니다. 저장된 계산 기록은 검증되지 않은 참고 기록이며, 각 모듈에서 다시 계산하세요.';dialog.close();};dialog.append(apply,cancel,feedback);dialog.showModal();
 }catch(e){if(serial===readSerial)status.textContent='불러오기 실패: '+e.message+' 현재 입력은 유지했습니다.';}};
 document.addEventListener('minimal-input-change',()=>{if(savedStamp!==null&&stamp()!==savedStamp)status.textContent='저장/복원 이후 입력이 변경되었습니다. 작업 저장을 눌러 새 파일로 보관하세요.';});
 window.addEventListener('beforeunload',e=>{if(stamp()!==savedStamp){e.preventDefault();e.returnValue='';}});savedStamp=stamp();
 return {build};
})();
