/* Output adapter only: no new statistical estimation. */
'use strict';
window.ResultExport=(()=>{
 const apis={lod:LoDRequest,confirmation:ConfirmationResults,lob:LoBResults,loq:LoQResults},aside=document.querySelector('aside');
 const [tableButton,graphButton]=aside.querySelector('.actions').querySelectorAll('button');
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const detailButton=make('button','상세 계산 기록 복사');detailButton.id='copy-details';aside.querySelector('.actions').append(detailButton);
 const excelButton=make('button','Excel 결과서 저장');excelButton.id='export-xlsx';aside.querySelector('.actions').append(excelButton);
 const excelReady=()=>!!window.BrowserExcel&&!!window.JSZip;
 excelButton.title='브라우저 안에서 3시트 Excel 결과서를 생성합니다. 분석 데이터를 업로드하지 않습니다.';
 function reportPayload(x){
  const d=x.s.input.data,input=[['단위',d.unit],['설정 (fraction)',d.setting],...(d.dataKind?[['자료 구분',d.dataKind]]:[]),...(d.groupLabel?[['분석 이름',d.groupLabel]]:[]),...(d.sourceReference?[['원기록',d.sourceReference]]:[]),[]];
  if(x.k==='lod'||x.k==='confirmation'){input.push(['농도','N','양성']);d.rows.forEach(r=>input.push([r.concentration,r.n,r.positive]));}
  if(x.k==='lob'){input.push(['입력 순번','Blank 측정값']);d.values.forEach((v,i)=>input.push([i+1,v]));}
  if(x.k==='loq')for(const sample of d.samples){input.push(['검체',sample.sampleName],['기준값',sample.referenceValue],['기준값 출처',sample.referenceSource],[],['입력 순번','반복 측정값']);sample.values.forEach((v,i)=>input.push([i+1,v]));input.push([]);}
  if(graphReady(x))graph(x);
  return {version:'excel-report-1',module:x.k,summary:summaryRows(x),input,details:[...rows(x),[],['결과서 생성 방식','브라우저 내 생성 · 분석 입력 업로드 없음'],['결과서 작성기 버전',BrowserExcel.version],['결과서 생성 프로그램 버전',AppRelease.version],['개발·배포',AppRelease.developer]],graph:graphReady(x)?canvas.toDataURL('image/png'):null};
 }
 excelButton.onclick=async()=>{
  const x=get();if(!x||busy||!excelReady())return;const fp=fingerprint(x);busy=true;refresh();status.textContent='Excel 결과서를 생성하고 있습니다…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{const blob=await BrowserExcel.generate(reportPayload(x),{signal:controller.signal,onProgress:()=>{if(!current(fp))controller.abort();}});if(!current(fp))throw Error('stale');
   const url=URL.createObjectURL(blob),a=make('a','');a.href=url;a.download=x.k+'-분석결과.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Excel 결과서를 저장했습니다. 입력을 수정해도 파일 안에서 통계가 재계산되지는 않습니다.';
  }catch{status.textContent=current(fp)?'Excel 생성에 실패했습니다. 다시 시도하세요. 반복되면 작업 JSON을 저장하고 페이지를 새로고침하세요.':'입력이 변경되어 이전 결과의 파일 저장을 중단했습니다. 다시 계산하세요.';}finally{clearTimeout(timer);busy=false;refresh();}
 };
 const status=make('p','계산 완료 후 결과 표와 LoD 그래프를 복사할 수 있습니다.');status.id='export-status';status.className='hint';status.setAttribute('role','status');aside.querySelector('.actions').after(status);
 const plot=make('details','');plot.id='export-plot';plot.hidden=true;plot.open=true;plot.append(make('summary','LoD 그래프 미리보기'));const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1100;canvas.style.width='100%';canvas.style.height='auto';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','LoD 시험 농도별 관측 검출률과 적합률, 농도 log10 눈금');plot.append(canvas);status.after(plot);
 const outputDetails=make('details','');outputDetails.id='export-details';outputDetails.hidden=true;plot.after(outputDetails);
 function showDetails(x){
  outputDetails.hidden=!x;
  if(!x){outputDetails.replaceChildren();return;}
  outputDetails.replaceChildren(make('summary','상세 계산 기록'));
  const t=make('table',''),body=make('tbody','');t.setAttribute('aria-label','출처와 계산 방법 상세');
  for(const row of rows(x)){if(!row.length)break;if(row.length!==2)continue;const tr=make('tr','');for(const value of row)tr.append(make('td',String(value)));body.append(tr);}
  t.append(body);outputDetails.append(t);
 }
 const fallback=make('dialog','');fallback.id='export-fallback';fallback.setAttribute('aria-label','복사 대안');document.body.append(fallback);
 const active=()=>document.querySelector('nav [aria-pressed="true"]').dataset.module;
 function get(){const k=active(),s=apis[k].snapshot(),e=k==='lob'?s?.calculation:s?.execution;if(!s?.fresh||s.pending||s.error||s.executionError||s.input.errors.length||s.errors?.length||!e||e.status!==(k==='lod'?'candidate':'calculated'))return null;return {k,s,e};}
 const fingerprint=x=>JSON.stringify([x.k,x.s.input.raw,x.s.input.revision,x.e]);
 function current(fp){const x=get();return !!x&&fingerprint(x)===fp;}
 function graphReady(x){if(x?.k==='lob')return x.s.input.data.values.length>=60&&x.s.input.data.values.length<=1000;if(x?.k==='confirmation')return x.e.rows.length>0&&x.e.rows.length<=20;if(x?.k==='loq')return x.e.samples.length>0&&x.e.samples.every(s=>Number.isFinite(s.teFraction*100)&&s.teFraction>=0);if(x?.k!=='lod')return false;const logs=x.s.observations.map(r=>Math.log10(r.concentration));return Math.max(...logs)>Math.min(...logs)&&logs.every(Number.isFinite)&&x.e.fittedProbability.every(p=>p>=0&&p<=1);}
 const criterion=s=>({met:'충족',not_met:'미충족',not_set:'미설정'}[s]||s);
 function sourceSummary(source){if(!source)return '직접 입력';const list=[];for(let p=source;p;p=p.previous){list.push(p.kind==='file'?`파일 ${p.filename} · ${p.version} · ${p.sheet} · SHA-256 ${p.sha256}`:p.kind==='unit-conversion'?`단위 변환 ${p.fromUnit} → ${p.toUnit} ×10^${p.power} (${p.version})`:p.kind==='paste'?'Excel 붙여넣기':'출처 상세는 작업 JSON 참조');if(list.length>=64)break;}return list.join(' ← ');}
 const fieldNames={id:'방법 ID',source:'근거',wrapperVersion:'계산 연결 버전',link:'연결 함수',scale:'척도',epsilon:'수렴 허용값',maxit:'최대 반복 수',target:'목표확률 (fraction)',rVersion:'R 버전',statsVersion:'stats 버전',version:'버전',status:'상태',reasons:'미제공 사유',warnings:'경고',confidence:'신뢰수준 (fraction)',sidedness:'측수',approximationAssessment:'근사 적용성',logEstimate:'log10 추정값',logSE:'log10 표준오차',logLower:'log10 하한',logUpper:'log10 상한',lower:'하한',upper:'상한',method:'방법',dispersion:'분산계수',covariance:'공분산 계산',massVersion:'MASS 버전',executionRuntime:'실행 위치',webRVersion:'webR 버전',channelType:'통신 방식',sourceSHA256:'계산 원본 SHA-256',applicationVersion:'계산 당시 프로그램 버전',pearsonP:'Pearson 근사 p값',devianceP:'Deviance 근사 p값',pearsonPerDF:'Pearson/자유도',minExpectedPositive:'최소 기대 양성',minExpectedNegative:'최소 기대 음성',smallExpectedRows:'기대수 5 미만 분석 행 순번',dispersionRatio:'분산비 계산',smallExpectedReference:'작은 기대수 참고값',assessment:'검토 상태',ciDispersion:'현재 CI 분산계수',rowIndexBasis:'행 번호 기준',devianceRoundoffTolerance:'Deviance 수치오차 확인 범위'};
 // Display adapter only. Machine-readable precision and provenance stay in project JSON.
 function readable(label,value){
  if(value===null||value===undefined)return [[label,'미제공']];
  if(Array.isArray(value))return value.length?value.flatMap((v,i)=>readable(label+' '+(i+1),v)):[[label,'없음']];
  if(typeof value==='object')return Object.entries(value).flatMap(([k,v])=>readable(label+' · '+(fieldNames[k]||k),v));
  return [[label,value]];
 }
 function rows(x){const {k,s,e}=x,d=s.input.data;const out=[['분석',k],['결과 범위','한 분석 집단 · 원자료/시험설계/허가 적합성 미검증'],['자료 구분',d.dataKind||'미기재'],['단위',d.unit],['집단',d.groupLabel||'미기재'],['원기록',d.sourceReference||'미기재'],['입력 revision',s.input.revision],['설정 (fraction)',d.setting??'미설정'],...readable('계산 방법·버전',e.method),['출력 버전','minimal-export-4'],...readable('입력 경고',s.input.warnings),['출처 정보',sourceSummary(s.input.source)],['출처 적용 후 편집',s.input.modifiedSinceSource?'예':'아니오']];
 if(k==='lod'){out.push(['CI 하한',e.ci.lower??'미제공'],['CI 상한',e.ci.upper??'미제공'],['CI 신뢰수준',e.ci.confidence],['LoD 모형 후보값 (최종 LoD 아님)',e.modelDoseCandidate],['제한','적합도/근사 적용성 검토 전 · 최종 LoD 미확정'],['CI 상태',e.ci.status],['CI 설명',LoDCIContract.describe(e.ci)],...readable('CI',e.ci),...readable('진단 경고',e.diagnostics),['Deviance',e.deviance],['Pearson',e.pearson],['잔차 자유도',e.residualDF],...readable('적합도 진단',e.gof),['적합도 해석','카이제곱 근사 p값·Pearson/자유도는 검토용. 기대수가 작으면 근사가 부정확할 수 있습니다. 자동 판정/CI 분산 보정 없음. 기대수 5는 참고값.'],['절편',e.coefficients[0]],['기울기',e.coefficients[1]],[],['농도','N','양성','음성','관측률 (fraction)','적합률 (fraction)','기대 양성','기대 음성']);s.observations.forEach((r,i)=>out.push([r.concentration,r.n,r.positive,r.negative,r.observedRate,e.fittedProbability[i],e.expectedPositive[i],e.expectedNegative[i]]));}
 if(k==='confirmation'){out.push(['제한','관측률 기준 비교 · CI 하한 기준 판정/최종 LoD/EP17 §7 자동 검증 아님'],[],['농도','N','양성','음성','관측률 (fraction)','양측95% CI 하한','양측95% CI 상한','사전 관측률 기준']);e.rows.forEach(r=>out.push([r.concentration,r.n,r.positive,r.negative,r.observedRate,r.ci.lower,r.ci.upper,criterion(r.criterionStatus)]));}
 if(k==='lob'){out.push(['집단 LoB',e.groupLoB],['제한','전체 LOT LoB/LoD 또는 합격 판정 아님'],['Blank N',e.count],...readable('순위 근거',e.rank),...readable('경고',e.warnings),[],['입력 순번','Blank 측정값']);d.values.forEach((v,i)=>out.push([i+1,v]));}
 if(k==='loq'){out.push(['집단 LoQ 후보',e.groupLoQCandidate??'보류'],...readable('후보 보류 사유',e.candidateReasons),...readable('기여 검체',e.candidateSamples),...readable('경고',e.warnings),['제한','TE=|평균−기준값|+2SD · 통과 검체의 최저 관측 평균 후보 · 전체 LOT/더 낮은 농도/LoD 관계 미평가'],[],['검체','N','기준값','평균','SD','bias','TE','TE/기준값 (fraction)','기준 비교','기준값 출처']);e.samples.forEach(r=>out.push([r.sampleName,r.n,r.referenceValue,r.mean,r.sd,r.bias,r.te,r.teFraction,criterion(r.criterionStatus),r.referenceSource]));}
 if(k==='lod')out.push(['곡선 표시',e.curve?'동일 R 모형 예측확률 · 시험 범위 내 log10 등간격201점 · 확률곡선 SE/band 미계산':'예측 곡선 미제공 · 시험 농도별 적합률 점만 표시'],['곡선 버전',e.curve?.version||'없음']);
 out.push([],['출력 안내','중간 반올림 없음. Excel 숫자 정밀도/표시 서식은 Excel 설정에 따릅니다. 텍스트 탭·줄바꿈은 \\t·\\n으로 표시하고 수식 시작 문자는 텍스트로 보호합니다. 원문은 작업 JSON에 보존됩니다.']);return out;}
 function cell(v){if(typeof v==='number'){if(!Number.isFinite(v))throw Error('비유한 출력 수치');return String(v);}let t=String(v??'').replace(/\t/g,'\\t').replace(/\r\n|\r|\n/g,'\\n');if(/^\s*[=+@-]/.test(t))t="'"+t;return t.replace(/"/g,'""').includes('"')?'"'+t.replace(/"/g,'""')+'"':t;}
 function summaryRows(x){
  const all=rows(x),out=[],omit=/^(입력 revision|출력 버전|출처 정보|출처 적용 후 편집|계산 방법·버전|CI ·|CI 상태|CI 신뢰수준|Deviance|Pearson|잔차 자유도|절편|기울기|순위 근거|곡선 버전|출력 안내|결과 범위)$/;
  for(const row of all){
   if(!row.length){out.push(row);continue;}
   if(row.length>2||typeof row[0]==='number'){out.push(row);continue;}
   if(x.k==='lob'&&row[0]==='입력 순번')break;
   if(omit.test(row[0])||row[0].startsWith('계산 방법·버전 ·')||row[0].startsWith('CI ·')||row[0].startsWith('순위 근거 ·'))continue;
   if(row.length===2&&['미기재','없음'].includes(row[1]))continue;
   if(row[0]==='설정 (fraction)'){out.push(['설정 (%)',typeof row[1]==='number'?row[1]*100:row[1]]);continue;}
   out.push(row);
  }
  out.push([],['계산 방법',x.e.method.id],['방법 근거',x.e.method.source]);
  return out;
 }
 const encode=rs=>rs.map(r=>r.map(cell).join('\t')).join('\r\n');
 const summaryTSV=x=>encode(summaryRows(x));
 const tsv=x=>rows(x).map(r=>r.map(cell).join('\t')).join('\r\n');
 const short=(v,n=70)=>String(v).length>n?String(v).slice(0,n-1)+'…':String(v);
 function graph(x){const r=graphBase(x);let p=x.s.input.source,converted=false;for(let i=0;p&&i<64;i++,p=p.previous)if(p.kind==='unit-conversion')converted=true;if(converted){const c=canvas.getContext('2d');c.fillStyle='#203044';c.font='20px Malgun Gothic';c.fillText('단위 환산 적용 · 전체 변환 이력은 결과 표/작업 JSON 참조',100,155);}return r;}
 function graphBase(x){canvas.height=1100;if(x.k==='lob'){plot.querySelector('summary').textContent='LoB 그래프 미리보기';canvas.setAttribute('aria-label','크기순 Blank 측정값과 계산된 집단 LoB 위치');return LoBGraph.draw(canvas,x.s.input,x.e);}if(x.k==='confirmation'){plot.querySelector('summary').textContent='LoD 검출률 확인 그래프 미리보기';canvas.setAttribute('aria-label','농도별 관측 검출률과 양측95% Clopper–Pearson 신뢰구간');return ConfirmationGraph.draw(canvas,x.s.input,x.e);}plot.querySelector('summary').textContent=x.k==='loq'?'LoQ 그래프 미리보기':'LoD 그래프 미리보기';canvas.setAttribute('aria-label',x.k==='loq'?'검체별 총오차 TE%, 기준값 대비 선형 눈금':'LoD 시험 농도별 관측 검출률과 적합률, 농도 log10 눈금');if(x.k==='loq')return LoQGraph.draw(canvas,x.s.input,x.e);const {s,e}=x,c=canvas.getContext('2d'),W=1600,H=1190;canvas.height=H; c.fillStyle='#fff';c.fillRect(0,0,W,H);c.fillStyle='#203044';c.font='bold 34px Malgun Gothic';c.fillText('LoD · 시험 농도별 관측률 / 적합률',100,70);c.font='23px Malgun Gothic';c.fillText(short([s.input.data.dataKind==='합성'?'예제 데이터 (합성)':s.input.data.dataKind,s.input.data.groupLabel].filter(Boolean).join(' · '),95),100,115);
 const pts=s.observations.map((r,i)=>({...r,fitted:e.fittedProbability[i]})).sort((a,b)=>a.concentration-b.concentration),logs=pts.map(r=>Math.log10(r.concentration)),lo=Math.min(...logs),hi=Math.max(...logs),left=160,right=1480,top=185,bottom=765;
 const px=v=>left+(Math.log10(v)-lo)/(hi-lo)*(right-left),py=v=>bottom-v*(bottom-top);
 c.font='23px Malgun Gothic';for(let j=0;j<=5;j++){const y=py(j/5);c.strokeStyle='#e1e6ed';c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillStyle='#203044';c.fillText(String(j*20),95,y+8);}c.strokeStyle='#617286';c.strokeRect(left,top,right-left,bottom-top);
 // Log tick positions, labels expressed in original concentration units.
 const tickValues=pts.length<=8?pts.map(r=>r.concentration):Array.from({length:5},(_,j)=>Math.pow(10,lo+(hi-lo)*j/4));let last=-Infinity;for(const v of tickValues){const xx=px(v);if(xx-last<130)continue;last=xx;c.fillStyle='#203044';c.textAlign='center';c.fillText(Number(v.toPrecision(4)).toString(),xx,bottom+40);}c.textAlign='left';
 c.save();c.translate(48,560);c.rotate(-Math.PI/2);c.fillText('검출률 (%)',0,0);c.restore();c.textAlign='center';c.fillText(short(`농도 (${s.input.data.unit}) · log10 눈금`,85),820,855);c.textAlign='left';
 c.strokeStyle='#b8750a';c.setLineDash([10,8]);c.beginPath();c.moveTo(left,py(s.input.data.setting));c.lineTo(right,py(s.input.data.setting));c.stroke();c.setLineDash([]);
 if(e.curve){c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();c.strokeStyle='#183653';c.lineWidth=4;c.beginPath();e.curve.logConcentration.forEach((v,i)=>{const xx=left+(v-lo)/(hi-lo)*(right-left),yy=py(e.curve.probability[i]);if(i===0)c.moveTo(xx,yy);else c.lineTo(xx,yy);});c.stroke();c.restore();}
 for(const r of pts){c.fillStyle='#183653';c.fillRect(px(r.concentration)-7,py(r.fitted)-7,14,14);c.strokeStyle='#172a3d';c.lineWidth=3;c.beginPath();c.arc(px(r.concentration),py(r.observedRate),10,0,Math.PI*2);c.stroke();}c.lineWidth=1;
 c.font='22px Malgun Gothic';c.fillStyle='#203044';c.fillText('○ 관측률    ■ 적합률    '+(e.curve?'━ Probit 곡선 (시험 범위 내)':'곡선 미제공')+'    ┄ 목표 '+s.input.raw.setting+'%',100,905);
 c.fillText(short(`모형 후보값: ${Number(e.modelDoseCandidate.toPrecision(7))} ${s.input.data.unit} · 적합도 검토 전`,108),100,950);
 c.fillText(short(LoDCIContract.describe(e.ci)+(e.ci.status==='calculated'?' '+s.input.data.unit:''),110),100,1030);
 c.fillText('최종 LoD·허가 적합 판정 아님 · 근사 적용성/원자료/시험설계 미검증'+(e.diagnostics.includes('EXTRAPOLATED')?' · 후보 외삽':''),100,990);
 c.font='18px Malgun Gothic';c.fillText(short(`${e.method.source} · R ${e.method.rVersion} · wrapper ${e.method.wrapperVersion}`,125),100,1070);c.fillText(short(`진단: ${e.diagnostics.join(', ')||'별도 실행 경고 없음'} · 전체 입력/정밀 수치/출처는 결과 표와 작업 JSON 참조`,125),100,1105);
 c.fillText(e.ci.warnings.length?'CI 끝점은 시험 범위 밖을 포함합니다. 전체 구간 표시.':'CI는 농도 추정 구간이며 확률곡선 band가 아닙니다.',100,1145);
 }
 let signature=null,busy=false;
 function refresh(){const x=get(),fp=x?fingerprint(x):null;if(fp!==signature){signature=fp;showDetails(x);status.textContent=x?(x.k==='lod'?(x.e.curve?'LoD 곡선은 동일 R 모형의 시험 범위 내 예측입니다. 농도 근사 CI 상태는 아래 별도로 표시합니다.':'예측 곡선이 없어 시험 농도의 점만 표시합니다. 로컬 서버 업데이트 후 다시 계산하세요.'):x.k==='confirmation'?(x.e.rows.length>20?'그래프는 가독성을 위해 최대20농도까지 지원합니다. 전체 결과는 표로 복사하세요.':'점은 관측률, 구간은 양측95% CI입니다. 기준 비교는 관측률에만 적용합니다.'):x.k==='loq'?'LoQ 그래프는 검체별 TE%와 사전 기준만 표시합니다. 검체 사이를 보간하지 않습니다.':'LoB 그래프는 측정값을 크기순으로 표시합니다. 점선은 이미 계산된 집단 LoB입니다.'):'현재 계산 결과가 없습니다. 입력 변경·불러오기 후에는 다시 계산하세요.';if(fallback.open)fallback.close();}
 tableButton.disabled=!x||busy;detailButton.disabled=!x||busy;excelButton.disabled=!x||busy||!excelReady();graphButton.disabled=!graphReady(x)||busy;plot.hidden=!graphReady(x);if(graphReady(x)&&canvas.dataset.fp!==fp){graph(x);canvas.dataset.fp=fp;}}
 function alternative(text,blob,fp){if(!current(fp))return;fallback.replaceChildren(make('h2','클립보드 접근을 허용하지 않았습니다'),make('p','권한을 허용하고 다시 시도하거나 아래 대안을 사용하세요.'));
 if(text!==null){const area=document.createElement('textarea');area.readOnly=true;area.value=text;area.setAttribute('aria-label','직접 복사할 결과 표');fallback.append(area);area.onclick=()=>area.select();fallback.append(make('p','표를 선택한 뒤 Ctrl+C로 복사하세요.'));}
 if(blob){const b=make('button','그래프 PNG 저장');b.onclick=()=>{if(!current(fp)){fallback.close();return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=active()==='lob'?'LoB-graph.png':active()==='confirmation'?'LoD-confirmation-graph.png':active()==='loq'?'LoQ-graph.png':'LoD-graph.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};fallback.append(b);}
 const close=make('button','닫기');close.onclick=()=>fallback.close();fallback.append(close);fallback.showModal();}
 async function copy(kind){const x=get();if(!x||busy||(kind==='graph'&&!graphReady(x)))return;const fp=fingerprint(x);busy=true;refresh();let text=null,blob=null;
 try{if(kind!=='graph'){text=kind==='detail'?tsv(x):summaryTSV(x);if(!current(fp))throw Error('stale');await navigator.clipboard.writeText(text);}else{graph(x);blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 생성 실패')),'image/png'));if(!current(fp))throw Error('stale');await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);}status.textContent=current(fp)?(kind==='graph'?'그래프만 PNG로 복사했습니다. Excel에서 붙여넣으세요.':kind==='detail'?'상세 계산 기록을 복사했습니다.':'결과 표를 복사했습니다. Excel에서 붙여넣으세요.'):'복사 중 입력이 변경되었습니다. 클립보드의 이전 결과를 사용하지 말고 다시 계산·복사하세요.';
 }catch(e){if(current(fp)){status.textContent='복사하지 못했습니다. 권한 또는 브라우저 지원을 확인하세요.';alternative(text,blob,fp);}else status.textContent='입력이 변경되어 복사를 중단했습니다. 다시 계산하세요.';}finally{busy=false;refresh();}}
 detailButton.onclick=()=>copy('detail');tableButton.onclick=()=>copy('table');graphButton.onclick=()=>copy('graph');
 for(const event of ['minimal-input-change','minimal-module-change','analysis-result-change'])document.addEventListener(event,()=>queueMicrotask(refresh));
 refresh();return {reportPayload:()=>{const x=get();return x?reportPayload(x):null;},snapshot:()=>{const x=get();return x?{module:x.k,tsv:summaryTSV(x),detailTSV:tsv(x),summaryRows:summaryRows(x),graphAvailable:graphReady(x)}:null;},cell};
})();
