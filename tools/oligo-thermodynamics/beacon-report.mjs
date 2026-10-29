// SPDX-License-Identifier: GPL-2.0-or-later
import {isBeacon,BEACON_IDS,BEACON_NAMES,compareBeacon} from './beacon-core.mjs';
import {recordsText as priorText,recordsRows as priorRows,compareRecords as priorCompare} from './workbench-report.mjs';
import {readableStructure,textHTML} from './structure.mjs';
import {readablePairStructure} from './pair-structure.mjs';
import {csvCell,conditionText} from './report.mjs';
import {UI_VERSION} from './analysis-core.mjs';
export const BEACON_COLUMNS=['beacon_export_schema','beacon_design_type','beacon_stem5_5to3','beacon_recognition_5to3','beacon_stem3_5to3',
 'beacon_assembled_5to3','beacon_regions_json','beacon_target_name','beacon_target_parent_length','beacon_target_start','beacon_target_end',
 'beacon_target_5to3','beacon_target_origin','beacon_generated_from_R','beacon_generated_stale','beacon_intended_site_json','beacon_stem_assessment_json',
 'beacon_recognition_profile_json','beacon_target_profile_json','beacon_alignment_assessment_json','beacon_molecule_roles','beacon_requested_conditions_json',
 'beacon_API_draft','beacon_API_nM','beacon_comparison_json','beacon_state_interpretation'];
