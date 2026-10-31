/* 반아나 마켓 말로 찾기
   - 소개 질문(김준한 소장, 반아나 마켓)은 AI 없이 정해진 문구로 답합니다. (비용 0원)
   - 매물 질문은 Claude(서버 기능 ai-search)가 조건으로 바꿉니다.
   - AI를 쓸 수 없을 때(설정 전, 크레딧 소진, 하루 횟수 초과)는 아래 무료 단어 검색으로 찾습니다.
   - 어느 쪽이든 매물은 관리자 화면에 올린 매물 중에서만 찾습니다. */
(function () {
  var B = window.BM;

  /* ---------- 단지 별칭 (줄여 부르는 이름) ---------- */
  var ALIAS = {
    '아리팍': '아크로리버파크', '아크로리버파크': '아크로리버파크',
    '원베일리': '래미안원베일리', '원베': '래미안원베일리',
    '퍼스티지': '래미안퍼스티지', '래퍼': '래미안퍼스티지',
    '반자': '반포자이', '원펜타스': '래미안원펜타스', '리버뷰': '아크로리버뷰신반포',
    '신반포팰리스': '래미안신반포팰리스', '신반포자이': '신반포자이', '리체': '반포리체'
  };

  /* ---------- 소개 질문 (AI를 거치지 않음) ---------- */
  var intro = function (q) {
    var s = q.replace(/\s+/g, '');
    if (/(김준한|소장|대표|중개사)/.test(s) && /(누구|소개|어떤|어떻|뭐하|알려)/.test(s)) return 'kim';
    if (/반아나/.test(s) && /(뜻|의미|무슨|뭐|이름|어떤|소개)/.test(s)) return 'name';
    return '';
  };

  /* ---------- 무료 단어 검색: 문장 → 조건 ---------- */
  var num = function (s) { return parseFloat(String(s).replace(/,/g, '')); };
  var parse = function (q, C) {
    var t = ' ' + q.replace(/억원/g, '억').replace(/\s+/g, ' ') + ' ', f = {};
    var take = function (re) { var m = re.exec(t); if (m) t = t.replace(m[0], ' '); return m; };

    /* 단지 */
    var names = C.map(function (c) { return c.n; }).sort(function (a, b) { return b.length - a.length; });
    var cx = [];
    names.forEach(function (n) { var k = t.replace(/\s/g, ''); if (k.indexOf(n) >= 0) { cx.push(n); t = t.split(n).join(' '); } });
    Object.keys(ALIAS).sort(function (a, b) { return b.length - a.length; }).forEach(function (a) {
      var n = ALIAS[a];
      if (t.indexOf(a) >= 0 && names.indexOf(n) >= 0) { if (cx.indexOf(n) < 0) cx.push(n); t = t.split(a).join(' '); }
    });
    if (cx.length) f.cx = cx;

    /* 학교 이름 (예: 반포초, 세화고) — 동 이름보다 먼저 떼어 냄 */
    var words = [];
    var sch = t.match(/[가-힣]{2,4}(?:초|중|고)(?=등학교|학교|\s|$|[,.·은는이가을를에도요랑])/g);
    if (sch) sch.forEach(function (w) { if (words.indexOf(w) < 0) { words.push(w); t = t.split(w).join(' '); } });

    if (/반포/.test(t) && !/잠원/.test(t)) f.dong = '반포동';
    if (/잠원/.test(t) && !/반포/.test(t)) f.dong = '잠원동';

    /* 금액 (억) */
    var m;
    if ((m = take(/(\d+(?:\.\d+)?)\s*억?\s*(?:~|-|에서)\s*(\d+(?:\.\d+)?)\s*억/))) { f.priceMin = num(m[1]); f.priceMax = num(m[2]); }
    else {
      if ((m = take(/(\d+(?:\.\d+)?)\s*억\s*(?:이하|이내|안쪽|안으로|미만|까지|아래|밑|내외)/))) f.priceMax = num(m[1]);
      if ((m = take(/(\d+(?:\.\d+)?)\s*억\s*(?:이상|넘는|넘게|초과|부터|위)/))) f.priceMin = num(m[1]);
      if (f.priceMin == null && f.priceMax == null && (m = take(/(\d+)\s*억\s*대/))) { f.priceMin = num(m[1]); f.priceMax = num(m[1]) + 9.99; }
      if (f.priceMin == null && f.priceMax == null && (m = take(/(?:예산|자금|가격|금액)?\s*(\d+(?:\.\d+)?)\s*억/))) f.priceMax = num(m[1]);
    }

    /* 평형 */
    var cat = function (p) { return p < 20 ? 'p0' : p < 30 ? 'p2' : p < 40 ? 'p3' : 'p4'; };
    if (/국평|국민\s*평형/.test(t)) f.pyc = ['p3'];
    if ((m = take(/(\d+)\s*평\s*대/))) f.pyc = [cat(num(m[1]))];
    else if ((m = take(/(\d+)\s*평(?:형)?\s*(이상|넘는)/))) f.pyc = ['p0', 'p2', 'p3', 'p4'].slice(['p0', 'p2', 'p3', 'p4'].indexOf(cat(num(m[1]))));
    else if ((m = take(/(\d+)\s*평/))) f.pyc = [cat(num(m[1]))];
    if ((m = take(/(?:전용\s*)?(\d{2,3})\s*(?:㎡|m2|제곱|타입)/))) { f.areaMin = num(m[1]) - 3; f.areaMax = num(m[1]) + 3; }
    if (!f.pyc && /넓은|대형/.test(t)) f.pyc = ['p4'];
    if (!f.pyc && /소형/.test(t)) f.pyc = ['p0', 'p2'];

    /* 갭투 / 입주 */
    var g1 = /갭|임차인|전세\s*끼/.test(t), g2 = /입주|실거주|바로\s*들어|들어가\s*살|직접\s*살/.test(t);
    if (g1 && !g2) f.gap = '갭투';
    if (g2 && !g1) f.gap = '입주';

    /* 방향 */
    var dirs = [];
    ['남동향', '남서향', '북동향', '북서향', '남향', '동향', '서향', '북향'].forEach(function (d) { if (t.indexOf(d) >= 0) { dirs.push(d); t = t.split(d).join(' '); } });
    if (dirs.length) f.dirs = dirs;

    /* 층 */
    var lv = [];
    if (/로열층/.test(t)) lv = ['중층', '고층'];
    ['저층', '중층', '고층'].forEach(function (x) { if (t.indexOf(x) >= 0 && lv.indexOf(x) < 0) lv.push(x); });
    if (lv.length) f.lvl = lv;

    /* 연식 · 단지 규모 */
    if (/준신축/.test(t)) f.ageMax = 10;
    else if (/신축|새\s*아파트/.test(t)) f.ageMax = 5;
    if ((m = take(/(\d+)\s*년\s*(?:이내|미만|안|안쪽|이하)/))) f.ageMax = num(m[1]);
    if (/대단지/.test(t)) f.hhMin = 1000;
    if ((m = take(/(\d[\d,]*)\s*세대\s*이상/))) f.hhMin = num(m[1]);

    /* 특징 단어 (매물 설명·학군에서 찾음) */
    ['한강', '조망', '올수리', '리모델링', '확장', '학원가', '역세권', '테라스', '복층', '펜트하우스', '코너', '커뮤니티', '초품아', '숲세권', '공원'].forEach(function (w) { if (t.indexOf(w) >= 0) words.push(w); });
    if (/학군/.test(t) && !sch) words.push('학군');
    if (words.length) f.words = words;

    return f;
  };

  /* ---------- 조건 → 매물 ---------- */
  var hay = function (l) { return [l.cx, l.tag, l.desc, l.school].join(' '); };
  var apply = function (f, L, C) {
    var base = function (l) {
      var c = C.find(function (x) { return x.n === l.cx; }) || {};
      if (f.cx && f.cx.length && f.cx.indexOf(l.cx) < 0) return false;
      if (f.dong && c.d && c.d !== f.dong) return false;
      if (f.priceMin != null && l.price < f.priceMin) return false;
      if (f.priceMax != null && l.price > f.priceMax) return false;
      if (f.pyc && f.pyc.length && f.pyc.indexOf(B.pyOf(l)) < 0) return false;
      if (f.areaMin != null && l.area < f.areaMin) return false;
      if (f.areaMax != null && l.area > f.areaMax) return false;
      if (f.gap && l.gap !== f.gap) return false;
      if (f.dirs && f.dirs.length && f.dirs.indexOf(l.dir) < 0) return false;
      if (f.lvl && f.lvl.length && f.lvl.indexOf(B.lvl(l)) < 0) return false;
      if (f.ageMax != null) { var y = B.yearsOf(l, C); if (y == null || y > f.ageMax) return false; }
      if (f.hhMin != null && (c.h || 0) < f.hhMin) return false;
      return true;
    };
    var hit = L.filter(base), dropped = [];
    if (f.words && f.words.length) {
      var withW = hit.filter(function (l) { var h = hay(l); return f.words.every(function (w) { return h.indexOf(w) >= 0; }); });
      if (withW.length || !hit.length) hit = withW; else dropped = f.words.slice();
    }
    return { list: hit, dropped: dropped };
  };

  /* ---------- 알아들은 조건을 사람이 읽는 말로 ---------- */
  var pyName = { p0: '20평 미만', p2: '20평대', p3: '30평대', p4: '40평대 이상' };
  var chips = function (f) {
    var out = [];
    if (f.cx && f.cx.length) out.push(f.cx.join(', '));
    if (f.dong) out.push(f.dong);
    if (f.priceMin != null && f.priceMax != null) out.push(f.priceMax - f.priceMin > 9 && f.priceMax % 10 > 9 ? f.priceMin + '억대' : f.priceMin + '~' + f.priceMax + '억');
    else if (f.priceMax != null) out.push(f.priceMax + '억 이하');
    else if (f.priceMin != null) out.push(f.priceMin + '억 이상');
    if (f.pyc && f.pyc.length) out.push(f.pyc.map(function (p) { return pyName[p]; }).join('·'));
    if (f.areaMin != null) out.push('전용 ' + Math.round((f.areaMin + f.areaMax) / 2) + '㎡ 전후');
    if (f.gap) out.push(f.gap === '갭투' ? '갭투(임차인 있음)' : '입주 가능');
    if (f.dirs && f.dirs.length) out.push(f.dirs.join('·'));
    if (f.lvl && f.lvl.length) out.push(f.lvl.join('·'));
    if (f.ageMax != null) out.push('준공 ' + f.ageMax + '년 이내');
    if (f.hhMin != null) out.push(f.hhMin.toLocaleString() + '세대 이상');
    if (f.words && f.words.length) out.push('“' + f.words.join('”, “') + '”');
    return out;
  };
  var empty = function (f) { return !chips(f).length; };

  /* AI가 돌려준 조건을 안전한 모양으로 정리 */
  var clean = function (f, C) {
    f = f && typeof f === 'object' ? f : {};
    var arr = function (v, ok) { return (Array.isArray(v) ? v : v ? [v] : []).map(String).filter(ok).slice(0, 10); };
    var n = function (v) { var x = Number(v); return isFinite(x) && x > 0 ? x : null; };
    var names = C.map(function (c) { return c.n; });
    var o = {};
    var cx = arr(f.cx, function (s) { return names.indexOf(s) >= 0; }); if (cx.length) o.cx = cx;
    if (f.dong === '반포동' || f.dong === '잠원동') o.dong = f.dong;
    ['priceMin', 'priceMax', 'areaMin', 'areaMax', 'ageMax', 'hhMin'].forEach(function (k) { var v = n(f[k]); if (v != null) o[k] = v; });
    var pyc = arr(f.pyc, function (s) { return /^p[0234]$/.test(s); }); if (pyc.length) o.pyc = pyc;
    if (f.gap === '갭투' || f.gap === '입주') o.gap = f.gap;
    var dirs = arr(f.dirs, function (s) { return B.DIRS.indexOf(s) >= 0; }); if (dirs.length) o.dirs = dirs;
    var lv = arr(f.lvl, function (s) { return ['저층', '중층', '고층'].indexOf(s) >= 0; }); if (lv.length) o.lvl = lv;
    var w = arr(f.words, function (s) { return s.length >= 1 && s.length <= 12; }); if (w.length) o.words = w;
    if (o.areaMin != null && o.areaMax == null) o.areaMax = o.areaMin + 6;
    if (o.areaMax != null && o.areaMin == null) o.areaMin = o.areaMax - 6;
    return o;
  };

  /* ---------- 하루 사용 횟수 (화면 표시용, 실제 제한은 서버가 함) ---------- */
  var LIMIT = (B.cfg.AI_DAILY_LIMIT || 20);
  var dayKey = function () { return B.kstDate(new Date().toISOString()); };
  var used = function () {
    try { var o = JSON.parse(localStorage.getItem('bm_ai') || '{}'); return o.d === dayKey() ? (o.n || 0) : 0; } catch (e) { return 0; }
  };
  var setUsed = function (n) { try { localStorage.setItem('bm_ai', JSON.stringify({ d: dayKey(), n: n })); } catch (e) {} };
  var vid = function () {
    try { var v = localStorage.getItem('bm_vid'); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bm_vid', v); } return v; }
    catch (e) { return 'na'; }
  };

  /* ---------- AI 호출 ---------- */
  var MAXLEN = 200;
  var askAI = async function (q) {
    if (!B.sb || B.cfg.AI_ENABLED === false) return { type: 'off' };
    if (used() >= LIMIT) return { type: 'limit', left: 0 };
    try {
      var r = await B.sb.functions.invoke(B.cfg.AI_FUNCTION || 'ai-search', { body: { q: q.slice(0, MAXLEN), vid: vid() } });
      if (r.error || !r.data) return { type: 'error' };
      var d = r.data;
      if (typeof d.left === 'number') setUsed(LIMIT - d.left); else if (d.type !== 'limit') setUsed(used() + 1);
      if (d.type === 'limit') setUsed(LIMIT);
      return d;
    } catch (e) { return { type: 'error' }; }
  };

  window.BMS = { intro: intro, parse: parse, apply: apply, chips: chips, empty: empty, clean: clean, askAI: askAI, used: used, vid: vid, LIMIT: LIMIT, MAXLEN: MAXLEN };
})();
