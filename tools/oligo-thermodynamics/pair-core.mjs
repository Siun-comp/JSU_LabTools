// SPDX-License-Identifier: GPL-2.0-or-later
// Reference requests only; no physical concentration conversion is implied.
import {validateRawInput} from './pair-loader.mjs';
export function makePairSuite({strandA,strandB,physicalConditions,engineReferenceNm,sourceContext=null,includeEnds=false}) {
  if(!physicalConditions || !['temperature','na','k','nh4','mg','dntp','a','b'].every(k=>Number.isFinite(physicalConditions[k]))) throw new Error('Original physical conditions must be finite and complete');
  const c={...physicalConditions};
  if(['na','k','nh4','mg','dntp'].some(k=>c[k]<0) || c.a<=0 || c.b<=0) throw new Error('Original concentrations are invalid');
  if(!Number.isFinite(engineReferenceNm) || engineReferenceNm<=0) throw new Error('Explicit Primer3 reference concentration is required; no automatic A/B conversion');
  const make=(id,mode,a,b,apiConc,reaction)=>{
    const request={mode,strandA:a,strandB:b,showStructure:true,
      conditions:{temperatureC:c.temperature,monovalentMm:c.na+c.k+c.nh4,magnesiumMm:c.mg,dntpMm:c.dntp,dnaConcentrationNm:apiConc},
      analysisId:id,reaction,physicalInput:{strandA,strandB,conditions:c,sourceContext:structuredClone(sourceContext)},
      concentrationBasis:mode===4?'single-molecule-concentration-independent':'explicit-primer3-api-reference',
      actualMixtureInterpretation:mode===4?'independent-strand-hairpin-model':'not-established'};
    validateRawInput(request);return request;
  };
  const requests=[make('A-hairpin',4,strandA,strandA,c.a,'A hairpin'),
    make('B-hairpin',4,strandB,strandB,c.b,'B hairpin'),
    make('A-homodimer',1,strandA,strandA,engineReferenceNm,'2A'),
    make('B-homodimer',1,strandB,strandB,engineReferenceNm,'2B'),
    make('AB-heterodimer',1,strandA,strandB,engineReferenceNm,'A+B')];
  if(includeEnds)requests.push(make('A3-end',2,strandA,strandB,engineReferenceNm,'A3 versus B'),make('B3-end',3,strandA,strandB,engineReferenceNm,'B3 versus A'));
  return {schemaVersion:'thal-reference-suite/1',basis:'primer3-api-reference',decisionUtility:'not-established',requests};
}
