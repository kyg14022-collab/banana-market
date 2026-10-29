/* 반아나 마켓 공통 코드 (손님 화면·관리자 화면에서 함께 씁니다) */
(function () {
  var cfg = window.APP_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/.test(cfg.SUPABASE_URL) && !/YOUR-/.test(cfg.SUPABASE_ANON_KEY));
  var sb = null;
  if (configured && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- 금액·면적 표기 ---------- */
  var won = function (p) {
    var u = Math.floor(p + 1e-9), m = Math.round((p - u) * 10000);
    return (u ? u + '억' : '') + (m ? ' ' + m.toLocaleString() + '만' : '') || '0';
  };
  var price = function (l) {
    return won(l.price);
  };
  var py = function (m) { return Math.round(m / 3.3058); };
  var lvl = function (l) {
    if (l.flv) return l.flv;
    var r = l.floor / l.total;
    return r <= 1 / 3 ? '저층' : r <= 2 / 3 ? '중층' : '고층';
  };

  /* ---------- 검색 범주 ---------- */
  var DIRS = ['남향', '남동향', '남서향', '동향', '서향', '북향', '북동향', '북서향'];
  var PY = [['p0', '20평대 미만'], ['p2', '20평대'], ['p3', '30평대'], ['p4', '40평대 이상']];
  var BANDS = [['~19', '20억 미만'], ['20', '20억대'], ['30', '30억대'], ['40', '40억대'], ['50', '50억대'], ['60', '60억대'], ['70+', '70억 이상(70·80·90·100억대)']];
  var GAP = [['갭투', '갭투 (임차인 있는 매물)'], ['입주', '입주 (실입주 가능)']];
  var HH = [['h0', '100세대 미만'], ['h1', '100~500세대 미만'], ['h2', '500~1,000세대 미만'], ['h3', '1,000~3,000세대 미만'], ['h4', '3,000세대 이상']];
  var AGES = [['a0', '입주예정'], ['a1', '5년 미만'], ['a2', '5년~10년 미만'], ['a3', '10년~20년 미만'], ['a4', '20년~30년 미만'], ['a5', '30년 이상']];

  var band = function (p) { return p < 20 ? '~19' : p >= 70 ? '70+' : String(Math.floor(p / 10) * 10); };
  var pyOf = function (l) {
    if (l.pyc) return l.pyc;
    var p = py(l.supply);
    return p < 20 ? 'p0' : p < 30 ? 'p2' : p < 40 ? 'p3' : 'p4';
  };
  var hOf = function (l, C) {
    var c = C.find(function (x) { return x.n === l.cx; });
    var h = (c && c.h) || 0;
    return h < 100 ? 'h0' : h < 500 ? 'h1' : h < 1000 ? 'h2' : h < 3000 ? 'h3' : 'h4';
  };
  /* 오늘 날짜 기준 만 나이 방식으로 계산 */
  var ageOf = function (l, C) {
    var c = C.find(function (x) { return x.n === l.cx; });
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec((c && c.ap) || l.approval || '');
    if (!m) return '';
    var t = new Date(), ty = t.getFullYear(), tm = t.getMonth() + 1, td = t.getDate();
    var y = +m[1], mo = +m[2], dd = +m[3];
    var before = tm < mo || (tm === mo && td < dd);
    if (y > ty || (y === ty && before)) return 'a0';
    var a = ty - y - (before ? 1 : 0);
    return a < 5 ? 'a1' : a < 10 ? 'a2' : a < 20 ? 'a3' : a < 30 ? 'a4' : 'a5';
  };
  /* 준공 후 경과 연수 (모르면 null) */
  var yearsOf = function (l, C) {
    var c = C.find(function (x) { return x.n === l.cx; });
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec((c && c.ap) || l.approval || '');
    if (!m) return null;
    return (Date.now() - new Date(+m[1], +m[2] - 1, +m[3]).getTime()) / (365.25 * 864e5);
  };
  /* 동 표기: '101' → '101동' */
  var dong = function (v) { v = String(v || '').trim(); return !v ? '' : /동$/.test(v) ? v : v + '동'; };
  /* 층 표기: 숫자로 올린 매물은 '중층 20/35층', 저·중·고로만 올린 매물은 '고층 · 총 35층' */
  var hasNo = function (l) { return !l.flv && l.floor != null && l.floor !== ''; };
  var floorTxt = function (l) { return hasNo(l) ? lvl(l) + ' ' + l.floor + '/' + l.total + '층' : lvl(l) + ' · 총 ' + l.total + '층'; };
  var floorShort = function (l) { return hasNo(l) ? l.floor + '/' + l.total : lvl(l) + '/' + l.total; };
  var floorDetail = function (l) { return hasNo(l) ? lvl(l) + ' (해당 ' + l.floor + '층 / 총 ' + l.total + '층)' : lvl(l) + ' (총 ' + l.total + '층)'; };
  var todayStr = function () {
    var t = new Date();
    return t.getFullYear() + '.' + String(t.getMonth() + 1).padStart(2, '0') + '.' + String(t.getDate()).padStart(2, '0');
  };
  /* 서버 시각을 한국 날짜로 */
  var kstDate = function (ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };
  var regStr = function (l) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(l.reg || '');
    return m ? m[1] + '.' + m[2] + '.' + m[3] : '';
  };

  /* ---------- 서버 ↔ 화면 데이터 변환 ---------- */
  var mapComplex = function (r) {
    return { id: r.id, n: r.name, d: r.dong, h: r.households || 0, ap: r.approval_date || '', a: r.address || '' };
  };
  var mapListing = function (r, byId) {
    var c = byId[r.complex_id] || {};
    return {
      id: r.id, cid: r.complex_id, cx: c.n || '', addr: r.address || '',
      deal: r.deal, price: Number(r.price),
      area: Number(r.exclusive_area), supply: Number(r.supply_area),
      pyc: r.py_cat, pyt: r.py_text, floor: r.floor_no, flv: r.floor_level || '', total: r.total_floors,
      moveIn: r.move_in, rooms: r.rooms, baths: r.baths, approval: r.approval_date || '',
      parking: r.parking, mgmt: r.mgmt_fee, dir: r.direction, gap: r.gap || '',
      tag: r.tagline || '', desc: r.description || '', school: r.school || '', bldg: r.building || '', rec: !!r.recommended,
      reg: kstDate(r.checked_at || r.created_at), ts: r.checked_at || r.created_at || ''
    };
  };
  var mapBroker = function (r) {
    r = r || {};
    return { name: r.name || '', rep: r.rep || '', reg: r.reg_no || '', addr: r.address || '', tel: r.tel || '' };
  };

  /* 샘플 (서버 연결 전에 화면만 볼 때 쓰입니다) */
  var DEMO = function () {
    var C = [
      { id: 1, n: '아크로리버파크', d: '반포동', h: 1612, ap: '2016-08-12', a: '서울 서초구 신반포로 47' },
      { id: 2, n: '래미안원베일리', d: '반포동', h: 2990, ap: '2023-08-01', a: '' },
      { id: 3, n: '반포자이', d: '반포동', h: 3410, ap: '2008-09-30', a: '' },
      { id: 4, n: '신반포자이', d: '잠원동', h: 607, ap: '2018-07-31', a: '' }
    ];
    var base = { rooms: 3, baths: 2, parking: '세대당 1.5대', mgmt: 50, gap: '', rec: true, addr: '', school: '', bldg: '', desc: '※ 샘플 매물입니다.' };
    var L = [
      Object.assign({}, base, { id: 1, cid: 1, cx: '아크로리버파크', bldg: '101동', deal: '매매', gap: '갭투', price: 62, area: 84, supply: 112, pyc: 'p3', pyt: '34평형', floor: 22, total: 35, moveIn: '협의', approval: '2016-08-12', dir: '남향', tag: '한강 조망 · 올수리', school: '※ 샘플: [배정 초등학교] · [인근 중·고교]', reg: '2026-10-16', ts: '2026-10-16T01:00:00Z' }),
      Object.assign({}, base, { id: 3, cid: 2, cx: '래미안원베일리', bldg: '102동', deal: '매매', gap: '입주', price: 45.5, area: 74, supply: 99, pyc: 'p3', pyt: '30평형', floor: 10, total: 29, moveIn: '즉시', approval: '2023-08-01', dir: '남서향', tag: '신축 · 즉시 입주', reg: '2026-10-14', ts: '2026-10-14T01:00:00Z' }),
      Object.assign({}, base, { id: 4, cid: 4, cx: '신반포자이', bldg: '103동', deal: '매매', gap: '갭투', price: 28, area: 59, supply: 84, pyc: 'p2', pyt: '25평형', floor: 6, total: 28, moveIn: '협의', approval: '2018-07-31', dir: '남동향', tag: '역세권 · 깔끔한 내부', rec: false, rooms: 3, baths: 2, reg: '2026-10-12', ts: '2026-10-12T01:00:00Z' })
    ];
    return { C: C, L: L, B: mapBroker({ name: '반포프로공인중개사사무소', rep: '김준한', reg_no: '11650-2026-00085', address: '서울특별시 서초구 잠원로4길50, 1층 2-125호(잠원동, 메이플자이상가)', tel: cfg.TEL || '' }), demo: true };
  };

  var loadData = async function () {
    if (!sb) return DEMO();
    var res = await Promise.all([
      sb.from('complexes').select('*').order('name'),
      sb.from('listings').select('*').order('created_at', { ascending: false }),
      sb.from('broker').select('*').eq('id', 1).maybeSingle()
    ]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    var C = (res[0].data || []).map(mapComplex);
    var byId = {};
    C.forEach(function (c) { byId[c.id] = c; });
    var L = (res[1].data || []).filter(function (r) { return r.deal === '매매'; }).map(function (r) { return mapListing(r, byId); });
    return { C: C, L: L, B: mapBroker(res[2] && res[2].data), demo: false };
  };

  window.BM = {
    cfg: cfg, configured: configured, sb: sb, esc: esc, won: won, price: price, py: py, lvl: lvl,
    DIRS: DIRS, PY: PY, BANDS: BANDS, GAP: GAP, HH: HH, AGES: AGES,
    dong: dong, floorTxt: floorTxt, floorShort: floorShort, floorDetail: floorDetail, band: band, pyOf: pyOf, hOf: hOf, ageOf: ageOf, yearsOf: yearsOf,
    todayStr: todayStr, kstDate: kstDate, regStr: regStr, loadData: loadData
  };
})();
