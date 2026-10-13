import {groups,evaluateRow} from './core.mjs';
import {configuration,blandAltman} from './comparison.mjs';
import {baObservation} from './ba-observation.mjs';

export const SPECIMEN_MODES=[['all','현재 표시 범위 전체'],['discordant','정성 불일치'],['ref-missed','Reference 양성 중 Product 음성·ND'],['ref-invalid','Reference 양성 중 Product Invalid'],['ref-missing','Reference 양성 중 Product 미입력'],['issues','누락·확인 사항'],['numeric-excluded','수치쌍 제외'],['ba-loa-outside','BA 95% LoA 밖'],['pi-outliers','OLS PI 이탈'],['pi-unavailable','OLS PI 계산 불가'],['id-excluded','전체 입력 ID 누락 제외'],['format-excluded','전체 입력 형식 오류 제외 (ID 존재)']];
export const specimenModeLabel=mode=>SPECIMEN_MODES.find(([key])=>key===mode)?.[1]||'현재 표시 범위 전체';
export function selectSpecimens(snapshot,selected,mode='all',context=null){
  if(mode==='id-excluded')return snapshot.rows.filter(r=>!r.id);
  if(mode==='format-excluded')return snapshot.rows.filter(r=>r.id&&r.inputErrors.length);
  return selected.filter(r=>{
    if(mode==='all')return true;
    if(mode==='discordant')return ['FP','FN'].includes(r.cls);
    if(mode==='ref-missed')return r.cls==='FN';
    if(mode==='ref-invalid')return r.eligible&&r.ref==='positive'&&r.product==='invalid';
    if(mode==='ref-missing')return r.eligible&&r.ref==='positive'&&r.product==='missing';
    if(mode==='issues')return r.issues.length>0;
    if(mode==='numeric-excluded')return !r.pair;
    if(mode==='ba-loa-outside')return baObservation(r,context).outside;
    const state=evaluateRow(r,snapshot.model).state;
    if(mode==='pi-outliers')return ['상한 이탈','하한 이탈'].includes(state);
    if(mode==='pi-unavailable')return r.pair&&state==='계산 불가';
    return false;
  });
}
export const DEMING_SPECIMEN_NOTE='전체 고정 Deming의 예상 Product와 관측값−예상값(Y방향 차이)입니다. 직접 차이 Product−Reference나 Deming 적합의 가중 거리와 다르며 오류·불합격 판정이 아닙니다.';
export function demingSpecimen(row,model){
  if(!row.pair||!model||model.slope===null||!Number.isFinite(row.x)||!Number.isFinite(row.y))return {fit:null,delta:null};
  const fit=model.intercept+model.slope*row.x,delta=row.y-fit;
  return {fit:Number.isFinite(fit)?fit:null,delta:Number.isFinite(fit)&&Number.isFinite(delta)?delta:null};
}
export const BA_BAND_HEADERS=['Reference 구간','양성 수치쌍 n','평균 차이','차이 SD'];
export const BA_BAND_NOTE='현재 선택 범위 안에서 기존 Reference 경계로 나눈 양성 수치쌍의 요약입니다. Reference로 범위를 선택하면 차이 분포에 영향을 줄 수 있습니다. 구간별 미검출·Invalid는 구간별 분석에서 함께 확인하세요. 비례 편향·성능 우열을 자동 판정하지 않습니다.';
export function baBands(snapshot,selected,config=configuration(snapshot.comparison)){
  if(config.baReasons.length)return null;
  if(!snapshot.ct.length)return [];
  return groups(selected,'ct',snapshot.ct,snapshot.confidence,snapshot.method,snapshot.model).map(g=>{
    const b=blandAltman(g.rows,snapshot.confidence);
    return {label:g.label,n:b.n,bias:b.bias,sd:b.sd};
  });
}
