# 반아나 마켓

반포프로공인중개사사무소 김준한 소장이 직접 확인한 반포동·잠원동 아파트 매매 매물을 보여 주는 사이트입니다.

- 손님 화면: `index.html` (사이트 주소로 들어오면 보이는 화면)
- 관리자 화면: `admin/` (사이트 주소 뒤에 `/admin/` 을 붙여 들어감, 로그인 필요)
- 매물 저장소: Supabase (무료 플랜으로 시작 가능)

관리자 화면에서 매물을 등록·수정·삭제하면 Supabase에 바로 저장되고, 손님이 사이트를 열거나 새로고침하면 그대로 반영됩니다. 파일을 다시 올릴 필요가 없습니다.

---

## 폴더 구성

| 파일 | 하는 일 | 고칠 일이 있나요? |
| --- | --- | --- |
| `config.js` | Supabase 주소·키, 카카오톡·전화·카페 주소 | **예.** 처음 한 번 |
| `index.html` | 손님 화면 | 문구를 바꿀 때만 |
| `admin/index.html`, `admin/admin.js` | 관리자 화면 | 아니요 |
| `assets/common.js` | 두 화면이 함께 쓰는 코드 | 아니요 |
| `assets/search.js` | AI 매물찾기 채팅 (AI가 안 될 때는 무료 단어 검색) | 아니요 |
| `assets/icon.svg` | 브라우저 탭 아이콘 | 아니요 |
| `supabase-setup.sql` | 서버에 표와 권한을 만드는 명령 (처음 한 번) | 관리자 이메일 한 줄 |
| `supabase-update.sql` | 이미 설치한 서버에 새 기능을 더하는 명령 | 아니요 |
| `supabase/functions/ai-search/index.ts` | AI 매물찾기 서버 기능 (Supabase에 붙여 넣는 코드) | 아니요 |
| `robots.txt`, `sitemap.xml` | 검색 등록용 | 도메인을 정한 뒤 |

---

## 1단계. Supabase 준비 (서버)

