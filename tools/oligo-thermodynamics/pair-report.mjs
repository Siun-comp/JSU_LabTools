// SPDX-License-Identifier: GPL-2.0-or-later
import {readablePairStructure} from './pair-structure.mjs';
import {readableStructure,textHTML} from './structure.mjs';
export function referenceText(result) {
  const lines=['Phase3R Primer3 adapter — 내부 기준 계산',
    'basis: '+result.basis,'실험 판단 지원성: 미확립. 실제 농도의 평형·후보 순위·속도·형광이 아닙니다.'];
  for(const entry of result.entries) {
    const r=entry.calculation,c=r.appliedConditions,p=r.request.physicalInput;
    lines.push('',entry.analysisId+' / '+entry.reaction,'모델: '+r.model,
      `Primer3 API dna_conc ${c.dnaConcentrationNm} nM / 입력 A ${p.conditions.a} nM / 입력 B ${p.conditions.b} nM`,
      `적용 온도 ${c.temperatureC} °C / 단가염 ${c.monovalentMm} mM / Mg total ${c.magnesiumMm} mM / dNTP total ${c.dntpMm} mM`,
      '실제 혼합물 해석: '+r.request.actualMixtureInterpretation,'상태: '+r.status);
    if(r.thermodynamics)for(const key of ['tm','dg','dh','ds'])lines.push(`${key}: ${r.thermodynamics[key]} ${r.units[key]}`);
    if(r.structure)lines.push(r.mode===4?readableStructure(r.structure.raw,r.request.strandA):readablePairStructure(r.structure,r.request.strandA,r.request.strandB));
  }
  return lines.join('\n');
}
export function referenceHTML(result) {return textHTML(referenceText(result));}
function cell(value) {
  let s=value===undefined||value===null?'':String(value);
  if(/^[\s]*[=+@-]/.test(s) && !Number.isFinite(Number(s)))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function referenceCSV(result) {
  const header=['analysis','reaction','status','result_basis','decision_utility','mode','engine_dna_concentration_nM',
    'input_A_nM','input_B_nM','actual_mixture_interpretation','temperature_C','monovalent_mM','Mg_total_mM','dNTP_total_mM',
    'Tm_C','dG_kcal_mol','dH_kcal_mol','dS_cal_mol_K','strand_A_5to3','strand_B_5to3','pair_coordinates_each_input_1based','structure_status'];
  const rows=result.entries.map(e=>{
    const r=e.calculation,c=r.appliedConditions,p=r.request.physicalInput;
    return [e.analysisId,e.reaction,r.status,r.basis,r.decisionUtility,r.mode,c.dnaConcentrationNm,p.conditions.a,p.conditions.b,
      r.request.actualMixtureInterpretation,c.temperatureC,c.monovalentMm,c.magnesiumMm,c.dntpMm,
      ...['tm','dg','dh','ds'].map(k=>r.thermodynamics?.[k]),r.request.strandA,r.request.strandB,
      r.structure?.status==='ok'?JSON.stringify(r.structure.pairs):'',r.structure?.status||'not-requested'];
  });
  return [header,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
