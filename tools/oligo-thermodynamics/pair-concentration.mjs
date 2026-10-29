// SPDX-License-Identifier: GPL-2.0-or-later
// Algebraic matching of an ideal two-state concentration term only.
// Does not modify upstream entropy, calibrate THAL, or predict mixture occupancy.
export function concentrationTermConvention({mode,strandA,strandB,reaction,aTotalNm,bTotalNm}) {
  const fail=reason=>({schemaVersion:'thal-concentration-convention/1',status:'unsupported',reason});
  if(![1,2,3,4].includes(mode) || typeof strandA!=='string' || typeof strandB!=='string' || !/^[ACGT]{2,60}$/.test(strandA) || !/^[ACGT]{2,60}$/.test(strandB))return fail('Unsupported sequences or THAL mode');
  if(mode===4)return strandA!==strandB?fail('Hairpin must refer to one independent strand'):{schemaVersion:'thal-concentration-convention/1',status:'not-required',reason:'Single-molecule hairpin: concentration log term is zero'};
  if(!Number.isFinite(aTotalNm)||aTotalNm<=0||!Number.isFinite(bTotalNm)||bTotalNm<=0)return fail('Both original concentrations must be finite and positive');
  let effective;
  if(reaction==='A+B') {
    if(strandA===strandB)return fail('Identical sequence in two input fields does not define two distinct unmodified chemical species; specify the species/pooling model first');
    effective=Math.max(aTotalNm,bTotalNm)-Math.min(aTotalNm,bTotalNm)/2;
  } else if(reaction==='2A' || reaction==='2B') {
    if(strandA!==strandB)return fail('A homodimer request must contain the same sequence twice');
    effective=reaction==='2A'?aTotalNm:bTotalNm;
  } else return fail('Reaction stoichiometry must be explicit');
  const rc=seq=>[...seq].reverse().map(b=>({A:'T',T:'A',C:'G',G:'C'})[b]).join('');
  const bothSelfComplementary=strandA===rc(strandA)&&strandB===rc(strandB);
  const divisor=bothSelfComplementary?1:4;
  const api=effective*divisor;
  if(!Number.isFinite(api)||api<=0)return fail('Concentration term is outside finite numerical range');
  return {schemaVersion:'thal-concentration-convention/1',status:'matched-under-assumptions',
    basis:'ideal-two-state-log-term',reaction,physicalInputNm:{a:aTotalNm,b:bTotalNm},
    effectiveConcentrationNm:effective,primer3BranchDivisor:divisor,primer3ReferenceConcentrationNm:api,
    meaning:'Only the mass-action logarithmic concentration term is matched to the pinned source branch.',
    actualMixtureInterpretation:'not-established',experimentalValidation:'not-established',
    assumptions:['Single selected duplex state and ideal dilute activities.',
      'Upstream reaction standard state, entropy symmetry/degeneracy and parameters are retained; this function does not correct them.',
      'No competing folds/dimers, enzyme effects, labels or pooled identical-species interpretation.']};
}
