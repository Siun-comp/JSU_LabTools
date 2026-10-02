# JSU LabTools

분자진단 개발 업무용 개인 분석 도구 포털입니다. 포털 v0.1.0.

- 현재 도구: IsoAmplar Plot Analysis T — 기존 웹툴을 새 브라우저 탭에서 실행합니다.
- 준비중: Oligo Mix, Sequence, 농도 환산, Amplification Analysis.
- 포털은 분석 데이터를 입력받지 않습니다. 도구 간 자동 전달·통합 세션은 없습니다.
- 접속/표시 버전 확인은 계산 정확성·임상 성능 검증을 의미하지 않습니다.

## 구성

portal/은 포털 소스입니다. public-manifest.json의 파일을 scripts/build.mjs가 dist/로 모읍니다.
GitHub Pages에는 dist/만 게시합니다. 내부 자료/원본 실험 파일은 이 저장소의 게시 대상에 포함하지 않습니다.
도구 추가 때는 이전 모든 공개 경로를 포함하는 전체 목록을 유지합니다.

## 로컬 확인

기존 Node.js 24 이상에서 다음 명령을 실행합니다. 별도 패키지 설치가 필요하지 않습니다.

```text
node scripts/build.mjs
node scripts/verify.mjs
```

## 게시

GitHub Pages 소스는 GitHub Actions입니다. main의 변경 또는 수동 실행으로 검증한 전체 dist를 게시합니다.
첫 게시 전 실제 사용자 브라우저 확대/실사용 확인이 남아 있습니다.

