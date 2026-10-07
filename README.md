# JSU LabTools

분자진단 개발 업무용 개인 분석 도구 포털입니다. 포털 v1.3.0.

| 도구 | 도구 버전 / 계산 식별 |
|---|---|
| Oligo Mix | 1.0.1 / 알고리즘 0.5.0 |
| Sequence | 1.0.1 / 알고리즘 0.2.2 |
| 시약·버퍼 조제 | 1.1.1 / 조제 0.2.0 · 보조 계산 0.3.0 |
| 핵산 농도·Copy 수 | 1.1.0 / 알고리즘 0.3.0 |
| Amplification Analysis | 0.1.0-beta.1 / Analysis15·Selected9 |
| LoB·LoD·LoQ | 파생 베타 0.9.1-beta.3 / 원 계산 기준 프로그램 0.9.0-beta.6 |

IsoAmplar Plot Analysis T는 기존 웹툴을 독립 새 탭에서 실행합니다.
Amplification Analysis 0.1.0-beta.1은 외부 처리한 Excel/paste 곡선의 Threshold·STD 정량·선택 개별 4PL/5PL 분석을 제공합니다. 기존 Plot 연결을 함께 유지합니다.
LoBDQ는 사용 검토용 베타이며 한 분석 집단의 계산 후보와 근거를 제공합니다.
원 프로그램의 R·webR 계산을 유지하며 포털 파생 배포 이력을 구별합니다.

포털은 실험값을 받지 않으며 도구 간 입력 자동 전달은 없습니다.
Sequence는 포털 팝업, 다른 도구는 새 브라우저 탭으로 실행합니다.
계산 입력은 브라우저 안에서 처리합니다.
LoBDQ의 첫 R 분석은 고정 webR/R 계산 환경을 외부에서 내려받고 계산은 브라우저에서 수행합니다.
회사 보고서·원자료를 개발자에게 공유할 필요는 없습니다.
방법·조건·버전·확인된 검증 범위와 사용 안내는 각 도구 정보에서 확인하세요.

## 구성과 게시

public-manifest.json의 명시 목록을 scripts/build.mjs가 전체 dist111파일로 구성합니다.
이전 도구 경로를 모두 포함한 전체 dist를 GitHub Pages에 게시합니다.
내부 문서·검증/참고·원본 프로젝트·회사자료·첨부는 이 저장소/게시 목록에 포함하지 않습니다.
기존 Node.js24 이상에서 별도 패키지 설치 없이 확인할 수 있습니다.

```text
node scripts/build.mjs
node scripts/verify.mjs
node scripts/regression.mjs
```

GitHub Actions가 main의 변경 또는 수동 실행 시 이전 게시 목록 보존과 전체 산출물을 검사하고 게시합니다.

입력 보완 베타 v0.9.1-beta.3 / 화면 v0.2.0. 행 간격·번호/오류 안내와 LoQ 검체 관리를 보완했습니다.

핵산 MW 기준 안내·Thermo 메뉴·FASTA 입력 보완판입니다. GitHub Actions는 게시 전에 Oligo·Sequence·핵산의 17개 합성 회귀 시험 모듈을 실행합니다. tests는 저장소 소스에만 포함하며 Pages 산출물에 포함하지 않습니다.

## LoBDQ 진단 보완 beta.3
동일 Probit 적합의 Pearson/Deviance 카이제곱 상측 꼬리 근사 p값·Pearson/자유도 및 기대수 주의를 제공합니다. 기존 적합/후보값/CI dispersion=1 유지, 자동 적합 판정/CI 보정 없음입니다. LoB 지원 α5%·LoD 검출률 확인·LoQ Westgard TE 이름을 명확히 했습니다.

Pages CI는 17개 순수 합성 회귀 모듈과 별도의 실제 webR0.6.0/R4.6.0/MASS7.3.65 수치 회귀(LoD13/CP21/LoQ4)를 실행합니다. 시험 소스/합성 fixture는 GitHub에 있으나 Pages에는 게시하지 않습니다. 회사자료/표준 원문 전체 전사/임시 테스트 런타임은 제외합니다. 테스트용 공식 고정 npm 아카이브는 무결성을 확인하며, 앱의 런타임은 기존 공식 CDN에서 내려받습니다.

## Amplification Analysis beta.1

