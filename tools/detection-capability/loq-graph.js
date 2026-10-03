/* Presentation of existing TE fractions only. No interpolation or estimation. */
'use strict';
window.LoQGraph=(()=>{
 const reasons={CRITERION_NOT_SET:'TE 기준 미설정',CANDIDATE_COUNT_HELD:'후보 지원 건수 미달',REFERENCE_SOURCE_MISSING:'기준값 출처 누락',NONPOSITIVE_MEAN:'비양수 평균',NONE_MET:'기준 충족 검체 없음'};
 const fmt=n=>String(Number(n.toPrecision(5)));
 function model(e){return {version:'loq-te-graph-1',unit:e.unit,limit:e.limitFraction,candidate:e.groupLoQCandidate,reasons:e.candidateReasons.map(k=>reasons[k]||k),warnings:e.warnings.map(w=>w.sampleName+': SD=0'),points:e.samples.map(s=>({name:s.sampleName,mean:s.mean,n:s.n,fraction:s.teFraction,status:s.criterionStatus}))};}
 function draw(canvas,input,e){const m=model(e),c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1600,1100);c.textAlign='left';c.lineWidth=1;c.setLineDash([]);
 const text=(s,x,y,width=1400)=>{let t=String(s);while(c.measureText(t).width>width&&t.length)t=t.slice(0,-1);if(t!==String(s))t=t.slice(0,-1)+'…';c.fillText(t,x,y);};
 c.fillStyle='#203044';c.font='bold 34px Malgun Gothic';text('LoQ · 검체별 총오차 (TE%)',80,70);c.font='23px Malgun Gothic';text([input.data.dataKind==='합성'?'예제 데이터 (합성)':input.data.dataKind,input.data.groupLabel].filter(Boolean).join(' · '),80,115);
 const left=440,right=1290,top=200,bottom=730,max=Math.max(...m.points.map(p=>p.fraction),m.limit??0)||.01,px=v=>left+(v/max)*(right-left),step=(bottom-top)/m.points.length;
 c.font='22px Malgun Gothic';for(let i=0;i<=4;i++){const v=max*(i/4),xx=px(v);c.strokeStyle='#e1e6ed';c.beginPath();c.moveTo(xx,top-25);c.lineTo(xx,bottom);c.stroke();c.fillStyle='#203044';c.textAlign='center';text(fmt(v*100),xx,bottom+40,200);}c.textAlign='left';
 c.font='22px Malgun Gothic';text('검체 / 관측 평균 / N',80,165,350);c.textAlign='center';text('총오차 TE (%) · 기준값 대비 · 선형 눈금',870,820,1000);c.textAlign='left';
 if(m.limit!==null){c.strokeStyle='#b8750a';c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.moveTo(px(m.limit),top-25);c.lineTo(px(m.limit),bottom);c.stroke();c.setLineDash([]);c.lineWidth=1;}
 m.points.forEach((p,i)=>{const y=top+step*(i+.5),xx=px(p.fraction),label={met:'충족',not_met:'미충족',not_set:'미설정'}[p.status];c.fillStyle='#203044';c.font='bold 22px Malgun Gothic';text(p.name,80,y-5,330);c.font='20px Malgun Gothic';text(`평균 ${fmt(p.mean)} ${m.unit} · N ${p.n}`,80,y+22,330);c.strokeStyle=p.status==='not_met'?'#ac572b':p.status==='met'?'#246b57':'#627285';c.lineWidth=7;c.beginPath();c.moveTo(left,y);c.lineTo(xx,y);c.stroke();c.fillStyle=c.strokeStyle;c.beginPath();c.arc(xx,y,8,0,Math.PI*2);c.fill();c.lineWidth=1;c.fillStyle='#203044';c.font='21px Malgun Gothic';text(`${fmt(p.fraction*100)}% · ${label}`,1320,y+7,230);});
 c.fillStyle='#203044';c.font='22px Malgun Gothic';text(m.limit===null?'사전 TE 기준 미설정 · 검체별 수치만 표시':`점선: 사전 TE 기준 ${fmt(m.limit*100)}% 이하 · 기준 비교는 반올림 전 계산값 사용`,80,870);
 text(m.candidate===null?'집단 LoQ 후보 보류: '+m.reasons.join(' / '):`입력 집단 LoQ 후보: ${fmt(m.candidate)} ${m.unit} · 시험설계 미검증`,80,915);
 text('검체는 입력 순서로 표시 · 연결/보간/외삽 없음 · 전체 LOT/더 낮은 농도/허가 적합 판정 아님',80,955);
 c.font='18px Malgun Gothic';text(`${e.method.source} · R ${e.method.rVersion} · wrapper ${e.method.wrapperVersion} · ${m.version}`,80,1000);text(m.warnings.length?`경고: SD=0인 검체 ${m.warnings.length}개 · 반올림/대체값 여부 확인 필요 · 해당 검체는 결과 표 참조`:'원자료·독립 검체·다일/LOT 구성은 검증하지 않았습니다.',80,1035);text('전체 검체명·정밀 수치·출처·보류 사유는 결과 표와 작업 JSON을 함께 보관하세요.',80,1070);
 return m;}
 return {model,draw};
})();