1. [supabase.com](https://supabase.com) 가입 → **New project** → 이름 `banana-market`, Region은 **Northeast Asia (Seoul)**.
2. `supabase-setup.sql` 을 메모장으로 열어 `ADMIN_EMAIL@example.com` 을 **관리자 이메일**로 바꿉니다.
3. Supabase 왼쪽 **SQL Editor → New query** 에 파일 내용을 통째로 붙여 넣고 **Run**. `Success. No rows returned` 가 나오면 정상입니다.
4. **Authentication → Users → Add user → Create new user** 로 2번과 **같은 이메일**의 계정을 만들고, **Auto Confirm User** 를 체크합니다.
5. **Authentication → Sign In / Providers** 에서 **Allow new users to sign up** 을 **끕니다**. (다른 사람이 가입하지 못하게)
6. **Project Settings → API (API Keys)** 에서 **Project URL** 과 **anon public (publishable) key** 를 복사해 `config.js` 에 넣습니다.

> **secret key / service_role key 는 절대 `config.js` 에 넣지 마세요.** 깃허브에 올리면 누구나 볼 수 있습니다.
> anon(publishable) 키는 공개되어도 괜찮도록 만들어진 키이고, 쓰기 권한은 서버(1단계 3번의 권한 설정)가 관리자 계정에만 허락합니다.

---

## 1-2단계. AI 매물찾기 켜기 (Claude 연결)

손님이 "아리팍 30평대 60억 안쪽"처럼 문장으로 적으면, Claude가 조건으로 바꾸고 **관리자 화면에 올린 매물 중에서만** 찾아 줍니다.
이 단계를 하지 않아도 사이트는 동작합니다. 그때는 AI 대신 무료 단어 검색으로 찾습니다.

### 어떻게 동작하나요
- 손님 문장은 Supabase 서버 기능(`ai-search`)을 거쳐 Claude(모델 `claude-haiku-5-5`)에게 갑니다. Claude는 문장을 **검색 조건으로 바꾸는 일만** 하고, 매물 목록을 받지 않으며 인터넷 검색도 하지 않습니다.
- "김준한 소장이 누구야?", "반아나 마켓 뜻이 뭐야?"는 AI를 거치지 않고 `config.js` 의 `INTRO_KIM`, `INTRO_NAME` 문구를 그대로 보여 줍니다. (비용 0원)
- 매물과 관계없는 질문은 Claude가 "관계없음"으로만 판단하고, 화면에는 `config.js` 의 `OFFTOPIC` 문구가 나옵니다. 이때도 판단을 위해 1회로 셉니다.
- 하루 제한: **방문자 1명 20회**, 같은 접속 주소 200회, 사이트 전체 20,000회. 질문 길이와 관계없이 1번 = 1회이고, 한 번에 200자까지 받습니다.
- 크레딧이 떨어지거나 제한을 넘으면 자동으로 무료 단어 검색으로 바뀝니다.

### ① Claude Console 준비 (결제)
1. [platform.claude.com](https://platform.claude.com) 에 가입합니다.
2. **Settings → Billing** 에서 **Buy credits** 로 크레딧을 충전합니다. 처음엔 5달러 정도면 충분합니다. 선불 방식이며, 크레딧은 구매일로부터 1년 뒤 만료되고 환불되지 않습니다.
3. 자동 충전(auto-reload)은 처음엔 **끈 채로** 두고, 사용량을 본 뒤 정하세요.
4. (권장) 이 사이트 전용 **Workspace** 를 만들고 **지출 한도(spend limit)** 를 걸어 둡니다.
5. **API Keys → Create Key** 로 키를 만들고 복사해 둡니다. (`sk-ant-` 로 시작) **이 키는 깃허브나 `config.js` 에 절대 넣지 마세요.**

### ② Supabase에 서버 기능 만들기
1. `supabase-setup.sql` 을 아직 실행하지 않았다면 실행합니다. (이미 실행했어도 새 파일로 **다시 Run** 하세요. 학군 열과 AI 사용 기록 표가 추가됩니다. 기존 매물은 지워지지 않습니다.)
2. Supabase 왼쪽 **Edge Functions → Deploy a new function → Via Editor**.
3. 함수 이름을 **`ai-search`** 로 정합니다. (`config.js` 의 `AI_FUNCTION` 과 같아야 합니다)
4. 편집기 안의 예시 코드를 모두 지우고, `supabase/functions/ai-search/index.ts` 내용을 통째로 붙여 넣은 뒤 **Deploy function**.
5. **Edge Functions → Secrets** 에서 Key `ANTHROPIC_API_KEY`, Value 에 ①-5의 키를 넣고 **Save**.
6. 사이트에서 채팅창에 "아리팍 30평대"를 보내 보세요. 아래 "오늘 남은 AI 검색"이 19회로 줄면 연결된 것입니다.

> 횟수 제한을 바꾸려면 Secrets 에 `AI_LIMIT_VISITOR`(방문자별), `AI_LIMIT_IP`(접속 주소별), `AI_LIMIT_ALL`(사이트 전체) 을 숫자로 넣으세요. 화면 숫자는 `config.js` 의 `AI_DAILY_LIMIT` 도 같이 바꿉니다.
> AI를 잠시 끄려면 `config.js` 의 `AI_ENABLED` 를 `false` 로 바꿔 올리면 됩니다. (단어 검색만 사용, 비용 0원)

### 비용 (참고)
- `claude-haiku-5-5` 가격: 입력 100만 토큰당 0.10달러, 출력 100만 토큰당 0.50달러 ([Claude 문서](https://platform.claude.com/docs/en/models/haiku-5-5/overview))
- 검색 1번에 대략 0.3~0.8원으로 예상합니다. (환율 1,337.7원, 2026-10-28 기준. 실제는 문장 길이에 따라 다름)
- 관리자 화면 위쪽에 **오늘 AI 매물찾기 사용 횟수**와 예상 비용이 표시됩니다. 정확한 금액은 Claude Console 의 **Cost** 화면에서 확인하세요.

---

## 2단계. 깃허브에 올리기

### 2-1. 계정과 저장소 만들기
1. [github.com](https://github.com) 에 가입합니다. (아이디가 사이트 주소에 들어갑니다. 예: `banpopro`)
2. 오른쪽 위 **+ → New repository**.
3. Repository name: `banana-market` (영문 소문자 추천)
4. **Public** 선택 (무료 플랜에서 GitHub Pages를 쓰려면 공개 저장소여야 합니다)
5. **Create repository**.

### 2-2. 파일 올리기 (웹 화면에서, 프로그램 설치 없이)
1. 만든 저장소 화면에서 **uploading an existing file** 링크(또는 **Add file → Upload files**)를 누릅니다.
2. 압축을 푼 `banana-market` 폴더를 열고, **폴더 안의 내용물 전체**(`index.html`, `config.js`, `admin` 폴더, `assets` 폴더, … )를 선택해 브라우저 화면에 끌어다 놓습니다.
   - `banana-market` 폴더 자체를 올리면 주소가 한 단계 깊어집니다. 꼭 **안의 내용물**을 올리세요.
   - 크롬·엣지에서는 폴더를 끌어다 놓으면 하위 폴더 구조가 그대로 올라갑니다.
3. 아래 **Commit changes** 버튼을 누릅니다.
4. 저장소 첫 화면에 `index.html` 이 맨 위 목록에 보이고, `admin`, `assets` 폴더가 있으면 성공입니다.

### 2-3. 사이트로 공개하기 (GitHub Pages)
1. 저장소 위쪽 **Settings → (왼쪽) Pages**.
2. **Source: Deploy from a branch**, **Branch: `main` / `(root)`** 를 고르고 **Save**.
3. 1~5분 뒤 같은 화면 위쪽에 사이트 주소가 나타납니다.
   - 손님 화면: `https://아이디.github.io/banana-market/`
   - 관리자 화면: `https://아이디.github.io/banana-market/admin/`
4. 관리자 화면에서 1단계에서 만든 이메일·비밀번호로 로그인해 매물을 등록해 보세요.

### 2-4. 나중에 고칠 때
- 깃허브 저장소에서 파일을 눌러 연필 아이콘(**Edit**)으로 고친 뒤 **Commit changes** 를 누르면, 1~2분 뒤 사이트에 반영됩니다.
- 여러 파일을 한꺼번에 바꿀 때는 2-2처럼 **Upload files** 로 같은 이름의 파일을 다시 올리면 덮어씁니다.
- 매물은 파일이 아니라 관리자 화면에서 관리합니다.

---

## 3단계. 내 도메인 연결 (선택)

1. 가비아·후이즈 등에서 도메인을 삽니다. (예: `banamarket.kr`)
2. 깃허브 **Settings → Pages → Custom domain** 에 도메인을 넣고 **Save**.
3. 도메인 구입처의 **DNS 관리**에서 깃허브 안내에 나오는 값을 넣습니다. 보통 아래와 같습니다.
   - 루트 도메인(`banamarket.kr`): **A 레코드** 4개 → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` 주소: **CNAME** → `아이디.github.io`
4. 반영되면 Pages 화면에서 **Enforce HTTPS** 를 켭니다. (몇 분~몇 시간 걸릴 수 있음)
5. `robots.txt`, `sitemap.xml` 안의 `YOUR-DOMAIN.kr` 을 실제 도메인으로 바꿔 다시 올립니다.

> 깃허브 안내 화면의 값이 위와 다르면 **깃허브 화면의 값**을 따르세요.

---

## 4단계. 네이버 검색 등록 (선택)

1. [searchadvisor.naver.com](https://searchadvisor.naver.com) → 웹마스터 도구 → 사이트 등록.
2. 소유 확인은 **HTML 태그** 방식: `index.html` 위쪽의 주석 처리된 `naver-site-verification` 줄을 풀고 값을 넣어 다시 올린 뒤 확인.
3. **요청 → 사이트맵 제출** 에 `https://내도메인/sitemap.xml`.
4. 구글은 [Search Console](https://search.google.com/search-console) → 속성 추가 → **URL 접두어** → 확인 방법 **HTML 태그**. `index.html` 위쪽의 `google-site-verification` 줄 주석을 풀고 값을 넣어 올린 뒤 확인 → **Sitemaps** 에 `sitemap.xml` 제출.

검색 노출 시점과 순위는 네이버가 정하며 보장되지 않습니다. 카페·블로그에 사이트 주소를 자주 소개하면 도움이 됩니다.

---

## 문제가 생기면

| 증상 | 확인할 것 |
| --- | --- |
| "지금은 샘플 화면입니다"가 보인다 | `config.js` 에 Supabase 주소와 키를 넣고 다시 올렸는지 |
| 관리자 화면에 "미리보기 모드" 안내가 보인다 | 위와 같음 |
| "정보를 불러오지 못했습니다" | `supabase-setup.sql` 을 실행했는지, 주소·키에 오타가 없는지 |
| 로그인은 되는데 저장이 안 된다 | SQL의 관리자 이메일과 로그인 이메일이 같은지. 다르면 SQL을 고쳐 다시 Run |
| 고쳤는데 그대로 보인다 | 1~2분 기다린 뒤 새로고침. 휴대폰은 브라우저 캐시 때문에 조금 더 걸릴 수 있음 |
| 채팅에 "AI 연결이 원활하지 않아 단어 검색으로 찾았어요"가 나온다 | 함수 이름이 `ai-search` 인지, Secrets 에 `ANTHROPIC_API_KEY` 가 있는지, Claude 크레딧이 남았는지. Supabase **Edge Functions → ai-search → Logs** 에서 오류를 확인 |
| 채팅 아래에 "오늘 남은 AI 검색"이 보이지 않는다 | `config.js` 에 Supabase 주소·키가 아직 없거나 `AI_ENABLED` 가 `false` |
| 404 페이지가 뜬다 | 파일을 폴더째 올리지 않았는지(2-2), Pages의 Branch가 `main` / `(root)` 인지 |

## 운영 메모
- **서버 업데이트**: 새 기능 때문에 서버 설정이 바뀌면 `supabase-update.sql` 을 SQL Editor 에 붙여 넣고 Run 하세요. 관리자 이메일을 바꿀 필요가 없고 기존 매물은 그대로 남습니다. (`supabase-setup.sql` 을 다시 실행할 때는 **관리자 이메일을 꼭 다시 바꿔 넣어야** 합니다. 그대로 실행하면 관리자 로그인 후 저장이 막힙니다)
- **해당 층 표시**: 매물 등록 때 해당 층을 숫자 대신 **저층·중층·고층** 으로 고를 수 있습니다. 의뢰인이 정확한 층 공개를 원하지 않을 때 쓰세요.
- **동·지번 표시**: 아파트 인터넷 광고에는 소재지(지번), 동, 층수를 표시해야 합니다. 매물 등록 때 **동**은 꼭 입력해야 저장되고, 지번은 **단지 관리**의 주소 칸에 지번 주소로 넣어 두면 매물 소재지에 함께 표시됩니다. (최신 `supabase-setup.sql` 을 다시 Run 해야 동 칸이 저장됩니다)
- **접속 주소(IP)**: AI 검색 횟수 제한을 위해 IP를 쓰지만, 원래 주소를 알아볼 수 없게 바꾼 값만 저장하고 30일 지난 기록은 자동으로 지웁니다.
- **확인일 갱신**: 매물을 다시 확인했으면 관리자 화면 매물 목록에서 **확인일 갱신**을 누르세요. 손님 화면의 "확인 MM.DD"가 누른 날짜로 바뀌고, "최신 확인순"에서 위로 올라갑니다. 등록일은 그대로 남습니다. (이 기능은 `supabase-setup.sql` 최신본을 실행해야 동작합니다. 예전에 실행했다면 다시 Run 하세요. 기존 매물의 확인일은 등록일로 채워집니다.)
- Supabase 무료 플랜은 오래 접속이 없으면 서버가 잠시 멈출 수 있습니다. 멈추면 Supabase 화면에서 **Restore** 를 누르세요.
- 백업: Supabase **Table Editor** 에서 `listings`, `complexes` 를 가끔 CSV로 내려받아 두세요.
- 매물 광고에는 공인중개사법상 표시 의무(중개사무소 명칭·등록번호 등)와 허위·과장 광고 금지 규정이 있습니다. 광고 내용이 법령에 맞는지 직접 확인하세요.