첫 시트는 검체·시약·형광3행과4행 이후Y값입니다. X는 수치 행 순서이며 Ct/RFU는 기본 제목입니다. 형광1 FAM/2 HEX/3 TexasRED/4 Cy5/5 Cy5.5, 공란은 왼쪽 값 상속입니다. Run 체크는 STD 포함, 개별 체크는 Plot 표시/4·5PL 대상을 정합니다. STD 미지정 포함 데이터는 Unknown으로 분석하며 범위 밖 농도는 외삽으로 표시합니다.

STD는 그림/STD/Unknown을 결과 Excel로 제공합니다. 4/5PL raw 계수는 Advanced Details에 있고 결과 표는 Excel용 복사입니다. 자체 작업 XLSX는 입력/설정/STD를 복원하며 4/5PL은 임시 결과로 재분석합니다. CFX native·앱 baseline/melt·일반 반복 관리는 지원 범위 밖입니다. 모델 비교는 개발 판단 참고이며 임상 또는 Primer/Probe 성능을 자동 판정하지 않습니다. Excel 붙여넣기 사용자 확인 완료, 사용성은 실제 사용 중 보완합니다.

[분석기](https://siun-comp.github.io/JSU_LabTools/tools/amplification-analysis/) · [사용 안내](https://siun-comp.github.io/JSU_LabTools/info/amplification-analysis.html). 베타 compiled runtime27파일을 고정하여 배포하고 release contract SHA/버전/상대경로를 CI에서 검증합니다. 앱 source/build/unit/audit/Chromium·독립 합성 검증은 베타 준비 단계에서 수행했습니다. Pages workflow는 모든 기존 필수 gate와 AA gate를 통과해야 upload/deploy합니다. 테스트/contract는 저장소에 있으나 Pages에는 whitelist111파일만 포함됩니다.

```text
node scripts/verify-amplification.mjs
```

## 핵산 웹툴 기준 보완1.1.0

NEBioCalculator dsDNA 길이 기준과 Thermo DNA Copy Calculator 기본650 기준을 구별합니다. 웹NA6.022E23와 Thermo 질량 입력의 copies/ng 중간 정수 반올림을 적용합니다. 기존650·660·Ambion·서열·직접MW의 수치는 유지합니다. 식·상수·반올림·적용 범위·출처를 결과 복사에 함께 기록합니다. Thermo 몰/Copy 역환산은 웹 화면 재현 범위 밖입니다.

게시 검사기는107개 공개 경로와 선정 SHA를 고정하며, 이전 포털/다른 도구·AA27개 베타 runtime의 보존을 확인합니다. 웹 기준 독립 기대값과 단위 조합 검사는 기존 핵산 회귀에 포함됩니다.

## 시약·버퍼 조제1.1.1

공개 제조법4개와 공개 조성 기반 조제10개는 편집 가능한 프리셋으로 제공하며 MW는 실제 시약 기준으로 직접 입력합니다. 고체·Stock·액체와 %w/v·%v/v·X 원액을 지원합니다. 용매는 표 마지막 행에서 최종 부피까지 맞추는 기준입니다. 선택 메모는 계산 결과를 유지하고 복사에 최신 내용이 포함됩니다. 단일 희석·몰↔질량 환산·고체 역계산은 독립 팝업입니다.

제조사 공개 명목 조성과 실제 제조 동등성을 구별합니다. NEB Isothermal의 Tween %v/v 기준은 문헌 근거이며 제조사 %종류 확인을 뜻하지 않습니다. 용매 자체의 성분·pH 조절량·용해도·안정성은 자동 계산하지 않습니다. 조제43사례와 기존 보조 계산6사례를 CI에 포함하며, 실제 제조/품질 검증과 구별합니다.

프리셋 원료·투입 방법을 보완했습니다. QF는Tris base, QBT/QC는MOPS free acid와pH조절 순서, QBT는편집 가능한10%Triton Stock, Low-TE는pH8.0 Stock을 사용합니다. TBE는AM986x조성, SSC는trisodium citrate가명시된G-Biosciences공개조성으로근거와제품표시를함께전환했습니다. pH는출처조건이며계산값이아닙니다. 복사에는원료안내·조제순서·출처pH를포함하며공식자료기반독립14프리셋기대값도CI에포함합니다.
