// SPDX-License-Identifier: GPL-2.0-or-later
export const FIELDS=['temperature','na','k','nh4','mg','dntp','a','b'];
export function conditionsFromStrings(input){
 const c={};
 for(const k of FIELDS){const s=String(input[k]??'').trim();if(!s||!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)||!Number.isFinite(Number(s)))throw new Error('온도·이온·A/B 농도의 모든 수치 칸을 유한한 수로 입력하세요.');c[k]=Number(s);}
 if(c.temperature<=-273.15)throw new Error('절대온도는 0 K보다 커야 합니다. 입력 가능 여부는 실측 검증 범위를 뜻하지 않습니다.');
 if(['na','k','nh4','mg','dntp'].some(k=>c[k]<0)||c.a<=0||c.b<=0)throw new Error('이온은 0 이상, 각 가닥 농도는 0보다 커야 합니다.');
 if(c.na+c.k+c.nh4<=0&&c.mg<=0)throw new Error('현재 염 모델의 로그 정의역에 들어가지 않습니다. 이온 입력을 확인하세요.');
 if(!Number.isFinite(c.na+c.k+c.nh4))throw new Error('단가염 합계가 유한한 수의 범위를 벗어납니다.');
 return {...c,temperatureK:c.temperature+273.15,monoMm:c.na+c.k+c.nh4};
}
