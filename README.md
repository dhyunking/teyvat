# TEYVAT 홈페이지

기존 디자인, 이미지, 페이지 전환과 스크롤 모션을 유지한 Vercel 홈페이지입니다. 대표 공개 주소는 https://teyvat.kr 이며, `www.teyvat.kr`은 대표 주소로 308 이동합니다. Vercel 프로젝트는 `insajins-projects/teyvat`이고 GitHub 저장소는 https://github.com/dhyunking/teyvat 입니다. 원본 HTML·업로드 자료는 로컬에 보존하며, 비밀키와 운영 기록을 포함한 `.vercel/` 및 `.env.local`은 Git에서 제외합니다.

## 작업물 관리 화면

전용 관리자 주소는 **https://teyvat.kr/admin** 입니다. 별도 관리 서버나 DB를 운영하지 않으며 기존 Vercel Functions와 비공개 Blob을 사용합니다. 이전 Pages CMS 설정은 읽기 전용 보관본으로 전환했습니다.

1. 관리자 비밀번호로 로그인합니다. 최초 비밀번호는 별도로 전달한 일회용 설정 링크에서 지정합니다.
2. 사진 카드 목록에서 기존 작업물을 검색하거나 **새 작업물**을 만듭니다.
3. 여러 사진을 한 번에 끌어놓습니다. JPG·PNG·WEBP·AVIF 원본을 브라우저에서 최대 2400px WebP로 최적화합니다. 원본은 장당 25MB, 변환 후 장당 2MB, 작업물당 최대 60장입니다.
4. 별표로 대표 사진을 고르고, 끌기 또는 앞·뒤 이동 버튼으로 사진 순서를 정합니다.
5. 브랜드명, 제작 품목·종류와 설명을 입력합니다. 작업 번호는 자동 지정하며 기존 작업 번호와 상세 주소는 유지합니다. 영문·사진 섹션·배치·표시 위치는 추가 설정에서 조정합니다.
6. 변경 내용은 자동 임시 저장됩니다. 임시 저장한 사진과 설명은 공개되지 않습니다. 네트워크 장애 시 브라우저 복구본도 최대 7일간 유지합니다.
7. 실제 홈페이지 렌더러의 PC·모바일 미리보기로 확인한 뒤 **게시하기**를 누릅니다. 게시 중에는 이전 사이트가 계속 표시되며 완료·실패 상태를 관리 화면에서 확인합니다.

### 저장과 배포

`content/works.json`과 Git의 이미지는 초기 데이터입니다. 전용 관리 화면 사용 후에는 비공개 Blob의 `cms/catalog.json` 및 변경 이력이 게시 데이터의 기준이며, 임시 저장은 `cms/studio.json`에 분리됩니다. 게시 시 사진과 작품 데이터만 Vercel 정적 배포에 포함합니다. 비공개 원본·임시 저장은 공개 번들에 넣지 않습니다. 게시에 실패하면 이전 카탈로그로 복원하고 임시 저장을 보관합니다.

