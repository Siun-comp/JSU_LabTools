// Classify unrounded direct differences using the current selected BA result.
// These are observations, never automatic exclusions or acceptance decisions.
export const BA_LABELS={inside:'95% LoA 안',below:'95% LoA 하한 미만',above:'95% LoA 상한 초과',unavailable:'LoA 계산 불가',excluded:'수치쌍 제외'};
export const BA_COLORS={inside:'#2b679a',outside:'#b85b38'};
export function baObservation(row,context){
  const {ba,config={}}=context||{},difference=row.pair&&Number.isFinite(row.x)&&Number.isFinite(row.y)?row.y-row.x:null;
  const valid=difference!==null&&Number.isFinite(difference);
  const limits=ba?.loa,available=Array.isArray(limits)&&limits.length===2&&limits.every(Number.isFinite);
  const state=!valid?'excluded':!available?'unavailable':difference<limits[0]?'below':difference>limits[1]?'above':'inside';
  const tolerance=!valid?'수치쌍 제외':!ba?'적용 조건 미확인':!Number.isFinite(config.lower)||!Number.isFinite(config.upper)?'미사용':difference<config.lower?'사전 허용 하한 미만':difference>config.upper?'사전 허용 상한 초과':'사전 허용 범위 안';
  return {difference:valid?difference:null,state,label:BA_LABELS[state],outside:state==='below'||state==='above',tolerance};
}
export function baObservations(context){
  const pairs=context?.ba?.pairs||[],rows=pairs.map(row=>({...row,...baObservation(row,context)}));
  const count=state=>rows.filter(row=>row.state===state).length;
  return {rows,n:pairs.length,inside:count('inside'),below:count('below'),above:count('above'),outside:count('below')+count('above'),available:Array.isArray(context?.ba?.loa)&&context.ba.loa.length===2&&context.ba.loa.every(Number.isFinite)};
}
