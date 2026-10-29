// SPDX-License-Identifier: GPL-2.0-or-later
// Fixed, untuned END reference supported by a limited retrospective PCR cohort.
// This does not calibrate a risk probability or provide a dimer-free threshold.
import {validateRawInput} from './pair-loader.mjs';
export const PCR_REFERENCE_EVIDENCE = Object.freeze({
  schemaVersion:'pcr-end-reference/1',model:'primer3-py 2.3.1 THAL / THL_GENERAL / maxLoop30',
  doi:'10.1038/s41598-018-36612-9',source:'Supplementary Table 1, author final Y/N labels',
  sourceWorkbookSha256:'fd5ebdebd955414a7aa20579d5a5c8585ef089486168acd8d1f36f8ec6fa7b60',
  uniquePairs:315,positives:52,negatives:263,pooledAuc:0.8575972506580871,
  minimumObservedPrimerLength:18,maximumObservedPrimerLength:48,
  endpoint:'Visible extensible primer-dimer artefact in the source PCR experiments',
  cohort:'Bisulfite-PCR fusion-primer sets; endpoint gel labels, not qPCR fluorescence or affinity measurements',
  evaluation:'Retrospective external cohort; no new parameter/cutoff fitting',
});
const REFERENCE=Object.freeze({temperatureC:37,monovalentMm:1000,magnesiumMm:0,dntpMm:0,dnaConcentrationNm:250});
const PHYSICAL_FIELDS=Object.freeze(['temperature','na','k','nh4','mg','dntp','a','b']);
const flatEqual=(a,b)=>a===b || (a && b && Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(k=>a[k]===b[k]));
const PLANS=Object.freeze([
  ['AA-3prime-reference',2,'2A'],['BB-3prime-reference',2,'2B'],
  ['AB-A3-reference',2,'A3 versus B'],['AB-B3-reference',3,'B3 versus A'],
]);
export function makePCRReferenceRequests({strandA,strandB,physicalConditions,sourceContext=null}) {
  if(!physicalConditions || Object.keys(physicalConditions).length!==PHYSICAL_FIELDS.length || !PHYSICAL_FIELDS.every(k=>Number.isFinite(physicalConditions[k])))throw new Error('Retain complete original physical inputs separately');
  if(physicalConditions.temperature<0 || physicalConditions.temperature>100 || physicalConditions.a<=0 || physicalConditions.b<=0 || ['na','k','nh4','mg','dntp'].some(k=>physicalConditions[k]<0))throw new Error('Invalid original reaction inputs');
  if(sourceContext!==null && (typeof sourceContext!=='object' || Array.isArray(sourceContext) || Object.values(sourceContext).some(x=>x!==null && (!['string','number','boolean'].includes(typeof x) || (typeof x==='number' && !Number.isFinite(x))))))throw new Error('Source context must be finite flat metadata');
  const original={strandA,strandB,conditions:{...physicalConditions},sourceContext:structuredClone(sourceContext)};
  return PLANS.map(([analysisId,mode,reaction],i)=>{
    const request={analysisId,mode,reaction,strandA:i===1?strandB:strandA,strandB:i===0?strandA:strandB,
      conditions:{...REFERENCE},showStructure:true,purpose:'PCR-3prime-reference',
      physicalInput:structuredClone(original),actualMixtureInterpretation:'reference-only',
      concentrationBasis:'fixed-Primer3-API250nM-not-actual-input-concentration'};
    validateRawInput(request);return request;
  });
}
export function summarizePCRReference(entries) {
  if(!Array.isArray(entries) || entries.length!==4)throw new Error('All four END components are required');
  const original=entries[0]?.calculation?.request?.physicalInput;
  const planned=makePCRReferenceRequests({...original,physicalConditions:original?.conditions});
  const requests=new Map(planned.map(q=>[q.analysisId,q]));
  const expected=new Map(PLANS.map(([id,mode])=>[id,mode]));const seen=new Set();const valid=[];
  for(const {analysisId,calculation:r} of entries) {
    if(!expected.has(analysisId)||seen.has(analysisId)||r?.mode!==expected.get(analysisId))throw new Error('Missing, duplicated, or wrong END component');
    seen.add(analysisId);
    const q=requests.get(analysisId),actual=r.request,physical=actual?.physicalInput;
    if(r.schemaVersion!=='thal-pair/1' || actual?.analysisId!==analysisId || actual.mode!==q.mode || actual.strandA!==q.strandA || actual.strandB!==q.strandB || !flatEqual(actual.conditions,REFERENCE) || actual.purpose!==q.purpose || actual.actualMixtureInterpretation!==q.actualMixtureInterpretation || actual.concentrationBasis!==q.concentrationBasis || physical?.strandA!==original.strandA || physical.strandB!==original.strandB || !flatEqual(physical.conditions,original.conditions) || !flatEqual(physical.sourceContext,original.sourceContext))throw new Error('Components from different primer pairs, inputs, or purposes cannot be mixed');
    if(r.model!==PCR_REFERENCE_EVIDENCE.model || r.basis!=='primer3-api-reference' || !Object.entries(REFERENCE).every(([k,v])=>r.appliedConditions?.[k]===v))throw new Error('Other conditions/models cannot inherit this reference evidence');
    if(!['ok','no-structure'].includes(r.status))throw new Error('Failed components cannot disappear into a healthy score');
    if(r.status==='ok') {
      if(!Number.isFinite(r.thermodynamics?.dg) || r.units?.dg!=='kcal/mol')throw new Error('Invalid component energy/unit');
      valid.push({analysisId,dg:r.thermodynamics.dg});
    }
  }
  const inLengthRange=[original.strandA.length,original.strandB.length].every(n=>n>=18&&n<=48);
  const result={schemaVersion:'pcr-end-reference/1',basis:'fixed-37C-1M-API250nM',
    status:valid.length?'reference-computed':'no-structure-reference',units:'kcal/mol',
    evidenceScope:inLengthRange?'limited-PCR-reference':'outside-observed-length-range',
    actualReactionPrediction:'not-established',probability:null,passFail:null,
    evidence:PCR_REFERENCE_EVIDENCE,
    limitations:['PCR artefact discrimination is different from duplex energy accuracy, occupancy, annealing rate or fluorescence.',
      'One standard reference model condition is used; original user reaction inputs remain separate.',
      'No dimer-free cutoff, individual outcome guarantee, within-target near-candidate or Beacon/LAMP validation is supplied.']};
  if(valid.length){valid.sort((a,b)=>a.dg-b.dg);result.minimumEndReference=valid[0].dg;result.minimumComponent=valid[0].analysisId;}
  return result;
}
