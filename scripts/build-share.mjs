// 매물마다 공유용 페이지(m/<번호>.html)를 만듭니다.
// 카페·카톡에 https://banana-market.co.kr/m/<번호> 링크를 올리면 미리보기에 그 매물 정보가 나오고,
// 누르면 사이트의 해당 매물 화면으로 바로 넘어갑니다.
// GitHub Actions(.github/workflows/share-pages.yml)가 주기적으로 실행합니다. 직접 실행: node scripts/build-share.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://banana-market.co.kr';
const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const pick = (k) => (cfg.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1];
const URL_ = pick('SUPABASE_URL'), KEY = pick('SUPABASE_ANON_KEY');
if (!URL_ || !KEY) throw new Error('config.js 에서 Supabase 주소/키를 찾지 못했습니다');

const get = async (q) => {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: { apikey: KEY } });
  if (!r.ok) throw new Error(q + ' ' + r.status + ' ' + (await r.text()));
  return r.json();
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (p) => { const u = Math.floor(p + 1e-9), m = Math.round((p - u) * 10000); return ((u ? u + '억' : '') + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : '')) || '0'; };
const dong = (v) => { v = String(v || '').trim(); return !v ? '' : /동$/.test(v) ? v : v + '동'; };
const lvl = (l) => l.floor_level || (l.floor_no == null ? '' : (l.floor_no / l.total_floors <= 1 / 3 ? '저층' : l.floor_no / l.total_floors <= 2 / 3 ? '중층' : '고층'));

const [cxs, ls] = await Promise.all([
  get('complexes?select=id,name,dong'),
  get('listings?select=id,complex_id,deal,price,exclusive_area,py_text,floor_no,floor_level,total_floors,direction,gap,tagline,building&deal=eq.%EB%A7%A4%EB%A7%A4'),
]);
const byId = Object.fromEntries(cxs.map((c) => [c.id, c]));

const dir = path.join(ROOT, 'm');
fs.mkdirSync(dir, { recursive: true });
const keep = new Set();
const cards = [];   // 미리보기 그림 목록 (build-share-images.py 가 그림)
let changed = 0;

for (const l of ls) {
  const c = byId[l.complex_id] || {};
  const name = [c.name, dong(l.building), l.py_text].filter(Boolean).join(' ');
  const title = `${name} · 매매 ${won(Number(l.price))}`;
  const desc = [`전용 ${Number(l.exclusive_area)}㎡`, lvl(l), l.direction, l.gap === '입주' ? '입주 가능' : l.gap === '갭투' ? '임차인 있음(갭투)' : '', l.tagline]
    .filter(Boolean).join(' · ') + ` | ${c.dong || ''} · 반아나 마켓`;
  const target = `${SITE}/#listing-${l.id}`;
  // 미리보기 그림: '반포써밋 34평' / '매매 38억' / 반아나 마켓. 내용이 바뀌면 파일 이름도 바뀌어 카페·카톡이 새 그림을 가져갑니다.
  const line1 = [c.name, l.py_text].filter(Boolean).join(' '), line2 = `매매 ${won(Number(l.price))}`;
  const img = `${l.id}-${crypto.createHash('md5').update(line1 + '|' + line2 + '|v1').digest('hex').slice(0, 8)}.png`;
  cards.push({ file: img, line1, line2 });
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | 반아나 마켓</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/m/${l.id}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="반아나 마켓">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/m/${l.id}">
<meta property="og:image" content="${SITE}/m/img/${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px">
<p>${esc(title)}</p>
<p><a href="${esc(target)}">매물 보러 가기</a></p>
</body>
</html>
`;
  const f = path.join(dir, `${l.id}.html`);
  keep.add(`${l.id}.html`);
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== html) { fs.writeFileSync(f, html); changed++; }
}
// 삭제된 매물의 페이지는 지웁니다
for (const f of fs.readdirSync(dir)) {
  if (/^\d+\.html$/.test(f) && !keep.has(f)) { fs.unlinkSync(path.join(dir, f)); changed++; }
}
fs.writeFileSync(path.join(ROOT, 'scripts', '.share-cards.json'), JSON.stringify(cards));
console.log(`매물 ${ls.length}건, 바뀐 공유 페이지 ${changed}개`);
