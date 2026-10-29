/* 반아나 마켓 관리자 화면
   - config.js에 Supabase 정보가 들어 있으면: 실제 서버에 로그인하고 저장합니다.
   - 비어 있으면: 샘플 데이터로 움직이는 미리보기 모드입니다(저장되지 않음). */
(function () {
  var B = window.BM, sb = B.sb, LIVE = !!sb;
  var esc = B.esc, won = B.won;
  var PY = B.PY, DIRS = B.DIRS;

  /* ---------- 상태 ---------- */
  var S = { broker: {}, complexes: [], listings: [] };
  var view = 'loading', tab = 'list', editing = null, editingC = null, delAsk = null, flash = null, busy = false;
  var $ = function (s) { return document.querySelector(s); };
  var today = function () { var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  var md = function (s) { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[1] + '.' + m[2] : ''; };
  var cx = function (id) { return S.complexes.find(function (c) { return c.id === id; }) || { n: '(삭제된 단지)', d: '' }; };
  var toast = function (t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { e.hidden = true; }, 3200); };
  var opts = function (arr, sel) { return arr.map(function (a) { var v = Array.isArray(a) ? a[0] : a, l = Array.isArray(a) ? a[1] : a; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); };
  var NOTE = LIVE ? '' : '<p class="note">미리보기 모드입니다. config.js에 Supabase 정보를 넣기 전이라 여기서 바꾼 내용은 저장되지 않습니다.</p>';

  /* 서버 오류를 사람이 읽을 수 있는 문장으로 */
  var why = function (e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/row-level security|permission denied|42501/i.test(m + (e && e.code))) return '관리자 권한이 없는 계정입니다. supabase-setup.sql의 관리자 이메일과 로그인 이메일이 같은지 확인해 주세요.';
    if (/schema cache|PGRST204|column .* does not exist|null value in column "floor_no"/i.test(m)) return '서버 설정이 최신이 아니에요. Supabase SQL Editor에서 안내드린 업데이트 SQL을 실행해 주세요.';
    if (/foreign key|23503/i.test(m + (e && e.code))) return '이 단지에 등록된 매물이 있어 처리할 수 없습니다. 매물을 먼저 정리해 주세요.';
    if (/duplicate|unique|23505/i.test(m + (e && e.code))) return '같은 이름의 단지가 이미 있습니다.';
    if (/fetch|network/i.test(m)) return '인터넷 연결 또는 서버 주소를 확인해 주세요.';
    return '저장하지 못했습니다. 잠시 후 다시 시도해 주세요. (' + (m || '알 수 없는 오류') + ')';
  };

  /* ---------- 서버 ↔ 화면 변환 ---------- */
  var fromL = function (r) {
    return { id: r.id, cid: r.complex_id, price: Number(r.price), area: Number(r.exclusive_area), supply: Number(r.supply_area), pyc: r.py_cat, pyt: r.py_text,
      floor: r.floor_no == null ? '' : r.floor_no, flv: r.floor_level || '', total: r.total_floors, moveIn: r.move_in, rooms: r.rooms, baths: r.baths, approval: r.approval_date || '', parking: r.parking,
      mgmt: r.mgmt_fee, dir: r.direction, gap: r.gap || '', tag: r.tagline || '', desc: r.description || '', school: r.school || '', bldg: r.building || '', rec: !!r.recommended, reg: B.kstDate(r.checked_at || r.created_at) };
  };
  var toL = function (l) {
    return { complex_id: l.cid, deal: '매매', price: l.price, exclusive_area: l.area, supply_area: l.supply, py_cat: l.pyc, py_text: l.pyt,
      floor_no: l.flv ? null : l.floor, total_floors: l.total, move_in: l.moveIn, rooms: l.rooms, baths: l.baths, approval_date: l.approval, parking: l.parking,
      mgmt_fee: l.mgmt, direction: l.dir, gap: l.gap || null, tagline: l.tag || null, description: l.desc || null, school: l.school || null, building: l.bldg || null, recommended: !!l.rec };
  };
  /* 저·중·고 표기는 쓸 때만 서버에 보냄 (업데이트 SQL 실행 전에도 숫자 층 등록은 그대로 되도록) */
  var toLx = function (l) { var o = toL(l); if (l.flv || l.wasFlv) o.floor_level = l.flv || null; return o; };
  var fromC = function (r) { return { id: r.id, n: r.name, d: r.dong, h: r.households || 0, ap: r.approval_date || '', a: r.address || '' }; };
  var toC = function (c) { return { name: c.n, dong: c.d, households: c.h || null, approval_date: c.ap || null, address: c.a || null }; };

  /* ---------- 데이터 창구: 서버 또는 미리보기 ---------- */
  var nextId = 100;
  var API = LIVE ? {
    session: async function () { var r = await sb.auth.getSession(); return r.data && r.data.session; },
    login: async function (email, pw) { var r = await sb.auth.signInWithPassword({ email: email, password: pw }); if (r.error) throw r.error; },
    logout: async function () { await sb.auth.signOut(); },
    load: async function () {
      var res = await Promise.all([
        sb.from('complexes').select('*').order('name'),
        sb.from('listings').select('*').order('created_at', { ascending: false }),
        sb.from('broker').select('*').eq('id', 1).maybeSingle()
      ]);
      res.forEach(function (r) { if (r.error) throw r.error; });
      S.complexes = (res[0].data || []).map(fromC);
      S.listings = (res[1].data || []).map(fromL);
      var b = res[2].data || {};
      S.broker = { name: b.name || '', rep: b.rep || '', reg: b.reg_no || '', tel: b.tel || '', addr: b.address || '' };
      try {
        var u = await sb.from('ai_usage').select('hits').eq('who', 'all').eq('day', B.kstDate(new Date().toISOString())).maybeSingle();
        S.aiToday = u.error ? null : ((u.data && u.data.hits) || 0);
      } catch (e) { S.aiToday = null; }
    },
    addL: async function (l) { var r = await sb.from('listings').insert(toLx(l)).select().single(); if (r.error) throw r.error; return fromL(r.data); },
    saveL: async function (id, l) { var r = await sb.from('listings').update(toLx(l)).eq('id', id).select().single(); if (r.error) throw r.error; return fromL(r.data); },
    recL: async function (id, v) { var r = await sb.from('listings').update({ recommended: v }).eq('id', id).select().single(); if (r.error) throw r.error; },
    touchL: async function (id) { var r = await sb.rpc('touch_listing', { p_id: id }); if (r.error) throw r.error; if (!r.data) throw { message: 'permission denied' }; return B.kstDate(r.data); },
    delL: async function (id) { var r = await sb.from('listings').delete().eq('id', id).select(); if (r.error) throw r.error; if (!r.data || !r.data.length) throw { message: 'permission denied' }; },
    addC: async function (c) { var r = await sb.from('complexes').insert(toC(c)).select().single(); if (r.error) throw r.error; return fromC(r.data); },
    saveC: async function (id, c) { var r = await sb.from('complexes').update(toC(c)).eq('id', id).select().single(); if (r.error) throw r.error; return fromC(r.data); },
    saveB: async function (b) { var r = await sb.from('broker').upsert({ id: 1, name: b.name, rep: b.rep, reg_no: b.reg, tel: b.tel, address: b.addr }).select().single(); if (r.error) throw r.error; }
  } : {
    session: async function () { return null; },
    login: async function () {},
    logout: async function () {},
    load: async function () {
      var d = await B.loadData();
      S.complexes = d.C.map(function (c) { return { id: c.id, n: c.n, d: c.d, h: c.h, ap: c.ap, a: c.a }; });
      S.listings = d.L.map(function (l) { return Object.assign({}, l, { cid: l.cid }); });
      S.broker = d.B;
    },
    addL: async function (l) { return Object.assign({}, l, { id: nextId++, reg: today() }); },
    saveL: async function (id, l) { return Object.assign({}, l, { id: id, reg: (S.listings.find(function (x) { return x.id === id; }) || {}).reg }); },
    recL: async function () {},
    touchL: async function () { return today(); },
    delL: async function () {},
    addC: async function (c) { return Object.assign({}, c, { id: nextId++ }); },
    saveC: async function (id, c) { return Object.assign({}, c, { id: id }); },
    saveB: async function () {}
  };

  /* 버튼을 잠그고 작업 → 실패하면 이유를 보여 줌 */
  var run = async function (fn, okMsg) {
    if (busy) return false; busy = true;
    try { await fn(); if (okMsg) toast(okMsg); return true; }
    catch (e) { console.error(e); toast(why(e)); return false; }
    finally { busy = false; }
  };

  /* ---------- 로그인 ---------- */
  function login(msg) {
    $('#logout').hidden = true;
    $('#app').innerHTML = '<div class="login"><h1>관리자 로그인</h1>' +
      '<p class="sub" style="margin:8px 0 0">Supabase에서 만든 관리자 이메일과 비밀번호로 로그인합니다.</p>' +
      '<form class="form" id="lf" novalidate><label for="le" style="margin-top:0">이메일</label><input id="le" type="email" autocomplete="username" required>' +
      '<label for="lp">비밀번호</label><input id="lp" type="password" autocomplete="current-password" required>' +
      '<div id="lerr" class="err"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</div>' +
      '<div class="fbtns"><button class="btn full" type="submit" id="lbtn">로그인</button></div></form>' + NOTE + '</div>';
    $('#lf').addEventListener('submit', async function (e) {
      e.preventDefault();
      var em = $('#le').value.trim(), pw = $('#lp').value, er = $('#lerr');
      if (!em || !pw) { er.textContent = '이메일과 비밀번호를 모두 입력해 주세요.'; er.hidden = false; return; }
      $('#lbtn').disabled = true; $('#lbtn').textContent = '로그인 중…';
      try { await API.login(em, pw); await enter(); }
      catch (x) { er.textContent = /invalid/i.test(x && x.message) ? '이메일 또는 비밀번호가 맞지 않습니다.' : why(x); er.hidden = false; $('#lbtn').disabled = false; $('#lbtn').textContent = '로그인'; }
    });
  }

  async function enter() {
    $('#app').innerHTML = '<p class="sub" style="padding:40px 0">관리 정보를 불러오는 중입니다…</p>';
    try { await API.load(); view = 'admin'; render(); }
    catch (e) { console.error(e); view = 'login'; login('정보를 불러오지 못했습니다. supabase-setup.sql을 실행했는지 확인해 주세요.'); }
  }

  /* ---------- 공통 틀 ---------- */
  function shell(inner) {
    $('#logout').hidden = false;
    return '<h1>매물과 사이트 정보를 관리합니다</h1>' + NOTE +
      (S.aiToday != null ? '<p class="sub" style="margin:12px 0 0">오늘 AI 매물찾기 사용: <b style="color:var(--tx)">' + S.aiToday.toLocaleString() + '회</b> (예상 비용 약 ' + Math.ceil(S.aiToday * 0.5).toLocaleString() + '원)</p>' : '') +
      '<div class="tabs" role="tablist">' + [['list', '매물 관리'], ['cx', '단지 관리'], ['broker', '중개사 정보']].map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" class="tab' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' + inner;
  }

  /* ---------- 매물 관리 ---------- */
  function listingForm() {
    var first = S.complexes[0] || { id: '', ap: '' };
    var l = editing === 'new' ? { cid: first.id, price: '', area: '', supply: '', pyc: '', pyt: '', floor: '', total: '', moveIn: '', rooms: '', baths: '', approval: first.ap, parking: '', mgmt: '', dir: '남향', gap: '', tag: '', desc: '', school: '', bldg: '', rec: false }
      : S.listings.find(function (x) { return x.id === editing; });
    var f = function (id, lab, val, type, extra) { return '<div><label for="' + id + '">' + lab + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"' + (extra || '') + '></div>'; };
    return '<form class="form" id="lfm" novalidate><h2>' + (editing === 'new' ? '새 매물 등록' : '매물 수정') + '</h2>' +
      '<div class="grid">' +
      '<div class="span"><label for="f_cid">단지</label><select id="f_cid">' + opts(S.complexes.map(function (c) { return [c.id, c.n + ' (' + c.d + ')']; }), l.cid) + '</select></div>' +
      f('f_bldg', '동 (예: 101동)', l.bldg || '', 'text', ' maxlength="20" placeholder="101동"') +
      f('f_price', '매매 금액 (억, 예 25.5)', l.price, 'number', ' step="0.01" inputmode="decimal"') +
      f('f_area', '전용면적 (㎡)', l.area, 'number', ' step="0.01" inputmode="decimal"') +
      f('f_supply', '공급면적 (㎡)', l.supply, 'number', ' step="0.01" inputmode="decimal"') +
      '<div><label for="f_pyc">평형 범주 (검색용)</label><select id="f_pyc"><option value="">선택</option>' + opts(PY, l.pyc) + '</select></div>' +
      f('f_pyt', '평형 표기', l.pyt, 'text', ' placeholder="예: 34평형"') +
      '<div><label for="f_dir">방향</label><select id="f_dir">' + opts(DIRS, l.dir) + '</select></div>' +
      '<div><label for="f_fmode">해당 층 (숫자 또는 저·중·고)</label><div style="display:flex;gap:8px">' +
        '<select id="f_fmode" style="flex:0 0 46%">' + opts([['', '숫자로'], ['저층', '저층'], ['중층', '중층'], ['고층', '고층']], l.flv || '') + '</select>' +
        '<input id="f_floor" type="number" inputmode="numeric" aria-label="해당 층 숫자" placeholder="예: 12" value="' + esc(l.flv ? '' : l.floor) + '"' + (l.flv ? ' hidden' : '') + '></div></div>' +
      f('f_total', '총 층수', l.total, 'number', ' inputmode="numeric"') +
      f('f_moveIn', '입주가능일', l.moveIn, 'text', ' placeholder="즉시 / 2026-12-01 / 협의"') +
      f('f_rooms', '방 개수', l.rooms, 'number', ' inputmode="numeric"') +
      f('f_baths', '욕실 수', l.baths, 'number', ' inputmode="numeric"') +
      f('f_approval', '사용승인일(준공일)', l.approval, 'date') +
      f('f_parking', '주차대수', l.parking, 'text', ' placeholder="세대당 1.5대"') +
      f('f_mgmt', '관리비 (만원)', l.mgmt, 'number', ' inputmode="numeric"') +
      '<div><label for="f_gap">갭투 여부</label><select id="f_gap"><option value="">선택</option>' + opts(B.GAP.map(function (g) { return [g[0], g[1]]; }), l.gap) + '</select></div>' +
      '<div class="span"><label for="f_tag">한 줄 설명 (목록에 표시)</label><input id="f_tag" maxlength="40" value="' + esc(l.tag) + '" placeholder="예: 한강 조망 · 올수리 · 즉시 입주"></div>' +
      '<div class="span"><label for="f_school">학군 (선택 · 상세 화면과 AI 검색에 쓰여요)</label><input id="f_school" maxlength="200" value="' + esc(l.school || '') + '" placeholder="예: OO초 배정 · OO중·OO고 도보권 · 학원가 셔틀"></div>' +
      '<div class="span"><label for="f_desc">중개사 설명 (상세 화면)</label><textarea id="f_desc" rows="5">' + esc(l.desc) + '</textarea></div>' +
      '</div><label class="chk"><input type="checkbox" id="f_rec"' + (l.rec ? ' checked' : '') + '> 추천 매물로 첫 화면에 보이기</label>' +
      '<div id="ferr" class="err" hidden></div>' +
      '<div class="fbtns"><button class="btn" type="submit">' + (editing === 'new' ? '매물 등록하기' : '수정 내용 저장') + '</button><button class="btn g" type="button" id="fc">취소</button></div></form>';
  }
  function listView() {
    var rows = S.listings.slice().sort(function (a, b) { return (b.reg || '').localeCompare(a.reg || '') || b.id - a.id; });
    return (editing != null ? listingForm() : '') +
      '<div class="head"><h2>등록된 매물 ' + rows.length + '건</h2>' + (editing == null ? '<button class="btn ban" type="button" id="new">새 매물 등록</button>' : '') + '</div>' +
      (rows.length ? '<div class="rows">' + rows.map(function (l) {
        var c = cx(l.cid);
        return '<div class="row' + (flash === l.id ? ' hl' : '') + '"><div><div class="nm">' + esc(c.n) + (l.bldg ? ' ' + esc(B.dong(l.bldg)) : ' <span style="color:var(--r-fg);font-size:14px">동 미입력</span>') + ' ' + esc(l.pyt) + '</div>' +
          '<div class="sub">전용 ' + l.area + '㎡ · ' + esc(B.floorTxt(l)) + ' · ' + esc(l.dir) + (l.tag ? ' · ' + esc(l.tag) : '') + '</div>' +
          '<div style="margin-top:6px"><span class="tag t-m">매매</span>' + (l.gap ? '<span class="tag t-g">' + esc(l.gap) + '</span>' : '') + (l.rec ? '<span class="tag t-r">추천</span>' : '') + (l.reg ? '<span class="tag t-c">확인 ' + md(l.reg) + '</span>' : '') + '</div></div>' +
          '<div class="pr">' + won(l.price) + '</div>' +
          '<div class="acts"><button class="lnk" data-touch="' + l.id + '"' + (l.reg === today() ? ' title="오늘 이미 확인했어요"' : '') + '>확인일 갱신</button><button class="lnk" data-edit="' + l.id + '">수정</button><button class="lnk" data-rec="' + l.id + '">' + (l.rec ? '추천 해제' : '추천') + '</button><button class="lnk danger" data-del="' + l.id + '">삭제</button></div>' +
          (delAsk === l.id ? '<div class="confirm" role="alert">이 매물을 삭제하면 손님 화면에서도 사라집니다.<button class="btn del" data-delok="' + l.id + '">삭제하기</button><button class="btn g" data-delno="1">취소</button></div>' : '') +
          '</div>';
      }).join('') + '</div>' : '<div class="form sub">아직 등록된 매물이 없습니다. 새 매물 등록을 눌러 첫 매물을 올려 보세요.</div>');
  }
  function bindList() {
    var nb = $('#new'); if (nb) nb.onclick = function () { if (!S.complexes.length) { toast('먼저 단지 관리에서 단지를 추가해 주세요'); return; } editing = 'new'; delAsk = null; render(); window.scrollTo(0, 0); };
    document.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editing = +b.dataset.edit; delAsk = null; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-rec]').forEach(function (b) {
      b.onclick = async function () {
        var l = S.listings.find(function (x) { return x.id === +b.dataset.rec; }), v = !l.rec;
        if (await run(function () { return API.recL(l.id, v); }, v ? '추천 매물로 지정했습니다' : '추천을 해제했습니다')) { l.rec = v; render(); }
      };
    });
    document.querySelectorAll('[data-touch]').forEach(function (b) {
      b.onclick = async function () {
        var l = S.listings.find(function (x) { return x.id === +b.dataset.touch; }), d = null;
        if (await run(async function () { d = await API.touchL(l.id); }, '확인일을 오늘(' + md(today()) + ')로 바꿨습니다')) { l.reg = d || today(); flash = l.id; render(); }
      };
    });
    document.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { delAsk = +b.dataset.del; render(); }; });
    document.querySelectorAll('[data-delok]').forEach(function (b) {
      b.onclick = async function () {
        var id = +b.dataset.delok;
        if (await run(function () { return API.delL(id); }, '매물을 삭제했습니다')) { S.listings = S.listings.filter(function (x) { return x.id !== id; }); delAsk = null; if (editing === id) editing = null; render(); }
      };
    });
    document.querySelectorAll('[data-delno]').forEach(function (b) { b.onclick = function () { delAsk = null; render(); }; });
    var fm = $('#lfm'); if (!fm) return;
    $('#fc').onclick = function () { editing = null; render(); };
    $('#f_fmode').onchange = function () { var fl = $('#f_floor'); fl.hidden = !!this.value; if (this.value) fl.value = ''; };
    $('#f_cid').onchange = function () { var c = cx(+this.value); if (c.ap) $('#f_approval').value = c.ap; };
    fm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var g = function (k) { return $('#f_' + k).value.trim(); }, n = function (k) { return +g(k); };
      var need = [['bldg', '동'], ['price', '매매 금액'], ['area', '전용면적'], ['supply', '공급면적'], ['pyc', '평형 범주'], ['pyt', '평형 표기'], ['total', '총 층수'], ['moveIn', '입주가능일'], ['rooms', '방 개수'], ['baths', '욕실 수'], ['approval', '사용승인일'], ['parking', '주차대수'], ['mgmt', '관리비'], ['gap', '갭투 여부']];
      var miss = need.filter(function (k) { return !g(k[0]); }).map(function (k) { return k[1]; });
      var er = $('#ferr');
      var fmode = $('#f_fmode').value;
      if (!fmode && !g('floor')) miss.unshift('해당 층');
      if (miss.length) { er.textContent = '다음 항목을 입력해 주세요: ' + miss.join(', '); er.hidden = false; return; }
      if (!fmode && n('floor') > n('total')) { er.textContent = '해당 층이 총 층수보다 클 수 없습니다. 층수를 확인해 주세요.'; er.hidden = false; return; }
      var data = { cid: n('cid'), price: n('price'), area: n('area'), supply: n('supply'), pyc: g('pyc'), pyt: g('pyt'), floor: fmode ? '' : n('floor'), flv: fmode, total: n('total'), moveIn: g('moveIn'), rooms: n('rooms'), baths: n('baths'), approval: g('approval'), parking: g('parking'), mgmt: n('mgmt'), dir: g('dir'), gap: g('gap'), tag: g('tag'), desc: g('desc'), school: g('school'), bldg: B.dong(g('bldg')), rec: $('#f_rec').checked,
        wasFlv: editing !== 'new' && !!(S.listings.find(function (x) { return x.id === editing; }) || {}).flv };
      var saved = null, isNew = editing === 'new', id = editing;
      var ok = await run(async function () { saved = isNew ? await API.addL(data) : await API.saveL(id, data); }, isNew ? '매물을 등록했습니다' : '수정 내용을 저장했습니다');
      if (!ok) return;
      if (isNew) S.listings.push(saved); else S.listings = S.listings.map(function (x) { return x.id === id ? saved : x; });
      flash = saved.id; editing = null; render();
    });
  }

  /* ---------- 단지 관리 ---------- */
  function cxView() {
    var c = editingC === 'new' ? { n: '', d: '반포동', h: '', ap: '', a: '' } : editingC != null ? S.complexes.find(function (x) { return x.id === editingC; }) : null;
    return (c ? '<form class="form" id="cfm" novalidate><h2>' + (editingC === 'new' ? '새 단지 추가' : '단지 정보 수정') + '</h2><div class="grid two">' +
      '<div><label for="c_n">단지명</label><input id="c_n" maxlength="30" value="' + esc(c.n) + '"></div>' +
      '<div><label for="c_d">동</label><select id="c_d">' + opts(['반포동', '잠원동'], c.d) + '</select></div>' +
      '<div><label for="c_h">총 세대수</label><input id="c_h" type="number" inputmode="numeric" value="' + esc(c.h) + '"></div>' +
      '<div><label for="c_ap">사용승인일(준공일)</label><input id="c_ap" type="date" value="' + esc(c.ap) + '"></div>' +
      '<div class="span"><label for="c_a">주소 (지번 권장 · 매물 소재지에 표시돼요)</label><input id="c_a" value="' + esc(c.a) + '" placeholder="예: 서울 서초구 반포동 OO-O"></div></div>' +
      '<div id="cerr" class="err" hidden></div><div class="fbtns"><button class="btn" type="submit">저장</button><button class="btn g" type="button" id="cc">취소</button></div></form>' : '') +
      '<div class="head"><h2>단지 ' + S.complexes.length + '곳</h2>' + (c ? '' : '<button class="btn ban" type="button" id="cnew">새 단지 추가</button>') + '</div>' +
      '<p class="sub" style="margin:-4px 0 14px">세대수와 사용승인일은 손님 화면의 "조건으로 찾기"에 쓰입니다. 비어 있는 단지는 채워 주세요.</p>' +
      '<div class="rows">' + S.complexes.map(function (x) {
        var cnt = S.listings.filter(function (l) { return l.cid === x.id; }).length;
        return '<div class="row"><div><div class="nm">' + esc(x.n) + '</div><div class="sub">' + esc(x.d) + ' · ' + (x.h ? x.h.toLocaleString() + '세대' : '세대수 미입력') + ' · ' + (x.ap ? '사용승인 ' + esc(x.ap) : '<b style="color:var(--r-fg)">사용승인일 미입력</b>') + '</div></div>' +
          '<div class="sub">매물 ' + cnt + '건</div><div class="acts"><button class="lnk" data-cedit="' + x.id + '">수정</button></div></div>';
      }).join('') + '</div>';
  }
  function bindCx() {
    var nb = $('#cnew'); if (nb) nb.onclick = function () { editingC = 'new'; render(); window.scrollTo(0, 0); };
    document.querySelectorAll('[data-cedit]').forEach(function (b) { b.onclick = function () { editingC = +b.dataset.cedit; render(); window.scrollTo(0, 0); }; });
    var fm = $('#cfm'); if (!fm) return;
    $('#cc').onclick = function () { editingC = null; render(); };
    fm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var g = function (k) { return $('#c_' + k).value.trim(); }, er = $('#cerr');
      if (!g('n') || !g('h')) { er.textContent = '단지명과 총 세대수를 입력해 주세요.'; er.hidden = false; return; }
      if (S.complexes.some(function (x) { return x.n === g('n') && x.id !== editingC; })) { er.textContent = '같은 이름의 단지가 이미 있습니다.'; er.hidden = false; return; }
      var d = { n: g('n'), d: g('d'), h: +g('h'), ap: g('ap'), a: g('a') }, isNew = editingC === 'new', id = editingC, saved = null;
      var ok = await run(async function () { saved = isNew ? await API.addC(d) : await API.saveC(id, d); }, isNew ? '단지를 추가했습니다' : '단지 정보를 저장했습니다');
      if (!ok) return;
      if (isNew) S.complexes.push(saved); else S.complexes = S.complexes.map(function (x) { return x.id === id ? saved : x; });
      S.complexes.sort(function (a, b) { return a.n.localeCompare(b.n, 'ko'); });
      editingC = null; render();
    });
  }

  /* ---------- 중개사 정보 ---------- */
  function brokerView() {
    var b = S.broker, f = function (id, lab, v) { return '<div><label for="' + id + '">' + lab + '</label><input id="' + id + '" value="' + esc(v) + '"></div>'; };
    return '<form class="form" id="bfm" novalidate><h2>중개사 정보</h2><p class="sub" style="margin:6px 0 0">손님 화면 맨 아래에 표시됩니다. 공인중개사법상 표시 의무 항목이니 정확하게 입력해 주세요.</p>' +
      '<div class="grid two">' + f('b_name', '사무소명', b.name) + f('b_rep', '대표 공인중개사', b.rep) + f('b_reg', '등록번호', b.reg) + f('b_tel', '전화번호', b.tel) +
      '<div class="span"><label for="b_addr">사무소 소재지</label><input id="b_addr" value="' + esc(b.addr) + '"></div></div>' +
      '<div class="fbtns"><button class="btn" type="submit">중개사 정보 저장</button></div></form>';
  }
  function bindBroker() {
    $('#bfm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var g = function (k) { return $('#b_' + k).value.trim(); };
      var b = { name: g('name'), rep: g('rep'), reg: g('reg'), tel: g('tel'), addr: g('addr') };
      if (await run(function () { return API.saveB(b); }, '중개사 정보를 저장했습니다')) S.broker = b;
    });
  }

  /* ---------- 화면 전환 ---------- */
  function render() {
    if (view === 'login') { login(); return; }
    var inner = tab === 'list' ? listView() : tab === 'cx' ? cxView() : brokerView();
    $('#app').innerHTML = shell(inner);
    document.querySelectorAll('[data-tab]').forEach(function (t) { t.onclick = function () { tab = t.dataset.tab; editing = null; editingC = null; delAsk = null; render(); }; });
    if (tab === 'list') bindList(); else if (tab === 'cx') bindCx(); else bindBroker();
    flash = null;
  }
  $('#logout').onclick = async function () { await API.logout(); view = 'login'; tab = 'list'; editing = null; editingC = null; render(); };

  (async function boot() {
    if (!LIVE) { await enter(); return; }          /* 미리보기 모드는 바로 관리 화면 */
    try { if (await API.session()) { await enter(); return; } } catch (e) { console.error(e); }
    view = 'login'; login();
  })();
})();
