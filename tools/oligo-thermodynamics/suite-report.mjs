// SPDX-License-Identifier: GPL-2.0-or-later
import {resultText,resultRows,csvCell} from './report.mjs';
import {compareFragments} from './suite-core.mjs';
import {textHTML} from './structure.mjs';
const names={full:'선택 전체',five:'A5′ / B3′',three:'A3′ / B5′'};
export function componentRecords(record){
 if(!record.suitePoint)return [{kind:'full',record,target:null}];
 const s=record.suitePoint;
 return s.point.entries.map((e,i)=>({kind:e.kind,target:s.request.targets[i],record:{...e.record,id:record.id?`${record.id} · ${names[e.kind]}`:names[e.kind],calculatedAt:record.calculatedAt,parentRaw:record.parentRaw}}));
}
export function recordsText(records,options={}){
 return records.map(record=>{
  if(!record.suitePoint)return resultText([record],options);
  const s=record.suitePoint,r=s.request,lines=[`분석 묶음 analysis-suite/1 · ${r.mode==='temperature'?'온도 비교':'말단 비교'} · ${record.id||'현재'}`,
   `원본 전체 선택: ${r.source.selection.start}–${r.source.selection.end} · ${r.source.selection.length} nt · n=${r.n}`,
   `기준 입력 온도: ${r.source.conditions.temperature}°C / 실제 분석 온도: ${s.point.temperature}°C / 온도행 ${s.index+1}`,
   `양 끝 겹침: ${Math.max(0,2*r.n-r.source.selection.length)} nt · 분리한 fragment의 독립 결합이며 전체 말단 풀림/속도가 아닙니다.`];
  for(const c of componentRecords(record)){
   const baseComponent=options.base?componentRecords(options.base).find(b=>b.kind===c.kind):null;
   const diff=c.kind==='full'?null:compareFragments(c.record,baseComponent?.record);
   lines.push('',`${names[c.kind]} · A local ${c.target.aStart}–${c.target.aEnd} / B local ${c.target.bStart}–${c.target.bEnd} · 모든 서열 5′→3′`,
    resultText([c.record],{...options,base:c.kind==='full'?baseComponent?.record:null}));
   if(diff&&options.base)lines.push(`말단 후보−기준 ΔΔG: ${diff.dg===null?'미제공':diff.dg+' kcal/mol'}`,`말단 후보−기준 ΔTm: ${diff.tm===null?'미제공':diff.tm+' °C'}`,...diff.notes);
  }
  return lines.join('\n');
 }).join('\n\n');
}
export function recordsHTML(records,options){return textHTML(recordsText(records,options));}
export function recordsRows(records,options={}){
 const additional=['export_schema_version','analysis_mode','target_kind','source_selection_start','source_selection_end','window_nt','oligo_local_start','oligo_local_end','partner_local_start','partner_local_end','scan_id','scan_point_index','scan_temperature_C','input_temperature_C'];
 const rows=[];let header;
 for(const record of records){
  const s=record.suitePoint,source=s?.request.source||record.request;
  for(const component of componentRecords(record)){
   const base=options.base?componentRecords(options.base).find(x=>x.kind===component.kind):null;
   const compatible=component.kind==='full'||base&&base.record.request.selection.length===component.record.request.selection.length;
   const data=resultRows([component.record],{...options,base:compatible?base?.record:null});
   if(!header)header=[...data[0],...additional];
   const analysisIndex=data[0].indexOf('analysis');
   for(const row of data.slice(1)){
    if(component.kind!=='full'&&!['duplex','duplex_mg0_reference'].includes(row[analysisIndex]))continue;
    const t=component.target;
    if(options.base&&row[analysisIndex]!=='duplex_mg0_reference'){
     row[data[0].indexOf('comparison_base')]=options.base.id||'';
     if(!base)row[data[0].indexOf('comparison_notes')]='기준 결과에 대응하는 말단이 미요청입니다.';
     else if(!compatible)row[data[0].indexOf('comparison_notes')]='말단 길이가 달라 변화량을 제공하지 않습니다.';
    }
    rows.push([...row,'oligo-suite-export/1',s?.request.mode||'basic',component.kind,source.selection.start,source.selection.end,s?.request.n??'',t?.aStart||1,t?.aEnd||source.selection.length,t?.bStart||1,t?.bEnd||source.selection.length,s?.request.mode==='temperature'?s.request.requestId:'',s?s.index+1:'',s?.point.temperature??source.conditions.temperature,source.conditions.temperature]);
   }
  }
 }
 if(!header)header=[...resultRows([],options)[0],...additional];
 return [header,...rows];
}
export function recordsCSV(records,options={}){return '\uFEFF'+recordsRows(records,options).map(row=>row.map(csvCell).join(',')).join('\r\n');}
