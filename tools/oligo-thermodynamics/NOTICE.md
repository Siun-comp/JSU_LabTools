# 소스·라이선스와 실행 범위

이 독립 도구의 직접 결합 코드는 GPL-2.0-or-later로 제공한다. 기존 JSU 도구의 라이선스를 변경하지 않는다. GPL 본문은 LICENSE.txt와 engine/source/gpl-2.0.txt에 있다.

- Hairpin: primer3-py 2.3.1의 PyPI sdist `primer3_py-2.3.1.tar.gz`. `thal.c`, `thal.h`, `thal_parameters.c`, `thal_parameters.h`, GPL 본문은 원본 bytes를 보존했다. 저작권자는 각 파일의 고지를 따른다. 실제 소스/파라미터·WASM 해시는 engine/manifest.json을 따른다.
- 새 코드: JSU LabTools 후보 wrapper, WASI 오류 경계, JS loader·NN/선택 UI·요청/결과 계약·Worker·보관/비교·출력. `wrapper.c`는 입력 검증·단위 변환·THL_GENERAL 모드·구조 유무 확인 후 선택적 그리기를 담당한다. 미검출을 수치 0으로 해석하지 않는다.
- WASM 오류 경계: WASI에서 THAL의 longjmp 오류 경로는 trap으로 종료한다. 정상 수치 알고리즘은 변경하지 않는다. 실패 인스턴스를 폐기하며 다음 독립 분석에는 새 인스턴스를 사용한다. Native는 원래 플랫폼 setjmp/longjmp다. 제품은 로컬 Worker에서 고정 해시의 WASM을 실행한다. 취소/시간 초과는 Worker를 종료하고 늦은 응답을 거절한다. 내부 OOM fault injection 및 모든 자원 오류 복구를 검증한 것은 아니다.
- 빌드: Zig 0.14.1. `engine/source/build.py --zig ... --output ...`로 C 소스/내장 파라미터에서 native/WASM을 생성한다. 전역 compiler/Python 설치나 서버가 제품 실행의 의존성은 아니다. 컴파일러는 ziglang.org의 고정판/공식 SHA-256을 확인한 로컬 개발용이다.
- Duplex: SantaLucia & Hicks (2004) 계열 DNA_NN4 공개 수치 항 및 SantaLucia entropy salt correction. Biopython 1.88은 독립 구현 대조용이며 앱에 Python 패키지나 코드를 배포하지 않는다. Mg=0의 별도 고정 완전 상보 에너지 모델과 Mg>0의 Tm 전용 보정 분기를 구분한다. 제한된 실측자료의 평가와 고정 수식 구현 검증을 구분한다.
- 논문·실측 데이터·NUPACK·IDT 서비스/소스/바이너리는 이 앱에 포함하거나 호출하지 않는다. 문헌 대조는 별도의 내부 validation 자료다. 데이터/원문 권리는 각 출처와 별도로 검토하며 코드 MIT 고지만으로 논문/데이터 재배포 권리를 가정하지 않는다.

현재 실행 범위는 선택 UI·조건/온도별 수치 분석·A/B hairpin·최대3개 보관/비교·서열/선택 정보 및 결과 복사/TXT/CSV다. 계산 입력은 일반 ACGT2~60nt·0~100°C이며 실측 정확도 인증 범위가 아니다. 실측 예측 한계는 validation.html에 보존한다. 이 문단은 로컬 개발 당시 기록이다. Mismatch·NUPACK/대체 엔진은 포함하지 않는다. 2026-10-20 착수/2026-10-21 연속 검증 후보이며 실제 검증 범위는 후속 구현 보고서209를 따른다.

선택·서열·수치 조건 변경은 기본 활성인 자동 계산에서 160 ms 입력 대기 후 최신 요청을 실행한다. 이전 결과는 즉시 만료시키고 취소/오류/늦은 응답 처리는 유지한다. 자동 계산을 끄면 지금 계산 버튼으로 실행할 수 있다. 접기·집중 보기·수치별 도움말은 계산 모델과 파라미터를 변경하지 않는다. UI 후보0.1.0-dev.5, 엔진0.1.0-dev.1. 상세 변경·검증은 보고서210을 따른다.

2026-10-21 사용자 지정 기본값 변경:60°C·Na50mM·K/NH₄0mM·Mg total3mM·dNTP total0.8mM·A/B각200nM. 첫 로드/초기화에 적용하며 서열·범위 변경은 편집한 조건을 덮어쓰지 않는다. UI0.1.0-dev.6, 엔진0.1.0-dev.1. Mg 포함 duplex 미지원·가능한 hairpin 제공을 유지한다. 변경·검증은 보고서211을 따른다.

2026-10-21 후보0.1.0-dev.7: 사용자 보완 요청에 Mg>0 duplex Tm을 추가했다. DOI10.1021/bi702363u의 Owczarzy2008 역수 Kelvin 보정·Mg-dNTP 결합 근사를 독립 JS로 구현하고 Biopython1.88 saltcorr7과 대조한다. Python 패키지·외부 서비스는 앱에 반입하지 않는다. Tm/온도차/동일조건 ΔTm만 제공하고 ΔG/H/S·ΔΔG는 미지원이다. Mg=0 수치·기존 Primer3 C/WASM/파라미터/manifest는 유지한다. 요청/응답 계약0.3·변경한 JS 모듈 SHA·부분 결과/복사/CSV를 연결한다. 이전 후보의 Mg 전체 미지원 기록은 당시 이력이며 현재 지원은 이 문단과 보고서212를 따른다.

2026-10-21 후보0.1.0-dev.8: 사용자 요청에 Mg>0에서 Mg=0 참고 duplex G/H/S/Tm을 별도 제공합니다. Mg만0으로 바꾸고 나머지 입력은 유지하며 dNTP 독립 효과는 미반영입니다. 실제 Mg 보정 Tm과 참고값을 섞지 않고 별도 조건/상태/출력 행으로 보존합니다. 단가염0이면 참고값 미지원입니다. 계약0.4이며 기존 NN/Mg Tm 공식·Primer3 C/WASM/manifest는 유지합니다. 상세 검증은 보고서213을 따릅니다.

2026-10-22 공개 초기 베타0.1.0-beta.1: 사용자 현재 상태의 커밋·배포 요청으로 dev.8을 게시한다. 계산식·C/파라미터/WASM은 변경하지 않는다. UI 버전/게시 표기와 공개 빌드 manifest의 재현 경로만 정리하고 요청의 manifest SHA를 갱신했다. 기존 실측 한계와 Mg=0 참고 조건을 유지한다. 이 폴더의 GPL 직접 결합 코드와 engine/source 전체 대응 소스를 함께 제공하며 기존 다른 도구의 라이선스는 바꾸지 않는다. engine/source/build.py가 전체 빌드 플래그를 포함하고 Zig0.14.1은 사용자가 준비하는 일반 개발 도구이다. 검증 fixture와 회귀는 저장소 tests/oligo-thermodynamics에 있으며, 내부 문헌/사용자 자료는 게시하지 않는다.
