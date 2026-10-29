// SPDX-License-Identifier: GPL-2.0-or-later
import {recordsText as legacyText,recordsCSV as legacyCSV,recordsRows as legacyRows} from './suite-report.mjs';
import {csvCell,conditionText} from './report.mjs';
import {readablePairStructure} from './pair-structure.mjs';
import {readableStructure,textHTML} from './structure.mjs';
import {isPair,compareWorkbench,PAIR_NAMES} from './pair-workbench-core.mjs';
import {UI_VERSION,compare} from './analysis-core.mjs';
export const compareRecords=(a,b)=>isPair(a)||isPair(b)?compareWorkbench(a,b):compare(a,b);
const legacyOptions=options=>({...options,base:isPair(options.base)?null:options.base});
export function entryCoordinates(entry,request){
 const r=entry.calculation,s=r.structure;if(s?.status!=='ok')return [];
 const species=entry.reaction==='2A'?['A','A']:entry.reaction==='2B'?['B','B']:r.mode===4?[entry.analysisId==='A-hairpin'?'A':'B']:['A','B'];
 const original=(kind,pos)=>kind==='A'?request.selection.start+pos-1:request.partner.mode==='complement'?request.selection.end-pos+1:null;
 return s.pairs.map(p=>r.mode===4?{...p,species:species[0],parentLeft:original(species[0],p.left),parentRight:original(species[0],p.right)}:
  {...p,input1Species:species[0],input2Species:species[1],parentInput1:original(species[0],p.a),parentInput2:original(species[1],p.b)});
}
export function entryStructureText(entry,request,{rawOnly=false}={}){
 const r=entry.calculation,q=r.request,c=r.appliedConditions,head=[`${PAIR_NAMES[entry.analysisId]} · ${entry.reaction}`,
  `THAL mode ${r.mode} · ${c.temperatureC}°C / monovalent ${c.monovalentMm} / Mg ${c.magnesiumMm} / dNTP ${c.dntpMm} mM / API ${c.dnaConcentrationNm} nM`,
  `A 원본: ${request.parent.name} ${request.selection.start}–${request.selection.end} · B: ${request.partner.mode==='manual'?'직접 입력·원본 좌표 없음':'완전상보·원본 대응은 역방향'}`];
 if(!r.structure)return [...head,'구조 미검출: 수치0/빈 pair 구조를 만들지 않습니다.'].join('\n');
 if(rawOnly)return [...head,'THAL 원문 (수정 없음):',r.structure.raw].join('\n');
 head.push(r.mode===4?readableStructure(r.structure.raw,q.strandA):readablePairStructure(r.structure,q.strandA,q.strandB));
 if(r.mode!==4)head.push('원문 A/B는 해당 반응의 두 입력 사본입니다. AA/BB는 같은 oligo 두 분자입니다.');
 head.push('원본 대응 좌표 (folding 계산 범위 확장이 아님):',JSON.stringify(entryCoordinates(entry,request)));
 return head.join('\n');
}
function pairText(record,options){
 const r=record.request,lines=[`JSU LabTools · 두 가닥 THAL · ${record.id||'현재'}`,`도구 ${UI_VERSION} · ${record.calculatedAt||''}`,
  `A 원본: ${r.parent.name} · 전체 ${r.parent.normalizedLength}nt 중 ${r.selection.start}–${r.selection.end} → local1–${r.selection.length}`,
  `A 5′→3′ ${r.strandA}`,`B 5′→3′ ${r.strandB}`,`B: ${r.partner.mode==='manual'?'직접 입력':'완전상보 연동'} · ${r.partner.name||'이름 없음'}`,
  `역할: ${r.role||'미지정'}`,conditionText(r.conditions),`명시적 Primer3 API 농도: ${r.options.engineReferenceNm}nM · 실제 A/B 합계/평균 자동 변환 없음`,
  `모델: ${r.contract.model}`,`manifest SHA256 ${r.contract.manifest}`,`WASM SHA256 ${r.contract.wasm}`,`메모 (미반영): ${r.memo||'없음'}`,...record.limitations];
 if(options.includeParent)lines.push('계산 당시 전체 원문 (명시적 포함):',record.parentRaw||'');
 for(const [label,entries] of [['입력 온도·이온 · THAL 모델',record.entries],['별도 선택 · PCR 고정37°C/1M/API250nM 참고',record.referenceEntries]]){
  if(!entries.length)continue;lines.push('',label);
  for(const e of entries){const v=e.calculation;lines.push('',`${PAIR_NAMES[e.analysisId]} · ${v.status}`);
   if(v.status==='ok')for(const k of ['dg','tm','dh','ds'])lines.push(`${k}: ${v.thermodynamics[k]} ${v.units[k]}`);
   lines.push(entryStructureText(e,r));}
 }
 if(record.pcrReference)lines.push('PCR 참고 집계 (실제 반응값과 별도):',JSON.stringify(record.pcrReference),
  '후향적 한정 PCR자료의 선별 참고입니다. 개별 발생 확률·무dimer cutoff·LAMP/Beacon/형광·실제Mg 에너지 정확도 인증이 아닙니다.');
 if(options.base){const d=compareRecords(record,options.base);lines.push(`기준: ${options.base.id||'선택'}`,
  `A/B ANY 후보−기준 ΔΔG: ${d.dg===null?'미제공':d.dg+' kcal/mol'}`,`A/B ANY ΔTm: ${d.tm===null?'미제공':d.tm+' °C'}`,...d.notes);}
 return lines.join('\n');
}
export function recordsText(records,options={}){return records.map(r=>isPair(r)?pairText(r,options):legacyText([r],legacyOptions(options))+(isPair(options.base)?`\n기준: ${options.base.id||'두 가닥 결과'} · NN4/말단/온도와 THAL 결과는 자동 차감하지 않습니다.`:'')).join('\n\n');}
export function recordsHTML(records,options={}){return textHTML(recordsText(records,options));}
const additional=['pair_contract','partner_mode','partner_name','reaction','thal_mode','engine_dna_concentration_nM','actual_mixture_interpretation',
 'applied_monovalent_mM','reference_purpose','pcr_minimum_END_kcal_mol','pcr_evidence_scope','pair_coordinates_with_parent','pair_engine_manifest_SHA256','pair_engine_WASM_SHA256','source_A_5to3','source_B_5to3'];
