import {dateLabels,dateMode} from './date-boundaries.mjs';
import {HEADERS,VERSION,summarize,groups,medianSummary,medianGroups,medianDateGroups,evaluateRow,prediction,inputAuditEntries,numericCaution} from './core.mjs';
import {numberFormat,formatNumber,formatPercent} from './format.mjs';
import {NOTES} from './notes.mjs';

// Native chart/layout template is authored with artifact-tool. The browser fills
// its cells and chart caches using the existing offline XLSX/ZIP dependency.
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main',C='http://schemas.openxmlformats.org/drawingml/2006/chart',A='http://schemas.openxmlformats.org/drawingml/2006/main';
const parse=text=>{const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('리포트 XML을 읽을 수 없습니다.');return d;};
const xml=d=>new XMLSerializer().serializeToString(d);
const els=(n,ns,name)=>Array.from(n.getElementsByTagNameNS(ns,name));
const child=(n,ns,name)=>Array.from(n.children).find(c=>c.namespaceURI===ns&&c.localName===name);
const make=(d,ns,name,attrs={},value)=>{const e=d.createElementNS(ns,(ns===S?'x:':ns===C?'c:':'a:')+name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(value!==undefined)e.textContent=String(value);return e;};
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const pct=v=>({value:v,format:'0.00%'}),count=v=>({value:v,format:'0'}),num=v=>({value:v,format:numberFormat(v)});
const ci=p=>[pct(p.ci?.[0]??null),pct(p.ci?.[1]??null)];
const serial=date=>({value:Math.round((Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000)-(date<'1900-03-01'?1:0),format:'yyyy-mm-dd'});
const inputRow=r=>[count(r.sourceRow),...r.raw.map((v,i)=>i===1&&r.date?serial(r.date):i===3&&r.x!==null?num(r.x):i===5&&r.y!==null?num(r.y):v)];
const modelValues=m=>[['모델 n',count(m.n)],['Pearson r',num(m.r)],['r CI 하한',num(m.rCI?.[0]??null)],['r CI 상한',num(m.rCI?.[1]??null)],['R²',num(m.r2)],['OLS 기울기',num(m.slope)],['기울기 CI 하한',num(m.slopeCI?.[0]??null)],['기울기 CI 상한',num(m.slopeCI?.[1]??null)],['OLS 절편',num(m.intercept)],['절편 CI 하한',num(m.interceptCI?.[0]??null)],['절편 CI 상한',num(m.interceptCI?.[1]??null)],['잔차 표준오차',num(m.se)]];
const medianRows=gs=>gs.map(g=>[g.label,num(g.reference.median),num(g.product.median),count(g.reference.n),count(g.all.n),num(g.all.median),num(g.all.q1),num(g.all.q3),num(g.reference.q1),num(g.reference.q3),num(g.product.q1),num(g.product.q3)]);
const extraGroup=g=>{const s=g.summary;return [count(s.numeric.n),num(s.numeric.r),num(s.numeric.slope),num(s.numeric.xMean),num(s.numeric.yMean),num(s.pi.residualMean),count(s.pi.n),count(s.pi.outliers),pct(s.pi.rate),num(s.pi.meanExcess),numericCaution(s.numeric.n)];};
const extraHeaders=['양성 수치쌍 n','그룹 Pearson r','그룹 OLS 기울기','Ref 평균','Product 평균','전체 기준 잔차 평균','PI 계산 가능 n','PI 이탈 n','PI 이탈률','평균 초과량','수치 해석 참고'];

export function reportData(snapshot,rows,scope){
  const s=summarize(rows,snapshot.confidence,snapshot.method,snapshot.model),m=snapshot.model;
  const ref=groups(rows,'ct',snapshot.ct,snapshot.confidence,snapshot.method,m);
  const dates=rows.some(r=>r.eligible&&r.date)?groups(rows,'date',snapshot.dates,snapshot.confidence,snapshot.method,m):[];
  const med=[{label:'현재 표시 범위 전체',...medianSummary(rows)},...(snapshot.median.length?medianGroups(rows,snapshot.median):[])];
  const medDate=dates.length?medianDateGroups(rows,snapshot.dates):[];
  const meta=[`검사법 비교 분석 ${VERSION} · ${snapshot.source}`,`표시 범위: ${scope}`,`CI ${formatNumber(snapshot.confidence*100)}% ${snapshot.method==='exact'?'Exact':'Wilson'} · PI ${formatNumber(snapshot.piLevel*100)}% · 전체 입력 고정 모델 n=${m.n}`];
  const sheet=(name,key,headers,data,chart=null)=>({name,notes:[...meta,...NOTES[key]],headers,rows:data,chart,header:chart?33:12});
  const summary=[['작성 시점',new Date().toISOString()],['보고서 성격','분석 시점의 결과 스냅샷 — 원본 편집 후 자동 재계산 없음'],['입력 전체 행',count(snapshot.rows.length)],['현재 표시 원행',count(rows.length)],['분석 적격 검체',count(s.eligible)],['유효 정성 쌍',count(s.valid)],['양성 수치쌍',count(s.numeric.n)],['현재 범위 채취일 공란',count(s.dateMissing)],...inputAuditEntries(snapshot.rows).map(([label,value])=>[label,count(value)]),['전체 입력 검증 기준','필터와 무관. 항목별 오류는 중복될 수 있으며 ID 누락 행도 포함. 0 이하 수치는 자동 제외 사유 아님'],['현재 범위 Reference 양성 n',count(s.refPositive)],['현재 범위 Product 유효 n (Reference 양성)',count(s.evaluability.k)],['현재 범위 Product Invalid (Reference 양성)',count(s.productInvalid)],['현재 범위 Product 미입력 (Reference 양성)',count(s.productMissing)],['현재 범위 Product 평가 가능률',pct(s.evaluability.p)],['현재 범위 유효 결과 중 검출률',pct(s.detection.p)],['검출값 경계',snapshot.ct.join(', ')||'전체'],['Median 경계',snapshot.median.join(', ')||'전체'],['채취일 분석 방식',dateMode(snapshot.dates)],...snapshot.dates.map((date,i)=>['D'+(i+1),date]),...dateLabels(snapshot.dates).map((label,i)=>['채취일 구간 '+(i+1),label]),['전체 기준 모델','전체 적격 양성 수치쌍 고정 OLS — 필터 재적합 없음'],...modelValues(m),['선택 검체 PI 계산 가능',count(s.pi.n)],['선택 검체 PI 계산 불가',count(s.pi.unavailable)],['선택 검체 PI 이탈',count(s.pi.outliers)],['PI 이탈률',pct(s.pi.rate)],['전체 기준 잔차 평균',num(s.pi.residualMean)],['이탈 평균 초과량',num(s.pi.meanExcess)]];
  const qual=['ppa','npa','opa'].map(k=>[k.toUpperCase(),pct(s[k].p),count(s[k].k),count(s[k].n),...ci(s[k])]);
  const numeric=rows.filter(r=>r.pair).map(r=>{const e=evaluateRow(r,m);return [num(r.x),num(r.y),num(e.residual),r.id,count(r.sourceRow),num(e.fit),num(e.lo),num(e.hi),e.state,num(e.excess)];});
  const out=[
    sheet('분석요약','report',['항목','값'],summary),
    sheet('정성비교','qual',['지표','비율','일치 수','분모',`${snapshot.confidence*100}% CI 하한`,`${snapshot.confidence*100}% CI 상한`],qual,{type:'bar',series:['일치율'],percent:true}),
    sheet('수치관계','numeric',['Reference','Product','전체 잔차','검체 ID','원래 행','전체 예상값','PI 하한','PI 상한','PI 상태','초과량'],numeric,{type:'scatter',series:['Product']}),
    sheet('검출값구간','groups',['구간','유효 결과 중 검출률','검출 수','유효 분모','분석 적격 Reference 양성 n','미검출 n','CI 하한','CI 상한','Product Invalid','Product 미입력','평가 가능률',...extraHeaders],ref.map(g=>{const s=g.summary;return [g.label,pct(s.detection.p),count(s.detection.k),count(s.detection.n),count(s.refPositive),count(s.FN),...ci(s.detection),count(s.productInvalid),count(s.productMissing),pct(s.evaluability.p),...extraGroup(g)];}),{type:'bar',series:['유효 결과 중 검출률'],percent:true}),
    sheet('채취일구간','groups',['채취일 구간','PPA','NPA','TP','FN','FP','TN','PPA 분모','NPA 분모','PPA CI 하한','PPA CI 상한','NPA CI 하한','NPA CI 상한','유효 정성 n','정성 제외',...extraHeaders],dates.map(g=>{const s=g.summary;return [g.label,pct(s.ppa.p),pct(s.npa.p),count(s.TP),count(s.FN),count(s.FP),count(s.TN),count(s.ppa.n),count(s.npa.n),...ci(s.ppa),...ci(s.npa),count(s.valid),count(s.excluded),...extraGroup(g)];}),{type:'bar',series:['PPA','NPA'],percent:true}),
    ...[['중앙값_검출구간',med],['중앙값_채취일',medDate]].map(([name,gs])=>sheet(name,'median',['구간','Paired Reference Median','Paired Product Median','양성 수치쌍 n','전체 Reference n','전체 Reference Median','전체 Ref Q1','전체 Ref Q3','Paired Ref Q1','Paired Ref Q3','Paired Product Q1','Paired Product Q3'],medianRows(gs),{type:'bar',series:['Reference','Product'],percent:false})),
    sheet('검체목록','input',['원래 행',...HEADERS,'입력 적격','정성 비교','양성 수치쌍','전체 예상값','전체 잔차','PI 하한','PI 상한','PI 상태','초과량','누락·확인 사항'],rows.map(r=>{const e=evaluateRow(r,m);return [...inputRow(r),r.eligible?'포함':!r.id?'ID 누락 제외':'형식 오류 제외',r.cls??'제외',r.pair?'포함':'제외',num(e.fit),num(e.residual),num(e.lo),num(e.hi),e.state,num(e.excess),r.issues.join('; ')];})),
    sheet('원본입력','input',['원래 행',...HEADERS,'입력 적격','형식 오류','누락·확인 사항'],snapshot.rows.map(r=>[count(r.sourceRow),...r.raw,r.eligible?'포함':!r.id?'ID 누락 제외':'형식 오류 제외',r.inputErrors.join('; '),r.issues.join('; ')]))
  ];
  out[1].notes.push(`Reference 양성 ${s.refPositive}개 / Product 유효 ${s.evaluability.k}개 / Invalid ${s.productInvalid}개 / 미입력 ${s.productMissing}개. 평가 가능률 ${formatPercent(s.evaluability.p)} / 유효 결과 중 검출률 ${formatPercent(s.detection.p)}.`, `2×2 집계: TP=${s.TP}, FN=${s.FN}, FP=${s.FP}, TN=${s.TN}. 유효 정성 n=${s.valid}.`);
  if(numericCaution(m.n))out[2].notes.push('전체 기준 모델: '+numericCaution(m.n));
  if(numericCaution(s.numeric.n)&&s.numeric.n!==m.n)out[2].notes.push('현재 선택 범위: '+numericCaution(s.numeric.n));
  out[2].notes.push(`전체 OLS: Product = ${formatNumber(m.intercept)} + ${formatNumber(m.slope)} × Reference. 전체 Pearson r=${formatNumber(m.r)}. 계수/CI는 분석요약 시트 참조.`);
  out[4].chart.title=dateMode(snapshot.dates)+' PPA / NPA';
  out[6].chart.title=snapshot.dates.length?'채취일 구간별 중앙값':'채취일별 중앙값 — 구간 경계 미설정';
  out[8].notes[1]='원본입력은 필터와 관계없이 전체 입력입니다. 입력 문자열과 원래 행 번호를 보존하며 수식은 실행하지 않습니다.';
  out.forEach(d=>{if(!d.rows.length)d.notes.push('현재 범위에서 분석할 대상이 없습니다. 빈 그래프는 대상 없음이며 0%가 아닙니다.');});
  if(m.slope!==null&&m.pairs.length){const lo=Math.min(...m.pairs.map(p=>p.x)),hi=Math.max(...m.pairs.map(p=>p.x));out[2].curves=Array.from({length:81},(_,i)=>{const x=lo+(hi-lo)*i/80,p=prediction(m,x);return [num(x),num(m.intercept+m.slope*x),num(p?.lo??null),num(p?.hi??null)];});}
  return out;
}

function styles(d,{titleSize,emphasisSize}){
  els(d,S,'font').forEach((f,i)=>{child(f,S,'name').setAttribute('val','Malgun Gothic');child(f,S,'sz').setAttribute('val',i===2?titleSize:i===3?emphasisSize:9);});
  let formats=child(d.documentElement,S,'numFmts');if(!formats){formats=make(d,S,'numFmts');d.documentElement.insertBefore(formats,d.documentElement.firstChild);}
  const xfs=child(d.documentElement,S,'cellXfs'),ids={};
  for(const [i,code] of ['0.00','0.00E+00','0.00%','0','yyyy-mm-dd'].entries()){formats.append(make(d,S,'numFmt',{numFmtId:164+i,formatCode:code}));const f=xfs.children[1].cloneNode(true);f.setAttribute('numFmtId',164+i);f.setAttribute('applyNumberFormat','1');ids[code]=xfs.children.length;xfs.append(f);}
  const wrap=xfs.children[1].cloneNode(true);wrap.setAttribute('applyAlignment','1');wrap.append(make(d,S,'alignment',{wrapText:'1',vertical:'top'}));ids.wrap=xfs.children.length;xfs.append(wrap);
  formats.setAttribute('count',formats.children.length);xfs.setAttribute('count',xfs.children.length);return ids;
}

function fillSheet(d,data,ids,titleSize){
  const root=d.documentElement,sd=child(root,S,'sheetData');sd.replaceChildren();const rowMap=new Map();
  function add(n,index,value,style=1){let r=rowMap.get(n);if(!r){r=make(d,S,'row',{r:n,ht:18,customHeight:1});rowMap.set(n,r);}const obj=value&&typeof value==='object'?value:{value};if(obj.format)style=ids[obj.format];const c=make(d,S,'c',{r:col(index)+n,s:style});if(obj.value!==null&&obj.value!==undefined){if(typeof obj.value==='number'&&Number.isFinite(obj.value))c.append(make(d,S,'v',{},obj.value));else {c.setAttribute('t','inlineStr');const is=make(d,S,'is'),t=make(d,S,'t',{},String(obj.value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''));t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');is.append(t);c.append(is);}}r.append(c);return r;}
  add(2,0,data.name,2).setAttribute('ht',Math.max(26,titleSize*1.5));
  // Three metadata rows and two concise annotation rows above the charts.
  const notes=[...data.notes.slice(0,3),data.notes.slice(3,Math.ceil((data.notes.length+3)/2)).join(' '),data.notes.slice(Math.ceil((data.notes.length+3)/2)).join(' ')];
  notes.forEach((v,i)=>add(i+4,0,v,ids.wrap).setAttribute('ht',i<3?27:40));
  data.headers.forEach((h,i)=>add(data.header,i,h,5).setAttribute('ht',48));
  data.rows.forEach((row,i)=>row.forEach((v,j)=>{const wrap=typeof v==='string'&&(v.length>35||j===0&&v.length>22);const r=add(data.header+i+1,j,v,wrap?ids.wrap:1);if(wrap)r.setAttribute('ht',Math.min(80,Math.max(28,Math.ceil(v.length/35)*14)));}));
  if(data.curves){['Reference 곡선','전체 OLS','PI 하한','PI 상한'].forEach((v,j)=>add(33,26+j,v,5));data.curves.forEach((r,i)=>r.forEach((v,j)=>add(34+i,26+j,v)));}
  [...rowMap].sort((a,b)=>a[0]-b[0]).forEach(([,r])=>sd.append(r));
  let merges=child(root,S,'mergeCells');if(merges)merges.remove();merges=make(d,S,'mergeCells',{count:6});[2,4,5,6,7,8].forEach(n=>merges.append(make(d,S,'mergeCell',{ref:`A${n}:Q${n}`})));root.insertBefore(merges,sd.nextSibling);
  const view=els(d,S,'sheetView')[0];child(view,S,'pane')?.remove();if(!data.chart&&data.name!=='분석요약')view.prepend(make(d,S,'pane',{ySplit:data.header,topLeftCell:'A'+(data.header+1),activePane:'bottomLeft',state:'frozen'}));
  let dim=child(root,S,'dimension');if(dim)dim.remove();dim=make(d,S,'dimension',{ref:`A1:${col(Math.max(16,data.headers.length-1,data.curves?29:0))}${Math.max(33,data.header+data.rows.length,data.curves?114:0)}`});root.insertBefore(dim,root.firstChild);
  const cols=child(root,S,'cols');for(let i=18;i<=Math.max(data.headers.length,data.curves?30:17);i++)cols.append(make(d,S,'col',{min:i,max:i,width:16,customWidth:1}));
  if(data.name==='분석요약'){els(cols,S,'col').find(c=>c.getAttribute('min')==='1')?.setAttribute('width','44');els(cols,S,'col').find(c=>c.getAttribute('min')==='2')?.setAttribute('width','90');}
  if(data.curves)els(cols,S,'col').filter(c=>Number(c.getAttribute('min'))>=27).forEach(c=>c.setAttribute('hidden','1'));
}

function reference(d,container,sheet,column,start,values,numeric,format){
  container.replaceChildren();const ref=make(d,C,numeric?'numRef':'strRef'),cache=make(d,C,numeric?'numCache':'strCache');
  ref.append(make(d,C,'f',{},`'${sheet.replaceAll("'","''")}'!$${column}$${start}:$${column}$${start+Math.max(1,values.length)-1}`));
  if(numeric)cache.append(make(d,C,'formatCode',{},format||(values.some(v=>numberFormat(v?.value??v)==='0.00E+00')?'0.00E+00':'0.00')));cache.append(make(d,C,'ptCount',{val:values.length}));
  values.forEach((v,i)=>{v=v&&typeof v==='object'?v.value:v;if(v===null||v===undefined||numeric&&!Number.isFinite(v))return;const p=make(d,C,'pt',{idx:i});p.append(make(d,C,'v',{},v));cache.append(p);});ref.append(cache);container.append(ref);
}
function fillChart(d,data,options,residual=false){
    if(data.chart.title){const title=child(els(d,C,'chart')[0],C,'title');const texts=title?els(title,A,'t'):[];if(texts.length){texts[0].textContent=data.chart.title;texts.slice(1).forEach(t=>t.textContent='');}}
  const chart=els(d,C,'barChart')[0]||els(d,C,'scatterChart')[0],base=els(chart,C,'ser')[0],old=els(chart,C,'ser');old.forEach(s=>s.remove());
  const scatter=chart.localName==='scatterChart',names=scatter?[residual?'전체 잔차':'Product']:data.chart.series;
  const addSeries=(name,index,xcol,ycol,values,curve=false)=>{
    const ser=base.cloneNode(true);child(ser,C,'idx').setAttribute('val',index);child(ser,C,'order').setAttribute('val',index);child(ser,C,'tx').replaceChildren(make(d,C,'v',{},name));
    if(scatter){reference(d,child(ser,C,'xVal'),data.name,xcol,34,values.map(r=>r[0]),true);reference(d,child(ser,C,'yVal'),data.name,ycol,34,values.map(r=>r[1]),true);}
    else{reference(d,child(ser,C,'cat'),data.name,'A',data.header+1,values.map(r=>r[0]),false);reference(d,child(ser,C,'val'),data.name,ycol,data.header+1,values.map(r=>r[1]),true,data.chart.percent?'0.00%':'0.00');const sp=child(ser,C,'spPr');sp.replaceChildren();const fill=make(d,A,'solidFill');fill.append(make(d,A,'srgbClr',{val:index===0?'20668A':'ED7333'}));sp.append(fill);}
    if(scatter){let sp=child(ser,C,'spPr');if(!sp){sp=make(d,C,'spPr');ser.insertBefore(sp,child(ser,C,'xVal'));}sp.replaceChildren();const line=make(d,A,'ln',{w:curve?19050:0});if(curve){const f=make(d,A,'solidFill');f.append(make(d,A,'srgbClr',{val:index===1?'ED7333':'829CB1'}));line.append(f);if(index>1)line.append(make(d,A,'prstDash',{val:'dash'}));}else line.append(make(d,A,'noFill'));sp.append(line);
      let marker=child(ser,C,'marker');if(!marker){marker=make(d,C,'marker');ser.insertBefore(marker,child(ser,C,'xVal'));}marker.replaceChildren(make(d,C,'symbol',{val:curve?'none':'circle'}));if(!curve){marker.append(make(d,C,'size',{val:5}));const ms=make(d,C,'spPr'),fill=make(d,A,'solidFill');fill.append(make(d,A,'srgbClr',{val:'20668A'}));ms.append(fill);marker.append(ms);}
    }
    chart.insertBefore(ser,child(chart,C,'axId'));
  };
  if(scatter)child(chart,C,'scatterStyle')?.setAttribute('val','lineMarker');
  names.forEach((name,i)=>addSeries(name,i,'A',col(residual?2:i+1),data.rows.map(r=>[r[0],r[residual?2:i+1]])));
  if(scatter&&!residual&&data.curves)for(const [i,name] of ['전체 OLS','PI 하한','PI 상한'].entries())addSeries(name,i+1,'AA',col(27+i),data.curves.map(r=>[r[0],r[i+1]]),true);
  if(scatter)els(d,C,'valAx').forEach(axis=>{const column=child(axis,C,'axPos')?.getAttribute('val')==='b'?0:residual?2:1,values=data.rows.map(r=>r[column]?.value??r[column]).filter(Number.isFinite);child(axis,C,'numFmt')?.setAttribute('formatCode',values.some(v=>numberFormat(v)==='0.00E+00')?'0.00E+00':'0.00');});
  if(!scatter){child(chart,C,'barDir').setAttribute('val','col');let grouping=child(chart,C,'grouping');if(!grouping){grouping=make(d,C,'grouping');chart.insertBefore(grouping,child(chart,C,'varyColors'));}grouping.setAttribute('val','clustered');els(d,C,'errBars').forEach(n=>n.remove());if(data.chart.percent){els(d,C,'valAx').forEach(axis=>{const sc=child(axis,C,'scaling');els(sc,C,'min').forEach(n=>n.remove());els(sc,C,'max').forEach(n=>n.remove());sc.append(make(d,C,'max',{val:1}),make(d,C,'min',{val:0}));});}}
  child(els(d,C,'chart')[0],C,'plotVisOnly')?.setAttribute('val','0');
  for(const n of ['latin','ea','cs'])els(d,A,n).forEach(e=>e.setAttribute('typeface','Malgun Gothic'));
  for(const n of ['rPr','defRPr','endParaRPr'])els(d,A,n).forEach(e=>{let p=e,isTitle=false;while(p){if(p.namespaceURI===C&&p.localName==='title')isTitle=true;p=p.parentNode;}e.setAttribute('sz',isTitle?Math.round(options.titleSize*100):900);});
}

export async function exportReport(snapshot,rows,scope,options={titleSize:14,emphasisSize:10}){
  const response=await fetch(new URL('./report-template.xlsx',import.meta.url));if(!response.ok)throw Error('리포트 양식을 불러오지 못했습니다.');
  const zip=await globalThis.JSZip.loadAsync(await response.arrayBuffer()),data=reportData(snapshot,rows,scope);
  const st=parse(await zip.file('xl/styles.xml').async('string')),ids=styles(st,options);zip.file('xl/styles.xml',xml(st));
  for(let i=0;i<data.length;i++){const path=`xl/worksheets/sheet${i+1}.xml`,d=parse(await zip.file(path).async('string'));fillSheet(d,data[i],ids,options.titleSize);zip.file(path,xml(d));}
  const chartData=[[data[1],false],[data[2],false],[data[2],true],[data[3],false],[data[4],false],[data[5],false],[data[6],false]];
  for(let i=0;i<chartData.length;i++){const path=`xl/drawings/charts/chart${i+1}.xml`,d=parse(await zip.file(path).async('string'));fillChart(d,...[chartData[i][0],options,chartData[i][1]]);zip.file(path,xml(d));}
  for(const path of Object.keys(zip.files).filter(p=>/^xl\/theme\/.*\.xml$/.test(p))){const d=parse(await zip.file(path).async('string'));for(const n of ['latin','ea','cs','font'])els(d,A,n).forEach(e=>e.setAttribute('typeface','Malgun Gothic'));zip.file(path,xml(d));}
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
