import {baBands,BA_BAND_HEADERS,BA_BAND_NOTE} from './practical-data.mjs';
import {baPrecisionNote} from './result-contract.mjs';
import {plotLegend} from './plot-legend.mjs';
import {baObservations,BA_COLORS} from './ba-observation.mjs';
import {helpButton} from './help-content.mjs';
import {formatNumber as fmt} from './format.mjs';
import {analyses,comparisonFacts,SOURCES} from './comparison.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ci=v=>v?.map(fmt).join(' ~ ')||'—';
const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function plot(points,lines,xTitle,yTitle,title,context='',pointLegend=null){
  if(!points.length)return '<p>표시할 수치쌍이 없습니다.</p>';
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),lo=Math.min(...xs),hi=Math.max(...xs);
  const curves=lines.map(l=>({...l,color:l.color||'#c0643d',points:[{x:lo,y:l.a+l.b*lo},{x:hi,y:l.a+l.b*hi}]})).filter(l=>l.points.every(p=>Number.isFinite(p.y)));
  ys.push(...curves.flatMap(l=>l.points.map(p=>p.y)));
  let minX=lo,maxX=hi,minY=Math.min(...ys),maxY=Math.max(...ys);
  if(![maxX-minX,maxY-minY].every(Number.isFinite))return '<p>도표 범위가 너무 큽니다.</p>';
  if(minX===maxX){minX-=1;maxX+=1;}if(minY===maxY){minY-=1;maxY+=1;}
  const dx=(maxX-minX)*.06,dy=(maxY-minY)*.10;minX-=dx;maxX+=dx;minY-=dy;maxY+=dy;
  const x=v=>95+(v-minX)/(maxX-minX)*420,y=v=>265-(v-minY)/(maxY-minY)*210;
  const legend=plotLegend([...(pointLegend||[{name:'선택 검체',dot:true,color:'#2b679a'}]),...curves]);
  let svg=`<svg viewBox="0 0 560 ${legend.height}" role="img" aria-label="${esc(title)}" data-context="${esc(context)}" data-legend="${esc(legend.description)}"><path d="M95 45 V265 H520" fill="none" stroke="#70859c"/>`;
  for(let i=0;i<=4;i++){const a=minX+(maxX-minX)*i/4,b=minY+(maxY-minY)*i/4;svg+=`<text x="${x(a)}" y="284" text-anchor="middle">${esc(fmt(a))}</text><text x="86" y="${y(b)+4}" text-anchor="end">${esc(fmt(b))}</text>`;}
  for(const l of curves)svg+=`<path d="M${x(l.points[0].x)} ${y(l.points[0].y)} L${x(l.points[1].x)} ${y(l.points[1].y)}" stroke="${l.color||'#c0643d'}" stroke-dasharray="${l.dash?'5 4':'none'}"><title>${esc(l.name)}</title></path>`;
  for(const p of points)svg+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.outside?4.5:3.5}" fill="${p.outside?'white':BA_COLORS.inside}" fill-opacity="${p.outside?1:.7}" ${p.outside?`stroke="${BA_COLORS.outside}" stroke-width="2"`:''} ${p.state?`data-ba-state="${p.state}"`:''}><title>${esc(p.id)} / 행 ${p.sourceRow} / ${esc(fmt(p.x))}, ${esc(fmt(p.y))}${p.label?' / '+esc(p.label)+' / '+esc(p.tolerance):''}</title></circle>`;
  return svg+`<text x="290" y="317" text-anchor="middle">${esc(xTitle)}</text><text x="15" y="165" transform="rotate(-90 15 165)" text-anchor="middle">${esc(yTitle)}</text>${legend.markup}</svg>`;
}
const details=(title,body)=>`<details class="interpretation"><summary>${title}</summary>${body}</details>`;
export function comparisonHTML(snapshot,selected,summary){
  const r=analyses(snapshot,selected),c=r.config,b=r.ba,d=r.deming,level=snapshot.confidence*100,observations=baObservations(r);
  const duplicates=selected.filter(p=>p.issues.some(v=>v.includes('중복'))).length;
  const duplicateNote=duplicates?`<p class="warning">중복 ID 표시 ${duplicates}행을 합치지 않고 보존합니다. 같은 검체의 반복측정이라면 독립 검체 모형을 사용하지 마세요. ID만으로 반복 설계를 확인할 수 없습니다.</p>`:'';
  const allDuplicates=snapshot.rows.filter(p=>p.issues.some(v=>v.includes('중복'))).length;
  const demingDuplicateNote=allDuplicates?`<p class="warning">전체 입력 중 중복 ID 표시 ${allDuplicates}행을 합치지 않고 보존합니다. 같은 검체의 반복측정이라면 독립 검체 모형을 사용하지 마세요. ID만으로 반복 설계를 확인할 수 없습니다.</p>`:'';
  const transitions='<h3>선택 범위의 정성 전환도 함께 확인</h3>'+table(['양성 → 음성·ND','음성·ND → 양성','Reference 양성 중 Product Invalid','Reference 양성 중 Product 미입력','Product 평가 가능 / Reference 양성'],[[summary.FN,summary.FP,summary.productInvalid,summary.productMissing,`${summary.evaluability.k} / ${summary.evaluability.n}`]])+'<p>차이 분석은 양쪽 양성을 유지한 수치쌍의 조건부 결과입니다. 미검출을 0 또는 최대 cycle로 대입하지 않습니다.</p>';
  let ba='<h2>Bland–Altman · 직접 차이</h2><p>같은 항목·단위·결과 정의의 두 값을 비교합니다. 차이는 Product − Reference이며, X축은 두 값의 평균입니다.</p>';
  if(!b)ba+='<p class="warning">'+esc(c.baReasons.join(' '))+' 「BA·직접 차이 적용 조건」에서 설정한 뒤 분석하세요.</p>';
  else{
    ba+=duplicateNote+`<p>현재 선택 범위 n=${b.n} · 공통 단위: ${esc(c.unit)} · LoA 범위는 항상 95%, 추정치 CI는 ${level}%입니다.</p>`+table(['핵심 결과','추정값',`${level}% CI`],[['평균 차이 (bias)',fmt(b.bias),ci(b.biasCI)],['95% LoA 하한',fmt(b.loa?.[0]),ci(b.loaCI?.[0])],['95% LoA 상한',fmt(b.loa?.[1]),ci(b.loaCI?.[1])]]);
    if(b.bias!==null)ba+=`<p class="finding">관측: Product가 Reference보다 평균 ${fmt(Math.abs(b.bias))} ${esc(c.unit)} ${b.bias<0?'낮습니다':b.bias>0?'높습니다':'차이납니다 (평균 차이 0)'}. ${b.loa?`개별 차이의 95% LoA는 ${ci(b.loa)} ${esc(c.unit)}입니다.`:''}</p>`;
    if(baPrecisionNote(b))ba+=`<p class="${b.n===2?'warning':'hint'}">${esc(baPrecisionNote(b))}</p>`;
    ba+='<p>평균 차이는 평균 이동, LoA는 개별 차이의 퍼짐입니다. '+helpButton('loa')+'</p>';
    ba+=observations.available?`<p class="finding">95% LoA 밖 ${observations.outside} / ${observations.n}개 · 하한 미만 ${observations.below}개 / 상한 초과 ${observations.above}개. 색상은 확인할 위치를 표시하며 오류·불합격 판정이 아닙니다.</p><button type="button" data-review="ba" data-row-mode="ba-loa-outside" data-no-copy>95% LoA 밖 검체 확인 (${observations.outside})</button>`:'<p>LoA 계산 불가: 검체를 LoA 안/밖으로 구분하지 않습니다.</p>';
    ba+=plot(observations.rows.map(p=>({...p,x:p.average,y:p.difference})),b.loa?[{a:0,b:0,name:'차이 0 기준선',color:'#8794a0',dash:true},{a:b.bias,b:0,name:'평균 차이'},{a:b.loa[0],b:0,name:'95% LoA 하한',dash:true,color:'#668eb0'},{a:b.loa[1],b:0,name:'95% LoA 상한',dash:true,color:'#668eb0'},...(c.lower===null?[]:[{a:c.lower,b:0,name:'사용자 허용 하한',dash:true,color:'#80609b'},{a:c.upper,b:0,name:'사용자 허용 상한',dash:true,color:'#80609b'}])]:[],'(Reference + Product) / 2',`Product − Reference (${c.unit})`,'Bland–Altman 차이도','',observations.available?[{name:'95% LoA 안',dot:true,color:BA_COLORS.inside},{name:'95% LoA 밖',dot:true,hollow:true,color:BA_COLORS.outside}]:[{name:'LoA 계산 불가',dot:true,color:BA_COLORS.inside}]);
    ba+='<p>회색 점선: 차이 0 기준선 · 실선: 평균 차이 · 청색 점선: 95% LoA · 자주 점선: 입력한 허용 차이. 점을 가리키면 검체 ID·원행·값을 확인할 수 있습니다.</p>';
    if(c.lower===null)ba+='<p class="warning">사전 허용 차이 미설정: 이 결과만으로 두 방법의 대체 가능성이나 합격 여부를 판단할 수 없습니다.</p>';
    else ba+=`<p>사용자 지정 허용 차이: ${c.lower} ~ ${c.upper} ${esc(c.unit)}. 관측 LoA ${b.loa?(b.loa[0]>=c.lower&&b.loa[1]<=c.upper?'양 끝은 입력 범위 안에 있습니다':'중 입력 범위를 벗어나는 끝이 있습니다'):'계산 불가'}. 이 비교는 통계적 관측이며 임상 적합성 판정이 아닙니다. LoA 끝의 CI도 함께 검토하세요.</p>`;
    ba+=b.reasons.map(v=>`<p class="warning">${esc(v)}</p>`).join('');
    ba+=details('BA 상세 통계','<p>차이의 SD·중앙값·LoA 밖 관측 수를 확인합니다. '+helpButton('sd')+helpButton('median')+helpButton('loa')+'</p>'+table(['차이 SD','차이 Median [Q1–Q3]','LoA 밖 / n'],[[fmt(b.sd),b.distribution?`${fmt(b.distribution.median)} [${fmt(b.distribution.q1)}–${fmt(b.distribution.q3)}]`:'—',observations.available?`${observations.outside} / ${observations.n}`:'LoA 계산 불가']]));
  }
  if(b){const bands=baBands(snapshot,selected,c);ba+=details('Reference 구간별 차이 요약',`<p class="hint">${esc(BA_BAND_NOTE)} 공통 단위: ${esc(c.unit)}. SD는 수치쌍 2개 이상에서 계산합니다. ${helpButton('ba-bands')}</p>`+(bands.length?table(BA_BAND_HEADERS,bands.map(g=>[g.label,g.n,fmt(g.bias),fmt(g.sd)])):'<p>Reference 경계가 미설정입니다. 구간·신뢰구간 설정에서 경계를 입력하면 이 표를 볼 수 있습니다. 전체 BA 결과는 위에 표시됩니다. SD는 n≥2에서 계산합니다.</p>'));}
  ba+=transitions+'<p>값이 커질수록 차이가 커지거나 퍼짐이 넓어지는지 그림에서 확인하세요. Reference로 구간을 선택하면 선택 자체가 차이 분포에 영향을 줄 수 있습니다. Ct/Tt 단축만으로 LoD 개선을 추정하지 않습니다.</p>';
  const method=details('BA 방법·적용 조건·출처',table(['분석 정보','값'],comparisonFacts(r).filter(([key])=>!key.startsWith('Deming')))+    '<p><a href="'+SOURCES.ba+'">Bland–Altman 원 논문</a> · <a href="'+SOURCES.interpretation+'">LoA 해석</a></p>');
  ba=ba.replace('data-context=""',`data-context="${esc(`BA 현재 선택 n=${b?.n??r.selectedN} / Product − Reference / ${c.unit||'단위 미확인'} / ${observations.available?`95% LoA ${ci(b.loa)} / 밖 ${observations.outside}개 (하한 미만 ${observations.below}, 상한 초과 ${observations.above})`:'LoA 계산 불가'} / ${level}% CI / ${c.lower===null?'사전 허용 차이 미사용':`사용자 허용 차이 ${c.lower} ~ ${c.upper} ${c.unit}`} / LoA 밖은 오류·불합격 판정 아님`)}"`);
  return {ba:ba+method};
}
