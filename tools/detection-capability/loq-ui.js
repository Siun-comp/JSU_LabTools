'use strict';
window.LoQResults=(()=>{
 const panel=document.getElementById('loq'),aside=document.querySelector('aside'),empty=aside.querySelector('.empty'),make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const box=make('section','');box.id='loq-result';box.dataset.analysisResult='';box.hidden=true;box.style.overflowWrap='anywhere';empty.after(box);
 const run=panel.querySelector('button[disabled]');run.id='loq-run';run.textContent='총오차·LoQ 후보 계산';
 const available=['http:','https:'].includes(location.protocol);run.disabled=!available;
 const stop=make('button','계산 취소');stop.id='loq-cancel';stop.hidden=true;run.after(stop);
 const hint=make('p',available?'브라우저에서 원척도 정량값으로 검체별 총오차를 계산합니다. 여러 날짜의 반복값은 같은 검체에, 다른 LOT는 별도 분석으로 정리하세요. TE 목표는 선택 입력입니다.':'파일 모드에서는 입력 확인만 가능합니다. HTTP/HTTPS 페이지에서 계산하세요.');hint.className='hint';stop.after(hint);
 const messages={LOQ_INPUT:'지원하는 입력 구조를 확인하세요.',LOQ_UNIT:'단위를 입력하세요(최대80자).',LOQ_SCALE:'Ct/Tt·RFU 내부 신호·log10 척도는 현재 정량 농도 LoQ 지원 대상이 아닙니다.',LOQ_LIMIT:'허용 총오차는 양수 % 또는 빈칸으로 입력하세요.',LOQ_SAMPLES:'현재1–8검체를 지원합니다.',LOQ_NAME:'검체 이름의 누락·중복·길이(최대256자)를 확인하세요.',LOQ_REFERENCE:'양의 기준값과 기준값 출처의 형식(최대2,000자)을 확인하세요.',LOQ_COUNT:'검체별 측정값2–1,000개를 지원합니다.',LOQ_VALUES:'숫자 측정값만 입력하세요. ND·미측정은0으로 대체하지 않습니다.',CRITERION_NOT_SET:'TE 기준 미설정: 수치만 제공하고 LoQ 후보는 제시하지 않습니다.',CANDIDATE_COUNT_HELD:'후보의 첫 지원 범위는4검체 이상·각9결과 이상입니다. 현재는 검체별 수치만 제공합니다. 이 건수만으로 시험설계가 검증되지는 않습니다.',REFERENCE_SOURCE_MISSING:'기준값 출처 미기재: TE 계산은 제공하되 집단 후보는 보류합니다.',NONPOSITIVE_MEAN:'비양수 평균이 있어 양의 농도 LoQ 후보는 보류합니다.',NONE_MET:'TE 기준을 충족한 검체가 없습니다. 더 높은 trial 농도에서 추가 평가를 검토하세요. 외삽 후보는 만들지 않습니다.'};
 let result=null,fingerprint=null,serial=0,controller=null;
 const current=()=>{const s=MinimalInputs.snapshot('loq');return JSON.stringify([s.raw,s.revision]);};
 function build(input){const q={unit:input.data.unit,limitFraction:input.data.setting,samples:input.data.samples},errors=[...input.errors];if(!errors.length)errors.push(...LoQContract.validate(q).map(c=>messages[c]||c));return {input,errors,request:errors.length?null:q};}
 const fmt=n=>String(Number(n.toPrecision(7))),percent=n=>fmt(n*100);
 function draw(){document.dispatchEvent(new Event('analysis-result-change'));const active=document.querySelector('nav [aria-pressed="true"]').dataset.module==='loq';box.hidden=!active||!result;empty.hidden=[...aside.querySelectorAll('[data-analysis-result]')].some(e=>!e.hidden);if(box.hidden)return;
  box.replaceChildren();if(current()!==fingerprint){box.append(make('h3','입력 변경 · 다시 계산 필요'),make('p','이전 총오차·LoQ 후보·기준 판정은 숨겼습니다.'));return;}
  box.append(make('h3','LoQ · 검체별 총오차'));
  for(const text of [...result.errors,...result.input.warnings])box.append(make('p',text));if(result.pending)box.append(make('p',result.progress||'브라우저 계산 중…'));
  if(result.error){const e=make('p',result.error);e.setAttribute('role','alert');box.append(e);}
  const d=result.input.data;box.append(make('p',`${d.dataKind?('자료: '+d.dataKind+' · '):''}단위: ${d.unit||'미기재'}`));
  if(result.execution){const e=result.execution;panel.querySelector('.input-feedback').textContent=`검체별 총오차 계산 완료`;
   const candidate=make('h3',e.groupLoQCandidate===null?'LoQ 후보 미제공':`입력 집단의 LoQ 후보: ${fmt(e.groupLoQCandidate)} ${e.unit}`);candidate.id='loq-candidate';box.append(candidate);
   if(e.groupLoQCandidate!==null)box.append(make('p',`기여 검체: ${e.candidateSamples.join(', ')} · 통과 검체의 최저 관측 평균 · 시험설계 미검증`));
   for(const c of e.candidateReasons)box.append(make('p',messages[c]||c));
   box.append(make('p',`TE 기준: ${e.limitFraction===null?'미설정':percent(e.limitFraction)+'% 이하 (기준값 대비)'} · 반올림 전 값 비교`));
   const wrap=make('div','');wrap.className='scroll';const table=make('table','');table.id='loq-summary';table.setAttribute('aria-label','LoQ 검체별 결과');const head=make('thead',''),tr=make('tr','');for(const title of ['검체','평균','TE (%)','기준']){const th=make('th',title);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=make('tbody','');
   for(const s of e.samples){const row=make('tr','');for(const text of [s.sampleName,String(Number(s.mean.toPrecision(4))),String(Number((s.teFraction*100).toPrecision(4))),{met:'충족',not_met:'미충족',not_set:'미설정'}[s.criterionStatus]])row.append(make('td',text));body.append(row);}table.append(body);wrap.append(table);box.append(wrap);
   box.append(make('p','TE = |평균 − 기준값| + 2 × SD. 더 낮은 농도까지 검증한 결과가 아닙니다. 원자료·독립 검체·다일·LOT 구성과 시험설계/허가 적합성은 검증하지 않았습니다.'));
   const details=make('details','');details.append(make('summary','N·기준값·SD·bias·원값 / 계산 근거'));
   for(const s of e.samples){details.append(make('h3',s.sampleName),make('p',`N ${s.n} · 기준값 ${s.referenceValue} · 평균 ${s.mean} · SD ${s.sd} · bias ${s.bias} · TE ${s.te} · TE/기준값 ${s.teFraction}`),make('p',`기준값 출처: ${s.referenceSource||'미기재'}`));}
   for(const w of e.warnings)details.append(make('p',`${w.sampleName}: SD=0. 반올림/대체값 여부를 원기록에서 확인하세요.`));
   details.append(make('p',`${e.method.source} · ${e.method.id} / ${e.method.wrapperVersion} · R ${e.method.rVersion} · stats ${e.method.statsVersion}`));if(d.groupLabel)details.append(make('p',`집단: ${d.groupLabel}`));if(d.sourceReference)details.append(make('p',`원기록: ${d.sourceReference}`));
   details.append(make('p',`브라우저 webR ${e.method.webRVersion} · 프로그램 ${e.method.applicationVersion}`));
   details.append(make('p','원값의 정밀도를 유지합니다. EP17 Table D6 인쇄 중간값의 반올림 차이를 맞추기 위한 보정을 적용하지 않습니다. 전체 LOT LoQ 및 LoD와의 관계는 미평가입니다.'));
   if(result.input.source?.kind==='file')details.append(make('p',`파일: ${result.input.source.filename} · SHA-256: ${result.input.source.sha256}`));box.append(details);
  }
 }
 function cancel(){serial++;controller?.abort();controller=null;run.disabled=!available;stop.hidden=true;}
 stop.onclick=()=>{cancel();if(result){result.pending=false;result.error='계산을 취소했습니다. 다시 실행할 수 있습니다.';}draw();};
 run.onclick=async()=>{cancel();result=build(MinimalInputs.snapshot('loq'));fingerprint=current();if(!result.request){draw();return;}
  const id=serial,fp=fingerprint,q=result.request;controller=new AbortController();const signal=controller.signal;result.pending=true;run.disabled=true;stop.hidden=false;draw();
  try{const e=await BrowserContinuous.run('loq',q,{signal,onProgress:text=>{if(id===serial&&current()===fp){result.progress=text;draw();}}});if(id!==serial||current()!==fp)return;if(!LoQContract.validResponse(e,q))throw Error('invalid_response');result.execution=e;}
  catch(e){if(id===serial&&current()===fp)result.error=BrowserRRuntime.message(e);}
  finally{if(id===serial){result.pending=false;controller=null;run.disabled=!available;stop.hidden=true;draw();}}
 };
 document.addEventListener('minimal-input-change',()=>{if(result&&current()!==fingerprint){cancel();result.pending=false;}draw();});document.addEventListener('minimal-module-change',draw);
 return {build,snapshot:()=>result?{...structuredClone(result),fresh:current()===fingerprint}:null};
})();
