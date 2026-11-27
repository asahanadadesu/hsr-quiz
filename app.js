(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const screens = ['home', 'quiz', 'result'];
  const KEYS = ['A', 'B', 'C', 'D'];
  let bank = null, session = null, certUrl = null;

  function show(id) {
    for (const s of screens) $(s).hidden = s !== id;
    window.scrollTo(0, 0);
  }

  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式等 */ } },
  };

  // ---------- 加载题库 ----------
  // 题库以「压缩 + 伪随机异或」形式存放，防止随手查看（与 scripts/build_bank.py 对应）
  const SEED = 0x5EA7C0DE;
  function unscramble(buf) {
    const b = new Uint8Array(buf);
    let s = SEED;
    for (let i = 0; i < b.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      b[i] ^= s >>> 24;
    }
    return b;
  }
  // 题库地址带上与 css/js 相同的版本号（由构建脚本写入 index.html），换版后不会读到旧缓存
  const VER = (document.querySelector('script[src*="app.js?v="]') || {}).src?.split('?v=')[1] || '';
  async function getBytes(path, onProgress) {
    const res = await fetch(VER ? `${path}?v=${VER}` : path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = +res.headers.get('content-length') || 0;
    if (!res.body || !total || !onProgress) return unscramble(await res.arrayBuffer());
    const reader = res.body.getReader(), chunks = [];
    let got = 0;
    for (;;) { // 边下边报进度，网速慢时用户能看到在动
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      onProgress(Math.min(got / total, 1));
    }
    const buf = new Uint8Array(got);
    let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
    return unscramble(buf);
  }
  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  async function fetchBank(onProgress) {
    if (typeof DecompressionStream === 'function') {
      try { return JSON.parse(await inflate(await getBytes('data/bank.bin', onProgress))); }
      catch (e) { console.warn('bank.bin 读取失败，改用 bank.raw', e); }
    }
    return JSON.parse(new TextDecoder().decode(await getBytes('data/bank.raw', onProgress))); // 旧浏览器：未压缩版
  }
  async function load() {
    const status = $('load-status');
    status.classList.remove('error');
    status.textContent = '正在加载题库…';
    try {
      bank = await fetchBank(p => { status.textContent = `正在加载题库… ${Math.round(p * 100)}%`; });
      status.textContent = `题库共 ${bank.count} 题`;
      $('bank-ver').textContent = ` 题库版本 ${bank.version}`;
      document.querySelectorAll('.mode').forEach(b => (b.disabled = false));
    } catch (e) {
      console.error('题库加载失败', e);
      status.classList.add('error');
      status.innerHTML = '';
      status.append(`题库加载失败（${e && e.message ? e.message : e}），请检查网络后重试。 `);
      const retry = document.createElement('button');
      retry.className = 'btn'; retry.textContent = '重试'; retry.onclick = load;
      status.append(retry);
    }
  }

  // ---------- 答题 ----------
  function start(mode) {
    session = new Quiz.Session(bank, mode);
    show('quiz');
    ask();
  }

  function ask() {
    if (session.current) return; // 本题未作答时不能跳题
    const c = session.next();
    if (!c) return finish();
    const i = session.index;
    $('progress-bar').style.width = `${i / session.total * 100}%`;
    $('q-meta').textContent = `第 ${i + 1} / ${session.total} 题`;
    $('help-tip').hidden = session.maxState < 3; // 首次到达 S3 后一直显示
    $('q-text').textContent = c.q.q;
    const ul = $('options'); ul.innerHTML = '';
    c.options.forEach((text, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = `<span class="opt-key">${KEYS[k]}</span><span></span>`;
      b.lastChild.textContent = text;
      b.onclick = () => choose(k);
      li.append(b); ul.append(li);
    });
    $('feedback').hidden = true;
    $('next').hidden = true;
    ul.querySelector('button').focus({ preventScroll: true });
  }

  function choose(k) {
    if (!session.current) return;
    const answer = session.current.answer;
    const q = session.current.q;
    const ok = session.answer(k);
    const btns = $('options').querySelectorAll('button');
    btns.forEach((b, i) => {
      b.disabled = true;
      if (i === answer) b.classList.add('right');
      else if (i === k) b.classList.add('wrong');
    });
    const v = $('verdict');
    v.textContent = ok ? '回答正确' : `回答错误，正确答案是 ${KEYS[answer]}`;
    v.className = 'verdict ' + (ok ? 'right' : 'wrong');
    $('explain').textContent = q.e;
    $('feedback').hidden = false;
    $('progress-bar').style.width = `${session.index / session.total * 100}%`;
    const nx = $('next');
    nx.textContent = session.done ? '查看结果' : '下一题';
    nx.hidden = false;
    nx.focus({ preventScroll: true });
  }

  // ---------- 结果 ----------
  function finish() {
    const r = session.result();
    $('r-mode').textContent = r.mode;
    $('r-points').textContent = r.score;
    $('r-correct').textContent = r.correct;
    $('r-total').textContent = r.total;
    $('rank-title').textContent = r.title;
    $('r-text').textContent = r.text;

    const wrong = session.history.filter(h => !h.correct);
    $('review').hidden = !wrong.length;
    $('review').open = false;
    const ol = $('review-list'); ol.innerHTML = '';
    for (const h of wrong) {
      const li = document.createElement('li');
      li.innerHTML = '<p class="rq"></p><p class="ra">正确答案：<b></b>　你的选择：<s></s></p><p class="ra"></p>';
      li.querySelector('.rq').textContent = h.q.q;
      li.querySelector('b').textContent = h.options[h.answer];
      li.querySelector('s').textContent = h.options[h.choice];
      li.querySelectorAll('.ra')[1].textContent = h.q.e;
      ol.append(li);
    }

    $('name').value = store.get('cert-name');
    finishedAt = new Date();
    show('result');
    makeCert();
  }

  let finishedAt = null, certJob = 0, nameTimer = 0;
  async function makeCert() {
    const job = ++certJob;
    const name = $('name').value.trim().slice(0, 12);
    store.set('cert-name', name);
    const url = location.host ? (location.host + location.pathname.replace(/index\.html$/, '')).replace(/\/$/, '') : '';
    const blob = await Cert.render(session.result(), session.history, name, url, finishedAt);
    if (job !== certJob) return; // 用户还在输入，丢弃旧图
    if (certUrl) URL.revokeObjectURL(certUrl);
    certUrl = URL.createObjectURL(blob);
    $('cert-img').src = certUrl;
    $('cert-save').href = certUrl;
  }

  // ---------- 事件 ----------
  document.querySelectorAll('.mode').forEach(b => (b.onclick = () => start(b.dataset.mode)));
  $('next').onclick = ask;
  $('name').addEventListener('input', () => { clearTimeout(nameTimer); nameTimer = setTimeout(makeCert, 350); });
  $('again').onclick = () => show('home');
  document.addEventListener('keydown', e => {
    if ($('quiz').hidden || e.target.tagName === 'INPUT') return;
    const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && session.current) { choose(k); e.preventDefault(); }
  });

  load();
})();
