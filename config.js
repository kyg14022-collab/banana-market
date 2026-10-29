/* ============================================================
   반아나 마켓 설정 파일 — 이 파일만 고치면 됩니다.
   따옴표('')는 지우지 말고, 따옴표 안의 글자만 바꾸세요.
   ============================================================ */
window.APP_CONFIG = {
  /* Supabase > Project Settings > API 에서 복사한 값 */
  SUPABASE_URL: 'https://ywvmvhygqjtvbbqdxuyf.supabase.co
',
  SUPABASE_ANON_KEY: 'sb_publishable_PkHWD1OeDjd5CFrcpcRNQw_MxtC8RYP',   /* anon key 또는 publishable key (secret/service_role 키는 절대 넣지 마세요) */

  /* 손님 문의 연결 */
  KAKAO: 'https://open.kakao.com/o/su2ZwGSi',
  TEL: '010-4951-2233',
  CAFE: 'https://cafe.naver.com/banpobanana',   /* 반아나 네이버 카페 주소 */

  /* 사이트 이름 */
  SITE_NAME: '반아나 마켓',

  /* ---------- AI 매물찾기 ----------
     AI_ENABLED 를 false 로 바꾸면 AI를 쓰지 않고 무료 단어 검색만 합니다. (비용 0원)
     AI_DAILY_LIMIT 는 화면에 보이는 숫자입니다. 실제 제한은 서버 기능(ai-search)이 합니다. */
  AI_ENABLED: true,
  AI_FUNCTION: 'ai-search',
  AI_DAILY_LIMIT: 20,

  /* 손님이 소장님·사이트 이름을 물으면 AI 없이 아래 문구 그대로 보여 줍니다. 자유롭게 고치세요. */
  INTRO_KIM: '김준한 소장은 반포동·잠원동 아파트 거래를 전문으로 하는 공인중개사로, 잠원동 메이플자이상가의 반포프로공인중개사사무소를 운영하고 있어요. 네이버 블로그 "김부장의매물장"과 네이버 카페 "반아나"도 함께 운영합니다.',
  INTRO_NAME: '반아나 마켓은 네이버 카페 "반아나"를 운영하는 김준한 소장이 직접 확인한 반포·잠원 아파트 매물을 모아 둔 곳이에요.',

  /* 매물과 관계없는 질문에 보여 줄 문구 */
  OFFTOPIC: '반아나 마켓에서는 반포·잠원 매물 찾기와 사이트 소개만 도와드려요. 찾으시는 집의 조건을 적어 주세요.\n예) 원베일리 30평대 입주 가능'
};
