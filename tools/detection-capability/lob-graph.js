/* Sorted raw-value display; LoB and rank are read from the existing result. */
'use strict';
window.LoBGraph=(()=>{
 const fmt=n=>String(Number(n.toPrecision(5)));
 function model(input,e){return {version:'lob-rank-graph-1',lob:e.groupLoB,rank:structuredClone(e.rank),warnings:[...e.warnings],points:input.data.values.map((value,i)=>({value,inputRow:i+1})).sort((a,b)=>a.value-b.value)};}
 function draw(canvas,input,e){const m=model(input,e),c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1600,1100);c.fillStyle='#203044';c.font='bold 34px Malgun Gothic';
 const text=(s,x,y,width=1420)=>{let t=String(s);while(c.measureText(t).width>width&&t.length)t=t.slice(0,-1);if(t!==String(s))t=t.slice(0,-1)+'…';c.fillText(t,x,y);};
 text('LoB · Blank 측정값 분포 (크기순)',80,70);c.font='23px Malgun Gothic';text([input.data.dataKind==='합성'?'예제 데이터 (합성)':input.data.dataKind,input.data.groupLabel].filter(Boolean).join(' · '),80,115);
 const left=180,right=1490,top=200,bottom=750,lo=m.points[0].value,hi=m.points.at(-1).value,scale=Math.max(Math.abs(lo),Math.abs(hi))||1,a=lo/scale,b=hi/scale,px=rank=>left+(rank-1)/(m.points.length-1)*(right-left),py=v=>a===b?(top+bottom)/2:bottom-(v/scale-a)/(b-a)*(bottom-top);
 c.font='22px Malgun Gothic';const ticks=lo===hi?[lo]:Array.from({length:5},(_,i)=>lo*(1-i/4)+hi*(i/4));for(const v of ticks){const yy=py(v);c.strokeStyle='#e1e6ed';c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#203044';c.textAlign='right';text(fmt(v),left-20,yy+7,135);}c.textAlign='left';
 c.strokeStyle='#617286';c.lineWidth=1;c.strokeRect(left,top,right-left,bottom-top);for(let i=0;i<=4;i++){const rank=Math.round(1+(m.points.length-1)*i/4);c.textAlign='center';text(rank,px(rank),bottom+40,160);}text('측정값을 작은 순서로 정렬한 순위 (시험일·입력 순서 아님)',840,835,1300);c.textAlign='left';c.save();c.translate(40,650);c.rotate(-Math.PI/2);text(`Blank 측정값 (${input.data.unit}) · 선형 눈금`,0,0,450);c.restore();
 c.fillStyle='#183653';for(let i=0;i<m.points.length;i++){c.beginPath();c.arc(px(i+1),py(m.points[i].value),m.points.length>300?2.5:4,0,Math.PI*2);c.fill();}
 c.strokeStyle='#b8750a';c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.moveTo(left,py(m.lob));c.lineTo(right,py(m.lob));c.stroke();c.setLineDash([]);c.lineWidth=1;
 c.fillStyle='#203044';c.font='23px Malgun Gothic';text(`● 개별 측정값    점선: 계산된 집단 LoB ${fmt(m.lob)} ${input.data.unit} · α=5%`,80,895);text(`계산 순위 ${fmt(m.rank.position)} · 이웃 순위 ${m.rank.lower}/${m.rank.upper} · 원 입력 순서 보존`,80,935);
 c.font='20px Malgun Gothic';text('정규분포 적합/밀도 추정/새 CI 없음 · 전체 LOT LoB/LoD·허가 적합 판정 아님',80,975);c.font='18px Malgun Gothic';text(`${e.method.source} · 방법 ${e.method.version} · ${m.version}`,80,1010);
 const notes=m.warnings.map(w=>({LOB_ALL_EQUAL:'모든 측정값 동일: 반올림/대체값 여부 확인',LOB_INTERNAL_SIGNAL:'RFU 내부 신호: 농도 기반 성능 주장과 구분'}[w]||w));text(notes.length?'경고: '+notes.join(' / '):'원자료·검체/LOT 구성·시험설계 미검증',80,1040);text('전체 원값·정밀 수치·출처는 결과 표와 작업 JSON을 함께 보관하세요.',80,1070);return m;}
 return {model,draw};
})();
