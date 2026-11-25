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
  async function getBytes(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return unscramble(await res.arrayBuffer());
  }
  async function fetchBank() {
    let text;
    if (typeof DecompressionStream === 'function') {
      try {
        const packed = await getBytes('data/bank.bin');
        const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        text = await new Response(stream).text();
      } catch (e) { text = null; }
    }
    if (!text) text = new TextDecoder().decode(await getBytes('data/bank.raw')); // 旧浏览器：未压缩版
    return JSON.parse(text);
  }
  async function load() {
    const status = $('load-status');
    status.classList.remove('error');
    status.textContent = '正在加载题库…';
    try {
      bank = await fetchBank();
      status.textContent = `题库共 ${bank.count} 题`;
      $('bank-ver').textContent = ` 题库版本 ${bank.version}`;
      document.querySelectorAll('.mode').forEach(b => (b.disabled = false));
    } catch (e) {
      status.classList.add('error');
      status.innerHTML = '';
      status.append('题库加载失败，请检查网络后重试。 ');
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
    const c = session.next();
    if (!c) return finish();
    const i = session.index;
    $('q-count').textContent = `第 ${i + 1} / ${session.total} 题`;
    $('progress-bar').style.width = `${i / session.total * 100}%`;
    $('q-meta').textContent = bank.regions[c.q.r] || '';
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
    $('cert').hidden = true;
    if (certUrl) { URL.revokeObjectURL(certUrl); certUrl = null; }
    show('result');
  }

  async function makeCert() {
    const btn = $('make-cert');
    const name = $('name').value.trim().slice(0, 12);
    store.set('cert-name', name);
    btn.disabled = true; btn.textContent = '正在生成…';
    try {
      const url = location.host ? location.host + location.pathname.replace(/index\.html$/, '') : '';
      const blob = await Cert.render(session.result(), session.history, name, url.replace(/\/$/, ''));
      if (certUrl) URL.revokeObjectURL(certUrl);
      certUrl = URL.createObjectURL(blob);
      $('cert-img').src = certUrl;
      $('cert-save').href = certUrl;
      $('cert').hidden = false;
      $('cert').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      btn.disabled = false; btn.textContent = '重新生成';
    }
  }

  // ---------- 事件 ----------
  document.querySelectorAll('.mode').forEach(b => (b.onclick = () => start(b.dataset.mode)));
  $('next').onclick = ask;
  $('make-cert').onclick = makeCert;
  $('name').addEventListener('keydown', e => { if (e.key === 'Enter') makeCert(); });
  $('again').onclick = () => show('home');
  document.addEventListener('keydown', e => {
    if ($('quiz').hidden || e.target.tagName === 'INPUT') return;
    const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && session.current) { choose(k); e.preventDefault(); }
  });

  load();
})();
