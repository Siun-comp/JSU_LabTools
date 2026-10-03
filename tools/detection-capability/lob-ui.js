'use strict';
window.LoBResults=(()=>{
 const panel=document.getElementById('lob'),aside=document.querySelector('aside'),empty=aside.querySelector('.empty');
 const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 const box=make('section','');box.id='lob-result';box.dataset.analysisResult='';box.hidden=true;box.style.overflowWrap='anywhere';empty.after(box);
 const run=panel.querySelector('button[disabled]');run.disabled=false;run.id='lob-run';run.textContent='비모수 LoB 계산';
 const hint=make('p','현재 지원: α=5%, 한 분석 집단의 Blank 측정값 60–1,000개. 값이 클수록 신호가 커지는 원척도 수치입니다. Ct/Tt·log10 값·양성/음성 건수는 대상이 아닙니다.');hint.className='hint';run.after(hint);
 let result=null,fingerprint=null;
 const current=()=>{const s=MinimalInputs.snapshot('lob');return JSON.stringify([s.raw,s.revision]);};
 const messages={LOB_INPUT:'입력 구조를 확인하세요.',LOB_ALPHA_UNSUPPORTED:'현재 LoB 계산은 α=5%만 지원합니다. 입력값을 자동 변경하지 않습니다.',LOB_UNIT:'측정 단위를 입력하세요.',LOB_SCALE_UNSUPPORTED:'Ct/Tt 계열 또는 log10 척도는 이 LoB 방법의 현재 지원 대상이 아닙니다.',LOB_COUNT_UNSUPPORTED:'현재 지원범위는 한 분석 집단의 Blank 측정값 60–1,000개입니다. 60개 충족만으로 전체 시험설계가 검증되지는 않습니다.',LOB_NONNUMERIC:'ND·미측정·범위 표기·비숫자는 숫자로 대체하지 않습니다.',LOB_RANK_UNSUPPORTED:'지원하는 정렬 순위를 벗어났습니다.',LOB_NUMERIC_RANGE:'보간 계산이 지원 수치 범위를 벗어났습니다.',LOB_ALL_EQUAL:'모든 측정값이 같습니다. 반올림·검출한계 이하 값의 대체 여부를 원기록에서 확인하세요.',LOB_INTERNAL_SIGNAL:'RFU 내부 신호의 LoB입니다. 농도 기반 성능 주장과 구분하세요.'};
 function draw(){document.dispatchEvent(new Event('analysis-result-change'));const active=document.querySelector('nav [aria-pressed="true"]').dataset.module==='lob';box.hidden=!active||!result;
  empty.hidden=[...aside.querySelectorAll('[data-analysis-result]')].some(e=>!e.hidden);if(box.hidden)return;
  box.replaceChildren();if(current()!==fingerprint){box.append(make('h3','입력 변경 · 다시 계산 필요'),make('p','이전 LoB 결과는 숨겼습니다. 현재 입력으로 다시 계산하세요.'));return;}
  const {input,calculation:c}=result;box.append(make('h3',c.status==='calculated'?'비모수 LoB · 한 분석 집단':'LoB 계산 차단'));
  for(const text of [...input.errors,...input.warnings,...c.errors.map(x=>messages[x]||x),...c.warnings.map(x=>messages[x]||x)])box.append(make('p',text));
  box.append(make('p',`${input.data.dataKind?('자료: '+input.data.dataKind+' · '):''}단위: ${input.data.unit||'미기재'}`));
  if(c.status==='calculated'){
   const value=make('h3',`LoB: ${Number(c.groupLoB.toPrecision(8))} ${c.unit}`);value.id='lob-value';box.append(value);
   box.append(make('p',`Blank 결과 수: ${c.count} · α: 5% · 백분위: 95%`));
   box.append(make('p',`순위 ${c.rank.position}: ${c.rank.lower}번째 값 ${c.rank.lowerValue}, ${c.rank.upper}번째 값 ${c.rank.upperValue}로 계산`));
   box.append(make('p','한 분석 집단의 계산값입니다. 여러 LOT의 전체 LoB·LoD 또는 합격 판정을 자동으로 확정하지 않습니다.'));
   const details=make('details','');details.append(make('summary','순위·계산 근거'));
   details.append(make('p',`${c.method.source} · 방법 버전 ${c.method.version}`));
   details.append(make('p',`h = 0.5 + ${c.count} × 0.95 = ${c.rank.position}. 위 순위 가중치 = ${c.rank.upperWeight}. 입력 순서는 유지하고 정렬된 값의 이웃 순위를 보간합니다.`));
   details.append(make('p',`반올림 전 계산값: ${c.groupLoB}`));box.append(details);
   panel.querySelector('.input-feedback').textContent=`한 집단 LoB 계산 완료`;
  }
  const source=make('details','');source.append(make('summary','분석 집단·입력 출처'));
  if(input.data.groupLabel)source.append(make('p',`집단: ${input.data.groupLabel}`));if(input.data.sourceReference)source.append(make('p',`원기록: ${input.data.sourceReference}`));
  if(input.source?.kind==='file')source.append(make('p',`파일: ${input.source.filename} · SHA-256: ${input.source.sha256}`));
  source.append(make('p','원자료·시험일·검체/LOT 구성과 시험설계 전체는 검증하지 않았습니다. 원자료는 Excel에서 관리합니다.'));box.append(source);
 }
 run.onclick=()=>{const input=MinimalInputs.snapshot('lob');fingerprint=current();const calculation=input.errors.length?{status:'blocked',groupLoB:null,overallLoB:null,errors:[],warnings:[]}:LoBAnalysis.analyze({values:input.data.values,alpha:input.data.setting,unit:input.data.unit});if(calculation.status==='calculated')calculation.method={...calculation.method,executionRuntime:'browser-javascript',applicationVersion:AppRelease.version};result={version:'minimal-lob-result-1',input,calculation};draw();};
 document.addEventListener('minimal-input-change',draw);document.addEventListener('minimal-module-change',draw);
 return {snapshot:()=>result?{...structuredClone(result),fresh:current()===fingerprint}:null};
})();