GitHub Actions는 기존 Vercel 계정·프로젝트로 코드 업데이트를 배포합니다. `scripts/deploy.mjs`는 현재 CMS 데이터를 합쳐 배포하고 성공한 소스 목록을 다시 등록하므로 코드 업데이트가 새 작업물을 초기 데이터로 덮어쓰지 않습니다. 코드 업데이트와 관리 화면 게시를 비공개 저장소의 조건부 갱신·임대로 직렬화합니다. 테스트·배포 상태는 [Actions](https://github.com/dhyunking/teyvat/actions)에서 확인합니다.

배포 키는 `teyvat` 프로젝트에만 제한한 GitHub Actions의 `VERCEL_TOKEN`입니다. 배포 시 `scripts/studio-configure.mjs`가 같은 키를 Vercel Production의 Sensitive `ADMIN_DEPLOY_TOKEN`으로 동기화합니다. 계정 전체 키를 관리자나 브라우저에 전달하지 않습니다. 현재 키의 만료일은 2027-10-31이며 만료 전에 GitHub Secret을 갱신한 뒤 코드를 재배포합니다. Vercel CLI의 프로젝트 전용 키 관련 [공급자 문제](https://github.com/vercel/vercel/issues/17506) 때문에 공식 배포 API를 사용합니다.

관리자 비밀번호는 scrypt 해시로만 보관합니다. 12시간 HttpOnly·Secure·SameSite 세션, CSRF 검사, 공유 로그인 시도 제한, 비밀번호 변경·로그아웃 시 세션 무효화를 적용합니다. 일회용 설정 링크에는 만료가 있으며 사용 후 재설정에 쓸 수 없습니다. 비밀번호 설정 링크와 운영 키는 `.vercel/` 및 `.env.local`에만 보관하고 Git에 올리지 않습니다. 관리 화면과 API는 검색 색인에서 제외합니다.

비공개 저장소에는 게시 이력과 사진이 남으므로 배포 실패 후 복구에 사용할 수 있습니다. 사진을 작업물에서 제거해도 과거 이력의 파일을 즉시 삭제하지 않습니다. CMS 저장 경로는 문의 데이터의 `inquiries/` 및 메일 인증 자료와 분리합니다.

2026-10-31 검증: 서버·콘텐츠·배포 테스트 79개와 브라우저 테스트 11개를 통과했습니다. 기존 공개 HTML 35개는 JavaScript 번들 파일명을 제외하고 전환 전과 동일합니다. 실제 관리자 로그인, CSRF 차단, 비공개 사진 업로드·조회, 게시 전 익명 접근 차단, 정적 사진 게시와 SHA-256 일치까지 확인했습니다. 게시 후 GitHub Actions로 코드를 다시 배포해도 CMS 사진·내용이 보존되는 것을 확인했고, 검증 후 작업물 29개를 원래 값으로 복원했습니다. 실계정 검증에는 기존 대표 사진과 같은 파일을 사용해 홈페이지의 시각적 내용을 유지했습니다. 최초 설정 안내는 Git에서 제외한 `.vercel/studio-onboarding.html`에 준비합니다. 업로드 전 최적화하므로 컴퓨터에 있는 원본 사진은 서버에 보관하지 않습니다.

## 문의 접수

`문의 폼 → 문의 정보 영속 저장 + 첨부 네이버웍스 공용 드라이브 저장 → 접수 완료 → inquiry@teyvat.kr 메일함에 원문 보관 → Slack 요약·원문·파일별 링크` 순서입니다. 받은메일함에 직접 수신한 문의도 1분 간격으로 확인해 같은 Slack 채널로 알립니다. 사용자 승인과 운영 연결·실제 검증을 완료했습니다.

- 문의 정보는 프로젝트에 연결된 **비공개 Vercel Blob**에 저장합니다. 첨부 파일 본문은 Blob에 저장하지 않고 네이버웍스 파일 ID, 파일명, 체크섬, 링크만 보관합니다.
- 문의 정보와 선택한 모든 첨부 파일의 저장이 확인되어야 접수 완료와 접수번호를 반환합니다. 저장 장애 시 입력을 유지하고 성공으로 표시하지 않습니다.
- 같은 접수번호의 동일 요청은 서버 재시작·동시 요청에도 기존 접수를 재사용합니다. 내용이 바뀌면 409로 거절합니다.
- 접수번호 폴더와 `순번_원래파일명`의 고정 저장 경로를 접수 정보에 보관합니다. 내용 해시는 별도 메타데이터로 저장합니다. 네이버웍스에는 `홈페이지 문의/접수번호/고정 파일명`으로 저장하며, 응답 유실 후 같은 경로를 조회하고 다운로드 내용의 SHA-256을 확인합니다. 덮어쓰기·중복 이름 자동 번호 추가를 끄고, 이어올리기와 영속 처리 잠금을 사용해 중복 파일 생성을 방지합니다. 중간에 실패한 접수는 `uploading` 상태이며 아직 접수 완료가 아닙니다. 방문자가 같은 내용으로 재시도하면 이어서 저장합니다.
- Slack과 확인메일은 저장 후 별도로 처리합니다. 장애가 발생해도 문의 원본은 유지합니다. 홈페이지 문의를 운영 메일함에도 보관하도록 요구사항을 반영했습니다. 메일 전송 결과가 불명확하면 같은 접수번호의 실제 받은메일함 항목을 조회해 복구하며, 임의로 다시 발송하지 않습니다.
- 고객 확인메일은 기본 **꺼짐**입니다. 켜면 메시지오를 통해 고객 주소로 짧은 접수 안내와 접수번호만 발송하며, 문의 원문이나 첨부를 재전송하지 않습니다.
- 첨부는 최대 5개, 원본 합계 2MB이며 JPG·PNG·WEBP·PDF·AI·PSD·ZIP을 지원합니다. 현재 HTTP 요청 제한을 유지한 값이며 Drive 자체 용량 제한을 뜻하지 않습니다.

## 환경변수

`.env.example`을 참고하세요. 비밀값은 서버 환경에만 두며 채팅이나 저장소에 올리지 않습니다. Blob 저장소와 `CRON_SECRET`은 이미 생성·연결했습니다.

| 목적 | 변수 | 상태/설명 |
| --- | --- | --- |
| 공개 주소 | `SITE_URL` | `https://teyvat.kr`; 메타데이터·사이트맵·문의 요청 출처에 사용 |
| 문의 정보 | `BLOB_READ_WRITE_TOKEN` | 비공개 Blob 연결 시 생성됨 |
| Slack | `SLACK_WEBHOOK_URL` | Helper → TEYVAT의 #홈페이지-문의 연결 완료. 비밀값은 서버에만 보관 |
| 첨부 링크 | `SLACK_FILE_LINKS_ENABLED` | true. 파일별 회사 구성원 전용 조회·다운로드 링크 사용 |
| 알림 복구 | `CRON_SECRET` | 생성 완료. 예약 실행과 수동 복구 엔드포인트 인증용 |
| 네이버웍스 OAuth | `NAVERWORKS_CLIENT_ID`, `NAVERWORKS_CLIENT_SECRET`, `NAVERWORKS_REFRESH_TOKEN` | 사용자 계정 OAuth 승인 필요. Drive 업로드 scope는 `file`. Refresh Token 환경변수는 수동 연결 시에만 필요 |
| 네이버웍스 콜백 | `NAVERWORKS_REDIRECT_URI` | `https://teyvat-pi.vercel.app/api/naverworks-oauth`; Developers 등록 주소 유지. 미설정 시 SITE_URL 기준 |
| 승인 범위 | `NAVERWORKS_OAUTH_SCOPES` | file mail. 사용자 승인 완료 |
| 문의 메일함 | `NAVERWORKS_MAILBOX` | inquiry@teyvat.kr |
| 폼 원문 메일 | `CONTACT_MAIL_ENABLED` | Production true. 실제 받은 사본의 메일 ID 확인 후 Slack 전달 |
| 메일 원문 주소 | `NAVERWORKS_MAIL_URL_TEMPLATE` | https://mail.worksmobile.com/w/all?mailSN={mailId}. 실제 원문과 브라우저 클릭으로 확인 |
| 직접 수신 조회 | `MAIL_SYNC_ENABLED`, `MAIL_SYNC_START_AT` | Production true. 2026-10-23T01:50:01.368Z 이후 받은메일함 조회 |
| 예약 확인 인증 | `MAIL_POLL_SECRET` | Vercel·Cloudflare 예약 확인 작업 간 전용 인증. 생성·등록 완료 |
| 토큰 암호화 | `NAVERWORKS_TOKEN_ENCRYPTION_KEY` | Production에 생성 완료. 32바이트 base64 키이며 변경하지 않음 |
| 공용 드라이브 | `NAVERWORKS_SHARED_DRIVE_ID` | 회사 공용 드라이브 ID |
| 문의 상위 폴더 | `NAVERWORKS_DRIVE_PARENT_ID` | 공용 드라이브에 준비한 ‘홈페이지 문의’ 폴더의 fileId |
| 폴더 내부 주소 | `NAVERWORKS_DRIVE_FOLDER_URL` | 담당자가 로그인해 사용하는 폴더의 브라우저 주소. Slack 버튼에서 사용 |
| 고객 확인메일 | `CONTACT_ACK_ENABLED` | 기본 false. true로 설정된 이후 접수된 문의에만 확인메일 발송 |
| 메시지오 | `MESSAGIO_API_KEY`, `CONTACT_FROM_EMAIL` | 확인메일을 켤 때만 필요. 인증된 발신 도메인과 email:send 권한 필요 |
| 답장 받을 주소 | `CONTACT_REPLY_TO_EMAIL` | 선택: 기존 회사 메일함 주소. 고객 확인메일의 Reply-To |
| 메시지오 API | `MESSAGIO_BASE_URL` | 기본 `https://api.messag.io` |
| 검색 소유권 | `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION` | 선택: 최종 도메인의 소유권 확인 토큰 |

첨부 저장소는 **네이버웍스 공용 드라이브**입니다. 사용자 OAuth로 발급한 토큰만 사용하며 서비스 계정 JWT는 사용하지 않습니다. 요금제의 Drive API 지원 여부와 연결한 사용자의 대상 드라이브 쓰기 권한이 필요합니다. [네이버웍스 공식 Drive API](https://developers.worksmobile.com/kr/docs/drive).

앱은 상위 폴더의 접근 권한을 변경하지 않습니다. 파일별 링크가 없으면 이미 DOMAIN/TENANT에 접근을 허용한 드라이브에 한해서 ORGANIZATION·DOWNLOAD 링크를 발급합니다. MEMBER 한정 드라이브를 회사 전체로 넓히지는 않습니다. 공개 ANYONE 링크는 거절합니다. Slack에는 긴 해시 저장 경로 대신 원래 파일명·크기·각 파일의 열기 버튼을 표시합니다.

OAuth Access Token과 회전된 Refresh Token은 AES-256-GCM으로 암호화해 비공개 Blob의 credentials 영역에 보관합니다. 여러 인스턴스의 갱신은 조건부 갱신과 임대로 직렬화하고, 새 Refresh Token 저장이 확인된 뒤에만 새 Access Token을 사용합니다. 암호화 키 변경 또는 토큰 만료 시 운영자가 다시 승인해야 합니다. [사용자 OAuth와 토큰 회전 안내](https://developers.worksmobile.com/kr/docs/auth-oauth).

실계정 연결 순서:

1. 네이버웍스 Developers에서 전용 OAuth 앱을 등록하고 사용자 인증을 설정합니다. Drive에는 `file`, 홈페이지 문의 메일 보관과 직접 수신 조회를 함께 연결할 때는 `mail` scope가 필요합니다.
2. 대상 공용 드라이브에 ‘홈페이지 문의’ 폴더를 준비하고, 연결할 구성원 계정에 쓰기 권한을 부여합니다.
3. Client ID/Secret을 Vercel Production 환경변수에 등록하고 앱의 Redirect URL에 `https://teyvat-pi.vercel.app/api/naverworks-oauth`를 등록합니다. 비밀값은 채팅이나 소스 코드로 전달하지 않습니다.
4. 다시 배포한 뒤 아래 `authorize` 운영 명령으로 10분 유효 승인 링크를 발급받아 담당자 계정으로 로그인합니다. 토큰은 콜백에서 암호화 저장하며 브라우저에 반환하지 않습니다. 이 시작 명령은 운영자 인증이 필요하고 승인 상태·코드는 한 번만 사용합니다.
5. 공용 드라이브 ID, 상위 폴더 fileId, 내부 폴더 주소를 등록하고 다시 배포합니다.
6. 아래 운영 도구로 접근·폴더 ID를 확인한 뒤 PDF 한 개를 실제 첨부해 저장 위치·파일 내용·Slack 링크를 확인합니다.

```sh
node --env-file=.env.local scripts/naverworks-setup.mjs authorize
node --env-file=.env.local scripts/naverworks-setup.mjs check
node --env-file=.env.local scripts/naverworks-setup.mjs drives
node --env-file=.env.local scripts/naverworks-setup.mjs folders '<sharedriveId>'
```

2026-10-20에 실계정 OAuth 승인과 암호화 토큰 저장을 완료했습니다. 전달받은 공용 드라이브의 최상위 폴더 아래에 ‘홈페이지 문의’ 전용 폴더를 만들고 Production 저장 위치로 연결했습니다. 기존 드라이브의 DOMAIN 쓰기 권한을 확인했으며 공유 권한은 변경하지 않았습니다. Drive 파일 본문은 비공개 Blob에 저장하지 않습니다.

## 기존 메일함으로 직접 받는 이메일

홈페이지 폼의 메일 보관과 직접 수신 조회를 각각 구현·활성화했습니다. 실제 사용 중인 inquiry@teyvat.kr 메일함을 유지하며, 원문은 이 계정의 기존 접근 권한으로 엽니다.

2026-10-23 사용자 정정과 네이버웍스 로그인 화면의 ID(`inquiry` / `@teyvat.kr`)를 기준으로 공개 문의 주소를 `inquiry@teyvat.kr`로 통일했습니다. 이전 `info@teyvat.kr` 안내는 정정된 값입니다. 로그인 화면은 로그아웃 상태였고, 기존 file scope 토큰의 구성원 정보 조회는 403이므로 메일함 내부 계정 정보까지 인증 조회한 것은 아닙니다. 홈페이지 링크·박스 애니메이션·구조화 데이터·llms·JavaScript 비활성 안내·선택적 확인메일 Reply-To를 함께 수정했습니다.

1. 현재 메일 서비스는 **네이버웍스**, 문의 수신 주소는 `inquiry@teyvat.kr`입니다. 공개 MX도 `kr1-aspmx1.worksmobile.com` / `kr1-aspmx2.worksmobile.com`으로 확인했습니다. 기존 메일함은 유지합니다.
2. Drive 첨부를 저장할 폴더 링크와 업로드 권한.
3. 직접 수신한 메일도 Slack으로 보낼지 여부와 수신 채널.
4. 해당 서비스의 관리자 또는 연동 승인 권한. DNS 변경이 필요한 경우 도메인 DNS 관리 권한.

직접 수신 메일은 네이버웍스 Mail API로 받은메일함을 조회합니다. 메일 ID에서 안정적인 접수번호를 만들고, 홈페이지가 보관한 사본 메일은 원래 폼 접수번호와 연결해 중복 알림을 막습니다. 활성화 이전 과거 메일은 일괄 전송하지 않습니다. 일반 첨부는 드라이브에 저장하고, 다운로드 기한이 있는 대용량 첨부는 네이버웍스가 발급한 다운로드 링크와 만료 정보를 유지합니다. MX 레코드는 변경하지 않습니다.

네이버웍스의 Mail API는 구성원 계정의 OAuth 인증을 요구하며 서비스 계정(JWT) 인증으로 호출할 수 없습니다. `inquiry@teyvat.kr` 계정의 file mail 승인을 완료했고 메일함 접근 HTTP 200, 실제 원문·첨부를 확인했습니다. 기존 Client ID/Secret과 콜백 주소는 유지합니다. [네이버웍스 공식 Mail API](https://developers.worksmobile.com/kr/docs/mail), [OAuth 안내](https://developers.worksmobile.com/kr/docs/auth-oauth).

Cloudflare의 `ops/mail-poller`는 `* * * * *` 예약으로 받은메일함 목록을 확인하고 새 메일 ID가 나타나면 보호된 Vercel `/api/sync-mail`을 호출합니다. 변동이 없으면 Vercel·Blob 호출을 생략하고, 접근 토큰은 전용 키로 암호화해 비공개 KV에 10분 캐시합니다. 새 메일이 도착하면 이어가던 이전 페이지 대신 최신 목록부터 다시 확인해 누락을 방지합니다. 실제 예약 실행에서 processed:3·failed:0·more:false와 이후 changed:false의 정상 실행을 확인했습니다.

```sh
node --env-file=.env.local scripts/naverworks-setup.mjs mail-check
node --env-file=.env.local scripts/naverworks-setup.mjs sync-mail
wrangler deploy --config ops/mail-poller/wrangler.jsonc
```

## 저장 내용 확인과 알림 복구

Vercel의 프로젝트 Storage에서 비공개 접수 JSON을 확인할 수 있습니다. 로컬 운영 도구는 환경변수의 저장소 접근 권한을 사용합니다.

```sh
node --env-file=.env.local scripts/inquiries.mjs list
node --env-file=.env.local scripts/inquiries.mjs show <접수번호>
node --env-file=.env.local scripts/inquiries.mjs retry <접수번호>
```

`show`는 개인정보를 포함하므로 운영 담당자의 로컬 확인에만 사용하세요. 문의 처리 후 불필요한 문의 정보와 Drive 첨부의 파기는 운영자가 처리합니다. 자동 보유 기간 삭제 기능은 아직 없습니다.

Slack과 확인메일은 각각 영속 전달 상태와 조건부 갱신으로 처리 권한을 확보하므로 동시에 실행해도 같은 알림을 중복 발송하지 않습니다. 자격증명이 없으면 pending, 성공하면 sent, 검토 대기 메일은 held, 명확한 거절은 blocked로 남습니다. 명확한 제한 응답(429 등)은 retry로 보관합니다.

요청 결과가 불명확한 Slack 알림은 unknown으로 보관하고 자동으로 다시 보내지 않습니다. 결과가 불명확한 고객 확인메일은 같은 payload·멱등 키로만 재시도하며 최초 시도 후 23시간이 지나면 자동 재시도를 중단합니다. unknown/held/blocked 상태는 실제 채널·메시지오 발송 로그를 확인한 뒤 운영자가 처리해야 합니다. 새 키로 맹목 재발송하지 않습니다.

`/api/retry-notifications`는 CRON_SECRET Bearer 인증이 필요합니다. Vercel Hobby의 예약 제한에 맞춰 하루 한 번 재개를 시도하며, 더 빠른 복구가 필요하면 위 수동 도구로 실행합니다. 다음날 복구가 접수 원본 보관을 대신하는 것은 아닙니다. [Vercel Cron 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 실행과 배포

Node.js 24를 사용합니다.

```sh
npm ci
npm run build
npm test
npm run test:browser
npm run dev
vercel --prod
```

개발 주소는 `http://localhost:4173`입니다. 환경변수는 `.env.local`에 두며 배포/Git 대상에서 제외합니다. 프로덕션 환경변수 변경은 재배포해야 적용됩니다.

## SEO·GEO 및 확인 범위

34개 경로를 정적 HTML로 생성합니다. JavaScript 없이도 본문·이동 링크·FAQ를 읽을 수 있고, 페이지별 title/description/canonical/OG/Twitter, Organization/WebSite/WebPage/Breadcrumb/FAQ 구조화 데이터와 robots/sitemap/llms 자료를 제공합니다. Preview는 noindex 처리합니다. 가비아 DNS와 HTTPS 연결은 2026-10-22에 확인했습니다. Google/Naver 소유권 확인과 사이트맵 제출은 아직 남아 있습니다.

문의 저장, Drive 장애·응답 유실, 동시 요청, 선택적 확인메일, 실패 후 복구를 테스트합니다. 실제 비공개 Blob 저장·조회·조건부 갱신·익명 접근 차단 및 합성 문의의 동시 저장을 확인했습니다. 실제 네이버웍스 업로드 검증은 아래에 기록했습니다. Slack 및 고객 확인메일 수신은 아직 검증하지 않았습니다.

이전 공개 배포에서 서버 테스트 22개와 브라우저 테스트 6개가 통과했습니다. 현재 네이버웍스 전환 테스트 결과는 아래와 같습니다. 배포 `dpl_7mf9FKTue2nVbrHJAYGVVu5m5on9`에서 실제 브라우저 문의 제출 → HTTP 201 → 접수 완료 표시 → 비공개 저장소 조회 → 같은 요청 재접수 확인까지 검증했습니다. 해당 합성 문의와 전달 상태는 제거했습니다. 현재 Slack 상태는 설정 대기(pending), 고객 확인메일은 꺼짐(disabled)입니다. 확인메일의 sent 상태는 메시지오 API 접수 확인이며 최종 받은편지함 도착을 뜻하지 않습니다.

메시지오의 앞선 로컬 감사에서는 관련 테스트 23개가 통과했고 DB 통합 5개는 미실행이었습니다. `msgmcp` 소스 `e37636b9538c2c79e7a0d184f1b7da07408b258a`의 이메일 워커는 SUBMIT_UNKNOWN을 한 차례 재전송하므로 모호한 결과와 SNS 이벤트 유실이 겹칠 때 중복 안내메일 가능성이 남습니다. 고객 확인메일을 켤 때 이 운영 정책도 확인해야 합니다. 현재 핵심 문의 저장은 메시지오에 의존하지 않습니다.

## 네이버웍스 Drive 전환 검증

Google Drive 전용 인증·업로드 코드는 제거했습니다. 네이버웍스 업로드/부분 이어올리기/응답 유실 복구/내용 검증/공개 링크 거절/쓰기 권한/업로드 URL 경계와 OAuth 암호화·토큰 회전·동시 갱신을 mock 계약으로 검증합니다. 이 초기 전환 시점에는 직접 메일 수신→Slack 연동이 미구현이었으며, 추가 구현 상태는 위 메일 연동 절과 아래 최신 기록을 참고하세요.

전환 버전은 서버 테스트 35개, 브라우저 테스트 6개가 통과했습니다. 운영 저장소에서 합성 토큰의 암호화 저장과 서버 재시작 후 복구를 검증했고 합성 토큰 자료는 제거했습니다. 2026-10-20의 업로드 수정 후 서버 테스트 35개를 다시 통과했습니다.

공개 배포 `dpl_DzLNv1xcxZduZ1VLhxwS6xjpQUhA`에서 새 합성 문의와 431바이트 PDF 첨부가 HTTP 201로 접수되고 비공개 문의 기록이 received 상태로 저장된 것을 확인했습니다. 실계정 공용 드라이브의 파일을 다운로드해 SHA-256을 검증하며, 같은 요청 재접수도 HTTP 201과 동일 접수번호를 반환했습니다. 새 파일은 resume:false로 시작하고 실제 미완료 파일이 있을 때만 resume:true로 이어올립니다. 새 파일에 resume:true를 사용하면 실서버가 Not Exist Resource로 거절하는 동작을 회귀 테스트에 반영했습니다. 현재 Slack은 pending, 고객 확인메일은 disabled이며 메일 수신·Slack 전달은 아직 검증하지 않았습니다.

실계정 검증에 사용한 PDF 2개와 접수번호 폴더 2개, 합성 문의·전달 상태·처리 잠금 기록 6개를 제거했습니다. ‘홈페이지 문의’ 상위 폴더와 실제 OAuth 토큰은 유지했습니다.

## 대표 도메인 연결 검증 (2026-10-22)

가비아 네임서버에서 `teyvat.kr`의 A 레코드는 `216.198.79.1`, `www.teyvat.kr`의 CNAME은 `227134f7968046a4.vercel-dns-017.com.`으로 확인했습니다. Google·Cloudflare DNS에서도 같은 결과이며 Vercel은 두 도메인을 verified, misconfigured:false로 반환합니다. 대표 도메인 HTTPS는 200, HTTP와 www는 대표 HTTPS 주소로 308 이동합니다. 기존 네이버웍스 MX 2개는 유지했습니다.

배포 `dpl_DYVwyKBQZkmj8dDuKEFDArPqLqti`에서 34개 페이지의 canonical·OG URL, sitemap·robots·llms 자료를 `https://teyvat.kr`로 확인했습니다. 실브라우저에서 새 도메인의 문의 폼에 PDF를 첨부해 HTTP 201, 접수 완료 화면, received 영속 기록과 실계정 Drive 저장을 검증했습니다. 네이버웍스 OAuth 콜백은 기존 등록 주소를 별도 환경변수로 유지하며, 홈페이지 주소 변경 후에도 동일한 콜백으로 코드 교환하는 회귀 테스트를 포함해 서버 테스트 36개가 통과했습니다. 실제 배포의 인증 시작 응답에서도 기존 콜백을 확인했고, 검증용 미사용 승인 상태는 제거했습니다. Google/Naver 소유권 확인·사이트맵 제출은 별도 진행이 필요합니다.

도메인 검증에 사용한 PDF·접수번호 폴더와 합성 문의 관련 기록 4개를 제거했습니다. 운영용 문의 상위 폴더와 OAuth 토큰은 유지했습니다.

## Slack·메일 연결 작업 (2026-10-23)

Slack CLI가 TEYVAT 워크스페이스에 로그인된 것을 확인했고, Helper 앱(A0CCB3LG45N)에 이미 발급된 #홈페이지-문의(C0CBB416QLV) 웹훅을 Vercel Production 비밀 환경변수로 연결했습니다. 배포 `dpl_3szDY1fPFwpqjHMiP1LnZ7y4DECZ`에서 실브라우저 PDF 문의 제출, HTTP 201, 접수 완료, Drive 저장, Slack 전달 상태 sent와 실제 채널의 Helper 메시지를 확인했습니다. 당시 저장된 실제 고객 문의는 없었습니다.

알림은 연락처·요청 사항·본문·원문 메일·첨부파일을 구분하는 형식으로 변경했습니다. 표시용 문자열은 멘션을 이스케이프하고 본문은 plain_text로 유지합니다. 파일마다 회사 구성원 전용 실제 링크를 생성하며, 실제 Drive API에서 단일 파일의 works.do 링크 발급·조회도 검증했습니다. 원문 메일 버튼은 실제 메일 ID와 확인된 원문 URL 설정이 있을 때만 표시합니다.

최종 배포는 `dpl_DnYZEV9hoXziK7WpCD796EBNiGfc`입니다. 폼 문의의 메일함 보관, 불명확한 발송 결과의 조회 복구, 직접 수신 메일 가져오기, 폼 사본의 중복 처리, 대용량 첨부 링크 유지와 Cloudflare 예약 확인 작업을 포함해 서버 테스트 61개, 브라우저 테스트 6개가 통과했습니다. file mail 사용자 승인을 완료했고 CONTACT_MAIL_ENABLED·MAIL_SYNC_ENABLED·1분 예약을 활성화했습니다.

실제 홈페이지 문의는 HTTP 201·접수 완료·네이버웍스 원문 메일 1144·메일 전달 상태 sent·Slack 전달 상태 sent를 확인했습니다. 홈페이지를 거치지 않은 직접 수신 메일 1146도 실제 Cloudflare 예약 실행이 가져와 Slack으로 전달했습니다. Slack의 원문 버튼을 각각 눌러 Chrome에서 정확한 메일이 열리는 것을 확인했고, 파일 버튼 클릭으로 Drive 웹에서 PDF 내용도 확인했습니다. 재접수는 동일 접수번호를 반환하며 원문 메일 1개와 변경 없는 sent 상태를 유지했습니다.

실제 검증 중 두 공급자 동작을 수정했습니다. Vercel Blob의 압축 GET이 반환하는 약한 ETag(W/)는 원본 버전의 강한 ETag로 정규화해 조건부 갱신하며, 별도 HEAD의 새 버전으로 읽은 내용을 덮어쓰지는 않습니다. 네이버웍스 검색 결과는 제목에 mark 강조 태그가 붙으므로 최근 받은메일함과 실제 원문을 사용해 발송 사본을 식별합니다. Cloudflare fetch는 error 리디렉션 모드를 지원하지 않아 manual과 상태 검증을 사용합니다.

초기 설정용 문의 2개의 Drive 폴더와 Blob 기록 8개를 정리했고, 설정용 원문·보낸메일 2개는 휴지통으로 이동했습니다. 최종 확인용 홈페이지·직접 수신 테스트 2건은 원문·첨부 링크를 검토할 수 있도록 보관했습니다. 이와 별도로 들어온 접수 기록은 유지했습니다.
