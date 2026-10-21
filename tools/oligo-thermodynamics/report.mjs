// SPDX-License-Identifier: GPL-2.0-or-later
import {UI_VERSION,compare,hasTm} from './analysis-core.mjs';
export const STATUS={'ok':'모델 계산 완료','tm-only':'Tm만 계산','unsupported':'모델 미지원','no-structure':'구조 미검출','error':'분석 오류'};
const label={duplex:'Duplex · 고정 완전 상보',hairpinA:'A hairpin · Primer3',hairpinB:'B hairpin · Primer3'};
export function display(n){if(!Number.isFinite(n))return '—';if(n!==0&&Math.abs(n)<=.001)return n.toExponential(2);return n.toFixed(2);}
export function conditionText(c){return `반응 ${c.temperature}°C · Na⁺ ${c.na}/K⁺ ${c.k}/NH₄⁺ ${c.nh4}/Mg total ${c.mg}/dNTP total ${c.dntp} mM · A ${c.a}/B ${c.b} nM`;}
export function resultText(records,{base=null,includeParent=false}={}){
 const lines=[`JSU LabTools · Oligo Thermodynamics ${UI_VERSION}`,'모델 계산 결과 · 실험 정확도 인증/반응 속도 예측 아님'];
 for(const record of records){
  const r=record.request,c=r.conditions;
  lines.push('',`결과: ${record.id||'현재'} · 계산 시각 ${record.calculatedAt}`,`원본: ${r.parent.name} · 정규화 ${r.parent.normalizedLength} nt`,`원본 좌표: ${r.selection.start}–${r.selection.end} (1-based inclusive) · 독립 oligo 1–${r.selection.length}`,`선택 이름/역할: ${r.role||'미지정'}`,`A 5′→3′: ${r.strandA}`,`B 완전 상보 5′→3′: ${r.strandB}`,conditionText(c),`반응 메모 (효과 미반영): ${r.memo||'없음'}`,`요청 ${r.requestId} / revision ${r.revision}`);
  for(const key of ['duplex','hairpinA','hairpinB']){
   const v=record[key];lines.push(`${label[key]}: ${STATUS[v.status]}`);
   if(v.status==='ok')lines.push(`ΔG°(${c.temperature}°C): ${v.dg} kcal/mol`,`Tm: ${v.tm} °C`,`ΔH°: ${v.dh} kcal/mol`,`ΔS°: ${v.ds} cal/(mol·K)`,`Tm−반응 온도: ${v.tm-c.temperature} °C`);
   if(v.status==='tm-only')lines.push(`Tm: ${v.tm} °C`,`Tm−반응 온도: ${v.tm-c.temperature} °C`,'ΔG° / ΔH° / ΔS°: 미지원 (Tm 보정에서 에너지를 역산하지 않음)');
   if(v.reason)lines.push(`사유: ${v.reason}`);
   if(v.notes)lines.push(...v.notes);
   if(v.structure)lines.push('구조(THAL 반환):',v.structure.trimEnd());
  }
  const reference=record.duplexMgZeroReference;
  if(reference){const v=reference.result;lines.push('참고 · Mg=0 duplex (입력 Mg 효과 제외)',conditionText(reference.conditions),reference.note,`참고 계산 상태: ${STATUS[v.status]}`);
   if(v.status==='ok')lines.push(`참고 ΔG°(${c.temperature}°C, Mg=0): ${v.dg} kcal/mol`,`참고 ΔH°(Mg=0): ${v.dh} kcal/mol`,`참고 ΔS°(Mg=0): ${v.ds} cal/(mol·K)`,`참고 Tm(Mg=0): ${v.tm} °C`);
   if(v.reason)lines.push('참고 계산 사유: '+v.reason);lines.push('참고 모델: '+(v.model||r.contract.duplex));
  }
  lines.push('입력 조건의 적용값: '+JSON.stringify(record.applied),`Duplex 모델: ${record.duplex.model||r.contract.duplex}`,`Hairpin 모델: ${r.contract.hairpin}`,`엔진: ${r.contract.engineVersion}`,`manifest SHA-256: ${r.contract.manifest}`,`WASM SHA-256: ${r.contract.wasm}`,`Duplex 모듈 SHA-256: ${r.contract.duplexSHA}`,`Sequence 모듈 SHA-256: ${r.contract.sequenceSHA}`,...record.limitations.map(x=>'한계: '+x));
  if(base){const d=compare(record,base);lines.push(`비교 기준: ${base.id}`,`Duplex ΔΔG(후보−기준): ${d.dg===null?'미제공':d.dg+' kcal/mol'}`,`Duplex ΔTm(후보−기준): ${d.tm===null?'미제공':d.tm+' °C'}`,...d.notes);}
  if(includeParent)lines.push('사용자가 포함한 계산 당시 전체 원문:',record.parentRaw);
 }
 return lines.join('\n');
}
export function csvCell(value){
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('유한한 수만 내보낼 수 있습니다.');return String(value);}
 let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function resultCSV(records,{base=null,includeParent=false}={}){
 const headers=['result_id','calculated_at','tool_version','parent_name','parent_length_nt','parent_start_inclusive','parent_end_inclusive','independent_length_nt','role','A_5to3','B_5to3','temperature_C','Na_mM','K_mM','NH4_mM','Mg_total_mM','dNTP_total_mM','A_nM','B_nM','analysis','status','reason','dG_kcal_mol','Tm_C','dH_kcal_mol','dS_cal_mol_K','Tm_minus_temperature_C','duplex_model','hairpin_model','engine_version','manifest_SHA256','WASM_SHA256','duplex_module_SHA256','sequence_module_SHA256','applied_values','structure','notes_and_limitations','reaction_memo','comparison_base','duplex_ddG_kcal_mol','duplex_dTm_C','comparison_notes','result_basis','input_Mg_total_mM',...(includeParent?['parent_raw_explicitly_included']:[])];
 const rows=[headers];
 for(const record of records){const r=record.request,d=base?compare(record,base):null,reference=record.duplexMgZeroReference;
  const analyses=['duplex','hairpinA','hairpinB'].map(key=>({key,v:record[key],c:r.conditions,ref:false}));
  if(reference)analyses.push({key:'duplex_mg0_reference',v:reference.result,c:reference.conditions,ref:true});
  for(const {key,v,c,ref} of analyses){const ok=v.status==='ok',tm=hasTm(v),basis=ref?'Mg=0 참고 · 입력 Mg 효과 제외':'입력 조건',applied=ref?{basis,conditions:c,inputMgTotalMm:r.conditions.mg}:record.applied;rows.push([
   record.id||'current',record.calculatedAt,UI_VERSION,r.parent.name,r.parent.normalizedLength,r.selection.start,r.selection.end,r.selection.length,r.role,r.strandA,r.strandB,c.temperature,c.na,c.k,c.nh4,c.mg,c.dntp,c.a,c.b,key,ref?'Mg=0 참고 · '+STATUS[v.status]:STATUS[v.status],ref?reference.note+(v.reason?' '+v.reason:''):v.reason||'',ok?v.dg:'',tm?v.tm:'',ok?v.dh:'',ok?v.ds:'',tm?v.tm-c.temperature:'',ref?(v.model||r.contract.duplex):(record.duplex.model||r.contract.duplex),r.contract.hairpin,r.contract.engineVersion,r.contract.manifest,r.contract.wasm,r.contract.duplexSHA,r.contract.sequenceSHA,JSON.stringify(applied),v.structure||'',[...(v.notes||[]),...record.limitations].join('\n'),r.memo,ref?'':base?.id||'',key==='duplex'&&d?.dg!==null&&d?d.dg:'',key==='duplex'&&d?.tm!==null&&d?d.tm:'',ref?'Mg=0 참고값은 실제 Mg 조건의 ΔΔG에 사용하지 않습니다.':d?.notes.join('\n')||'',basis,r.conditions.mg,...(includeParent?[record.parentRaw]:[])
  ]);}
 }
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
