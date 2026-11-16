// Entirely synthetic: date effects, detection-band effects and data-quality cases.
// Collection institution is intentionally absent, as in the six-column input.
export function exampleData(){
  const rows=[],dates=['2025-12-15','2026-01-15','2026-02-15'],centers=[18,26,34,39];
  for(let d=0;d<3;d++)for(let b=0;b<4;b++)for(let j=0;j<6;j++){
    const x=centers[b]+(j-2.5)*.55,y=4+.58*x+(d===2?2.3:d===1?.7:0)+(j%3-1)*.65;
    const missed=(b===3&&j<(d===0?1:d===1?2:3))||(b===2&&d===2&&j===0);
    const invalid=d===1&&b===2&&j===5;
    rows.push([`EX-P${String(rows.length+1).padStart(3,'0')}`,dates[d],'Positive',x.toFixed(3),invalid?'Invalid':missed?'ND':'Positive',invalid||missed?'':y.toFixed(3)]);
  }
  for(let d=0;d<3;d++)for(let j=0;j<8;j++){const discordant=j<(d===2?2:d===1?1:0);rows.push([`EX-N${d+1}-${j+1}`,dates[d],'Negative','',discordant?'Positive':'ND',discordant?(25+j).toFixed(3):'']);}
  rows.push(
    ['EX-HIGH-OUTLIER','2026-02-15','Positive','25','Positive','39'],
    ['EX-LOW-OUTLIER','2026-01-15','Positive','32','Positive','8'],
    ['EX-NO-DATE-1','','Positive','23.5','Positive','18.4'],
    ['EX-NO-DATE-2','','Negative','','ND',''],
    ['EX-NO-PRODUCT-VALUE','2026-01-15','Positive','29','Positive',''],
    ['EX-NO-REFERENCE-VALUE','2026-02-15','Positive','','Positive','23'],
    ['EX-NO-PRODUCT-RESULT','2026-02-15','Positive','37','',''],
    ['EX-REFERENCE-INVALID','2026-01-15','Invalid','','ND',''],
    ['EX-DUPLICATE','2026-01-15','Positive','24','Positive','18.2'],
    ['EX-DUPLICATE','2026-02-15','Positive','25.5','Positive','20.1'],
    ['','2026-01-15','Positive','21','Positive','16'],
    ['EX-BAD-DATE','날짜 오류','Positive','22','Positive','17'],
    ['EX-BAD-VALUE','2026-02-15','Positive','값 오류','Positive','20'],
    ['EX-BAD-RESULT','2026-02-15','Positive','31','1','19'],
    ['EX-ND-WITH-VALUE','2026-02-15','Positive','38','ND','30']
  );
  return rows;
}
export const EXAMPLE_DESCRIPTION='합성 예제 111행: 3개 채취일, 4개 검출값 대역, 날짜별 Product 값 이동·고검출값 구간 미검출 증가, 양성/음성 불일치, PI 이탈 후보, Invalid·누락·중복 ID·형식 오류를 포함합니다. 실제 검체나 성능 검증 자료가 아닙니다.';
// Entirely synthetic quantitative example: both methods report log10 copies/mL (same scale).
// Product reads slightly higher as values rise (proportional difference), plus three outliers that
// pull OLS but barely move Passing–Bablok. Fixed pattern; no random numbers.
export function quantitativeExampleData(){
  const rows=[],dates=['2026-03-10','2026-04-10'],wiggle=[0,.09,-.12,.05,-.04,.11,-.08,.02,-.1,.07,-.03,.06];
  for(let i=0;i<60;i++){
    const x=2.1+i*.083,y=-.05+1.06*x+wiggle[i%12]*1.1;
    rows.push([`QX-${String(i+1).padStart(3,'0')}`,dates[i%2],'Positive',x.toFixed(2),'Positive',y.toFixed(2)]);
  }
  rows.push(['QX-OUT-HIGH-1','2026-03-10','Positive','2.60','Positive','4.10'],['QX-OUT-HIGH-2','2026-04-10','Positive','2.90','Positive','4.30'],['QX-OUT-LOW','2026-04-10','Positive','6.85','Positive','5.70']);
  for(let j=0;j<10;j++)rows.push([`QX-NEG-${j+1}`,dates[j%2],'Negative','','ND','']);
  rows.push(['QX-LOW-MISS-1','2026-03-10','Positive','2.05','ND',''],['QX-LOW-MISS-2','2026-04-10','Positive','2.15','ND','']);
  return rows;
}
export const QUANT_EXAMPLE_DESCRIPTION='합성 정량 예제 75행: 두 검사 모두 log10 copies/mL(같은 척도), 값이 커질수록 Product가 조금 높은 비례 차이, 이상값 3개, 음성 10개, 낮은 농도 미검출 2개. 실제 검체나 성능 검증 자료가 아닙니다.';
// Static reading guides shown after an example is loaded. Live numbers are added by the app.
export const EXAMPLE_GUIDES={
  ct:{title:'Ct·Tt 예제에서 볼 것',steps:['입력 모양: 한 행이 검체 1개입니다. Reference 결과·검출값, Product 결과·검출값을 나란히 적고, ND·Invalid는 결과 칸에 쓰고 검출값은 비웁니다.','정성 비교: PPA·NPA와 불일치 검체를 먼저 봅니다. 불일치 버튼으로 해당 검체 목록을 엽니다.','구간별 분석: 높은 Ct 구간에서 Product 미검출이 늘어나는지 봅니다(구간 n이 작다는 점도 함께).','수치 관계: Reference는 Ct, Product는 Tt처럼 척도가 다르므로 상관·OLS로 경향만 봅니다. BA·Passing–Bablok처럼 같은 척도를 전제로 하는 분석에는 쓰지 않습니다.']},
  quant:{title:'정량값 예제에서 볼 것',steps:['먼저 설정: "각 행은 독립 검체 1개당 1쌍" 확인란과 BA 설정의 "같은 측정항목·단위·결과 정의"를 직접 확인해 체크하고, 공통 단위와 Deming의 두 축 단위에 log10 copies/mL을 적은 뒤 분석을 다시 누르세요. 확인란은 사용자가 자료를 보고 체크하는 항목이라 예제가 대신 체크하지 않습니다.','정성 비교: 낮은 농도 2개가 Product에서 미검출(ND)입니다. PPA가 100%가 아닌 이유를 불일치 검체 목록에서 확인하세요.','수치 관계 → 회귀 방법 "Passing–Bablok": 기울기 CI가 1을 포함하는지(비례 차이), 절편 CI가 0을 포함하는지(고정 차이) 봅니다.','같은 화면의 "세 방법 나란히 보기": 이상값 3개 때문에 OLS 기울기는 PB와 달라집니다. 어느 쪽이 맞다고 자동으로 고르지 않으며, 이상값 검체를 검체 목록에서 확인합니다.','BA · 직접 차이: 같은 척도이므로 검체별 차이(Product − Reference)의 평균과 LoA를 봅니다. 값이 커질수록 차이가 커지는 모양이면 PB의 비례 차이와 같은 이야기입니다.','필요하면 "R로 다시 계산해 대조"로 같은 자료를 R(mcr)로 다시 계산해 일치를 확인합니다.']}
};