export function recordsRows(records,options={}){
 if(records.every(r=>!isPair(r))&&!isPair(options.base))return legacyRows(records,legacyOptions(options));
 const header=legacyRows([],legacyOptions(options))[0],rows=[];
 for(const record of records){
  if(!isPair(record)){for(const row of legacyRows([record],legacyOptions(options)).slice(1)){
   if(isPair(options.base)){row[header.indexOf('comparison_base')]=options.base.id||'두 가닥 결과';row[header.indexOf('comparison_notes')]='NN4/말단/온도와 THAL 결과는 자동 차감하지 않습니다.';}
   rows.push([...row,...additional.map(()=> '')]);}continue;}
  const r=record.request,d=options.base?compareRecords(record,options.base):null;
  for(const [reference,entries] of [[false,record.entries],[true,record.referenceEntries]])for(const e of entries){
   const v=e.calculation,c=v.appliedConditions,t=v.thermodynamics||{},isAB=!reference&&e.analysisId==='AB-heterodimer',structure=v.structure;
   const values={result_id:record.id||'current',calculated_at:record.calculatedAt,tool_version:UI_VERSION,parent_name:r.parent.name,parent_length_nt:r.parent.normalizedLength,
    parent_start_inclusive:r.selection.start,parent_end_inclusive:r.selection.end,independent_length_nt:r.selection.length,role:r.role,A_5to3:v.request.strandA,B_5to3:v.request.strandB,
    temperature_C:c.temperatureC,Na_mM:reference?1000:r.conditions.na,K_mM:reference?0:r.conditions.k,NH4_mM:reference?0:r.conditions.nh4,Mg_total_mM:c.magnesiumMm,dNTP_total_mM:c.dntpMm,A_nM:r.conditions.a,B_nM:r.conditions.b,
    analysis:e.analysisId,status:v.status,dG_kcal_mol:t.dg,Tm_C:t.tm,dH_kcal_mol:t.dh,dS_cal_mol_K:t.ds,Tm_minus_temperature_C:t.tm===undefined?'':t.tm-c.temperatureC,
    duplex_model:v.model,hairpin_model:v.model,engine_version:r.contract.engineVersion,manifest_SHA256:r.contract.manifest,WASM_SHA256:r.contract.wasm,
    applied_values:JSON.stringify(c),structure:structure?.raw,notes_and_limitations:record.limitations.join('\n'),reaction_memo:r.memo,
    comparison_base:reference?'':options.base?.id,duplex_ddG_kcal_mol:isAB?d?.dg:null,duplex_dTm_C:isAB?d?.tm:null,comparison_notes:reference?'고정 PCR 참고값과 입력 조건의 자동 차이를 만들지 않습니다.':d?.notes.join('\n'),
    result_basis:reference?'fixed-37C-1M-API250nM':'input-temperature-ions-THAL/API-reference',input_Mg_total_mM:r.conditions.mg,
    structure_format_version:structure?.format,structure_parse_status:structure?.status||'not-returned',structure_dot_bracket:structure?.dotBracket,structure_pairs_1based:structure?.status==='ok'?JSON.stringify(structure.pairs):'',
    export_schema_version:'oligo-pair-export/1',analysis_mode:'pair',target_kind:e.analysisId,source_selection_start:r.selection.start,source_selection_end:r.selection.end,
    oligo_local_start:1,oligo_local_end:v.request.strandA.length,partner_local_start:1,partner_local_end:v.request.strandB.length,input_temperature_C:r.conditions.temperature,
    parent_raw_explicitly_included:record.parentRaw};
   const extra=['pair-workbench/1',r.partner.mode,r.partner.name,e.reaction,v.mode,c.dnaConcentrationNm,v.request.actualMixtureInterpretation,c.monovalentMm,
    reference?'PCR-3prime-reference':'THAL-model',reference?record.pcrReference?.minimumEndReference:null,reference?record.pcrReference?.evidenceScope:'',JSON.stringify(entryCoordinates(e,r)),r.contract.manifest,r.contract.wasm,r.strandA,r.strandB];
   rows.push([...header.map(k=>values[k]??''),...extra]);
  }
 }
 return [[...header,...additional],...rows];
}
export function recordsCSV(records,options={}){return '\uFEFF'+recordsRows(records,options).map(row=>row.map(csvCell).join(',')).join('\r\n');}
