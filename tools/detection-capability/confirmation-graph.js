/* Existing observed rates and CP intervals only; no inference is performed here. */
'use strict';
window.ConfirmationGraph=(()=>{
 const fmt=n=>String(Number(n.toPrecision(5)));
 function model(e){return {version:'confirmation-ci-graph-1',criterion:e.criterion,points:e.rows.map(r=>({concentration:r.concentration,n:r.n,positive:r.positive,rate:r.observedRate,lower:r.ci.lower,upper:r.ci.upper,status:r.criterionStatus}))};}
 function draw(canvas,input,e){const m=model(e);canvas.height=Math.max(1100,500+m.points.length*70);const c=canvas.getContext('2d'),H=canvas.height;c.fillStyle='#fff';c.fillRect(0,0,1600,H);
 const text=(s,x,y,width=1420)=>{let t=String(s);while(c.measureText(t).width>width&&t.length)t=t.slice(0,-1);if(t!==String(s))t=t.slice(0,-1)+'…';c.fillText(t,x,y);};
 c.fillStyle='#203044';c.font='bold 34px Malgun Gothic';text('LoD confirmation · 관측 검출률과 95% CI',80,70);c.font='23px Malgun Gothic';text([input.data.dataKind==='합성'?'예제 데이터 (합성)':input.data.dataKind,input.data.groupLabel].filter(Boolean).join(' · '),80,115);
 const left=410,right=1230,top=210,bottom=H-350,px=v=>left+v*(right-left),step=(bottom-top)/m.points.length;
 text('농도 / 양성 수·N',80,170,310);text('관측률 / CI / 관측률 기준',1260,170,300);
 c.font='22px Malgun Gothic';for(let i=0;i<=5;i++){const xx=px(i/5);c.strokeStyle='#e1e6ed';c.beginPath();c.moveTo(xx,top-20);c.lineTo(xx,bottom);c.stroke();c.fillStyle='#203044';c.textAlign='center';text(i*20,xx,bottom+40,130);}c.textAlign='left';
 if(m.criterion!==null){c.strokeStyle='#b8750a';c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.moveTo(px(m.criterion),top-20);c.lineTo(px(m.criterion),bottom);c.stroke();c.setLineDash([]);}
 m.points.forEach((p,i)=>{const y=top+step*(i+.5);c.fillStyle='#203044';c.font='bold 22px Malgun Gothic';text(`${fmt(p.concentration)} ${input.data.unit}`,80,y-8,300);c.font='20px Malgun Gothic';text(`양성 ${p.positive} / N ${p.n}`,80,y+20,300);
 c.strokeStyle='#536981';c.lineWidth=4;c.beginPath();c.moveTo(px(p.lower),y);c.lineTo(px(p.upper),y);for(const v of [p.lower,p.upper]){c.moveTo(px(v),y-10);c.lineTo(px(v),y+10);}c.stroke();c.fillStyle=p.status==='not_met'?'#ac572b':p.status==='met'?'#246b57':'#627285';c.beginPath();c.arc(px(p.rate),y,10,0,Math.PI*2);c.fill();
 c.fillStyle='#203044';c.font='21px Malgun Gothic';text(`${fmt(p.rate*100)}% · ${{met:'충족',not_met:'미충족',not_set:'미설정'}[p.status]}`,1260,y-8,280);c.font='19px Malgun Gothic';text(`[${fmt(p.lower*100)}, ${fmt(p.upper*100)}]%`,1260,y+20,280);});
 c.lineWidth=1;c.fillStyle='#203044';c.textAlign='center';c.font='23px Malgun Gothic';text('검출률 (%) · 선형 눈금',820,H-260,1000);c.textAlign='left';
 c.font='22px Malgun Gothic';text('● 관측률    ├─┤ 양측 95% Clopper–Pearson CI (기존 계산값)',80,H-205);text(m.criterion===null?'사전 관측률 기준 미설정 · 수치만 표시':`점선: 사전 관측률 기준 ${fmt(m.criterion*100)}% 이상 · CI 하한의 합격 판정 아님`,80,H-165);text('농도별 입력 순서 · 합산/보간 없음 · 최종 LoD/EP17 §7 자동 검증/허가 적합 판정 아님',80,H-125);
 c.font='18px Malgun Gothic';text(`${e.method.source} · R ${e.method.rVersion} · wrapper ${e.method.wrapperVersion} · ${m.version}`,80,H-85);text('원자료·독립성·시험설계 미검증 · 전체 정밀 수치·출처는 결과 표와 작업 JSON 참조',80,H-45);return m;}
 return {model,draw};
})();