export const compareRecords=(a,b)=>isBeacon(a)||isBeacon(b)?{dg:null,tm:null,notes:compareBeacon(a,b).notes}:priorCompare(a,b);
const oldOptions=o=>({...o,base:isBeacon(o.base)?null:o.base});
const json=v=>v===undefined||v===null?'':JSON.stringify(v);
export function beaconStructureText(record,entry,rawOnly=false){
 const r=record.request,d=r.design,v=entry.calculation,head=[`${BEACON_NAMES[entry.analysisId]} · ${entry.status}`,entry.reason||'',
  `R 부모 ${r.parent.name} / ${r.selection?`${r.selection.start}–${r.selection.end}`:'미확정'} · Target 부모 ${d.target.name} / ${d.target.selection?`${d.target.selection.start}–${d.target.selection.end}`:'미확정'}`];
 if(!v){head.push('미실행: 수치/구조를 만들지 않습니다.');return head.join('\n');}
 const c=v.appliedConditions;head.push(`${c.temperatureC}°C / monovalent ${c.monovalentMm} / Mg ${c.magnesiumMm} / dNTP ${c.dntpMm}mM / native dna_conc ${c.dnaConcentrationNm}nM${v.mode===4?' (hairpin 농도 독립)':' (명시적 Dimer API)'}`,
  `입력 역할: ${v.request.input1Role} / ${v.request.input2Role}`);
 if(!v.structure){head.push('구조 미검출은 모든 접힘의 부재/실제 열린 상태를 뜻하지 않습니다.');return head.join('\n');}
 if(rawOnly)return [...head,'THAL 원문 (수정 없음):',v.structure.raw].join('\n');
 head.push(v.mode===4?readableStructure(v.structure.raw,v.request.strandA):readablePairStructure(v.structure,v.request.strandA,v.request.strandB));
 if(v.mode===4){
  if(entry.analysisId==='beacon-hairpin')head.push('영역 좌표 (Beacon local): '+json(d.assembly.regions),'지정 stem 대조: '+json(record.annotations.stem),'인식 영역 단일 구조 서술: '+json(record.annotations.recognition));
  else head.push('Target 단일 구조 서술·부모 대응: '+json(record.annotations.target));
 }else head.push('반환 접촉의 local/Beacon/부모R/부모Target 좌표: '+json(record.annotations[entry.analysisId==='beacon-target-any'?'beaconTarget':'recognitionTarget']));
 return head.join('\n');
}
function oneText(record,options){
 const r=record.request,d=r.design,lines=[`JSU LabTools · Conventional Beacon · ${record.id||'현재'} · ${record.calculatedAt||''}`,`도구 ${UI_VERSION} / beacon-workbench/1`,
  `R 부모: ${r.parent.name} (${r.parent.normalizedLength}nt) / 선택 ${r.selection?`${r.selection.start}–${r.selection.end}`:'미확정'}`,
  `S5 5′→3′ ${d.s5.sequence}`,`R 5′→3′ ${d.recognition.sequence}`,`S3 5′→3′ ${d.s3.sequence} (${r.inputs.stem3Mode})`,
  `Beacon ${d.assembly.length}nt 5′→3′ ${d.assembly.sequence||'미완성'}`,`영역 좌표: ${json(d.assembly.regions)}`,
  `Target ${d.target.name} / 부모 ${d.target.parentLength}nt / 선택 ${d.target.selection?`${d.target.selection.start}–${d.target.selection.end}`:'미확정'} / ${d.target.origin}`,
  `Target 5′→3′ ${d.target.sequence}`,`Target 생성 당시R: ${d.target.generatedFromRecognition||'해당 없음'} / 현재R와 다름: ${d.target.generatedStale}`,
  `의도 site: ${json(d.site)}`,conditionText(r.conditions),`명시적 API: ${d.api.raw||'미입력'} nM · 실제 A=Beacon/B=Target와 별도`,
  `모델 ${r.contract.model}`,`manifest ${r.contract.manifest} / WASM ${r.contract.wasm}`,`역할 ${r.role||'미지정'} / 메모 (효과 미반영): ${r.memo||'없음'}`,
  ...record.limitations];
 if(options.includeParent)lines.push('R 계산 당시 전체 원문 (명시적 포함):',record.parentRaw||'','Target 계산 당시 전체 원문 (명시적 포함):',record.targetRaw||'');
 const differences=options.base?compareBeacon(record,options.base):null;
 if(differences)lines.push(`비교 기준: ${options.base.id||'선택'}`,...differences.notes);
 for(const e of record.entries){lines.push('',`${BEACON_NAMES[e.analysisId]} · ${e.status}`,e.reason||'');
  if(e.calculation?.thermodynamics)for(const k of ['dg','tm','dh','ds'])lines.push(`${k}: ${e.calculation.thermodynamics[k]} ${e.calculation.units[k]}`);
  const diff=differences?.analyses[e.analysisId];if(diff)lines.push(`후보−기준 ΔΔG ${diff.dg===null?'미제공':diff.dg+' kcal/mol'} / ΔTm ${diff.tm===null?'미제공':diff.tm+'°C'}`,diff.reason);
  lines.push(beaconStructureText(record,e));
 }return lines.join('\n');
}
export function recordsText(records,options={}){return records.map(r=>isBeacon(r)?oneText(r,options):priorText([r],oldOptions(options))+(isBeacon(options.base)?`\n기준 ${options.base.id||'Beacon'}: 다른 작업/반응과 자동 차감하지 않습니다.`:'')).join('\n\n');}
export function recordsHTML(records,options={}){return textHTML(recordsText(records,options));}
export function recordsRows(records,options={}){
 if(!records.some(isBeacon)&&!isBeacon(options.base))return priorRows(records,options);
 const non=records.filter(r=>!isBeacon(r)),previous=priorRows(non,oldOptions(options)),header=previous[0];
 const extra=[...BEACON_COLUMNS,...(options.includeParent?['beacon_target_raw_explicitly_included']:[])],rows=[];
 for(const record of records){
  if(!isBeacon(record)){
   const data=priorRows([record],oldOptions(options));
   for(const row of data.slice(1)){
    const mapped=Object.fromEntries(data[0].map((h,i)=>[h,row[i]]));
    if(isBeacon(options.base)){mapped.comparison_base=options.base.id||'Beacon';mapped.comparison_notes='Beacon과 다른 작업/반응의 모델값은 자동 차감하지 않습니다.';}
    rows.push([...header.map(h=>mapped[h]??''),...extra.map(()=> '')]);
   }continue;
  }
  const r=record.request,d=r.design,comparison=options.base?compareBeacon(record,options.base):null;
  for(const e of record.entries){const v=e.calculation,q=v?.request,c=v?.appliedConditions,t=v?.thermodynamics||{},s=v?.structure;
   const alignment=e.analysisId==='beacon-target-any'?record.annotations.beaconTarget:e.analysisId==='recognition-target-any'?record.annotations.recognitionTarget:null;
   const diff=comparison?.analyses[e.analysisId],state=e.analysisId==='beacon-hairpin'?record.annotations.stem.status:e.analysisId.endsWith('-any')?alignment?.status:e.status;
   const values={result_id:record.id||'current',calculated_at:record.calculatedAt,tool_version:UI_VERSION,parent_name:r.parent.name,parent_length_nt:r.parent.normalizedLength,
    parent_start_inclusive:r.selection?.start,parent_end_inclusive:r.selection?.end,independent_length_nt:d.recognition.sequence.length,role:r.role,A_5to3:q?.strandA,B_5to3:q?.strandB,
    temperature_C:c?.temperatureC,Na_mM:c?r.conditions.na:null,K_mM:c?r.conditions.k:null,NH4_mM:c?r.conditions.nh4:null,Mg_total_mM:c?.magnesiumMm,dNTP_total_mM:c?.dntpMm,A_nM:r.conditions.a,B_nM:r.conditions.b,
    analysis:e.analysisId,status:e.status,reason:e.reason,dG_kcal_mol:t.dg,Tm_C:t.tm,dH_kcal_mol:t.dh,dS_cal_mol_K:t.ds,Tm_minus_temperature_C:t.tm===undefined?'':t.tm-c.temperatureC,
    duplex_model:r.contract.model,hairpin_model:r.contract.model,engine_version:r.contract.engineVersion,manifest_SHA256:r.contract.manifest,WASM_SHA256:r.contract.wasm,
    applied_values:json(c),structure:s?.raw,notes_and_limitations:record.limitations.join('\n'),reaction_memo:r.memo,comparison_base:options.base?.id,
    duplex_ddG_kcal_mol:null,duplex_dTm_C:null,comparison_notes:[...(comparison?.notes||[]),diff?.reason||''].join('\n'),
    result_basis:v?'THAL-beacon-model/API-reference':'not-executed',input_Mg_total_mM:r.conditions.mg,parent_raw_explicitly_included:record.parentRaw,
    structure_format_version:s?.format,structure_parse_status:s?.status||'not-returned',structure_dot_bracket:s?.dotBracket,structure_pairs_1based:s?.status==='ok'?json(s.pairs):'',
    export_schema_version:'beacon-export/1',analysis_mode:'beacon',target_kind:e.analysisId,source_selection_start:r.selection?.start,source_selection_end:r.selection?.end,
    oligo_local_start:q?1:null,oligo_local_end:q?.strandA.length,partner_local_start:q?1:null,partner_local_end:q?.strandB.length,input_temperature_C:r.conditions.temperature,
    pair_contract:v?'thal-pair/1':'',reaction:q?.reaction,thal_mode:v?.mode,engine_dna_concentration_nM:c?.dnaConcentrationNm,actual_mixture_interpretation:q?.actualMixtureInterpretation,
    applied_monovalent_mM:c?.monovalentMm,reference_purpose:'Conventional Beacon model reference',pair_coordinates_with_parent:alignment?json(alignment.contacts):'',
    pair_engine_manifest_SHA256:r.contract.manifest,pair_engine_WASM_SHA256:r.contract.wasm,source_A_5to3:d.assembly.sequence,source_B_5to3:d.target.sequence};
   const ext=['beacon-export/1','conventional',d.s5.sequence,d.recognition.sequence,d.s3.sequence,d.assembly.sequence,json(d.assembly.regions),d.target.name,d.target.parentLength,
    d.target.selection?.start,d.target.selection?.end,d.target.sequence,d.target.origin,d.target.generatedFromRecognition,d.target.generatedStale,json(d.site),json(record.annotations.stem),
    json(record.annotations.recognition),json(record.annotations.target),json(alignment),q?`${q.input1Role} / ${q.input2Role}`:'',json(r.conditions),d.api.raw,d.api.value,
    json(diff),state,...(options.includeParent?[record.targetRaw||'']:[])];
   rows.push([...header.map(h=>values[h]??''),...ext]);
  }
 }
 return [[...header,...extra],...rows];
}
export function recordsCSV(records,options={}){return '\uFEFF'+recordsRows(records,options).map(row=>row.map(csvCell).join(',')).join('\r\n');}
