/* 鉴定书：原生 Canvas 绘制，无外部依赖。
   风格：一本正经的官方文书（编号、防伪底纹、公章）+ 一枚很不正经的评级戳。 */
(function (g) {
  'use strict';
  const W = 1080, H = 1480;
  const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  // 两套样式：浅度测试是银蓝车票；深度测试是「典藏版」——深蓝夜色纸面、烫金字与金框
  const THEMES = {
    quick: {
      night: '#1a1d3a', night2: '#262b55', paper: ['#eef1f7', '#eef1f7'], ink: '#232850', soft: '#5b6189',
      gold: '#b48a2c', goldLine: '#cfa84f', red: '#c62f3b', line: 'rgba(35,40,80,.2)',
      guil: 'rgba(70,90,170,.07)', right: '#3f9a8f', wrong: 'rgba(198,47,59,.22)', paw: 'rgba(35,40,80,.75)',
      head: '星 穹 列 车 剧 情 鉴 定 处', no: '鉴字第', foil: false,
    },
    deep: {
      night: '#0c0e22', night2: '#1f1a45', paper: ['#232a5c', '#141838'], ink: '#f1e8cf', soft: '#aeb0d2',
      gold: '#e6c36a', goldLine: '#d9b45a', red: '#e0505c', line: 'rgba(230,195,106,.35)',
      guil: 'rgba(230,195,106,.09)', right: '#e2bd62', wrong: 'rgba(224,80,92,.45)', paw: 'rgba(241,232,207,.85)',
      head: '星 穹 列 车 剧 情 鉴 定 处 · 深 度 鉴 定', no: '深鉴字第', foil: true,
    },
  };
  let C = THEMES.quick;

  function hash(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; }
  function seeded(seed) { let s = seed || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

  function wrap(ctx, text, maxW) { // 按字断行，避免标点落在行首
    const lines = []; let line = '';
    const noStart = '，。！？、；：」』）》…';
    for (const ch of text) {
      const t = line + ch;
      if (ctx.measureText(t).width > maxW && line && !noStart.includes(ch)) { lines.push(line); line = ch; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // 防伪底纹：多组正弦花环叠成的玫瑰线
  function guilloche(ctx, cx, cy, R, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (let k = 0; k < 18; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 720; i++) {
        const a = i / 720 * Math.PI * 2;
        const r = R * (0.72 + 0.16 * Math.sin(9 * a + k * 0.35) + 0.06 * Math.sin(23 * a - k * 0.2));
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 在离屏画布上画印，再加「缺墨」斑点，最后旋转贴到纸上
  function inked(size, paint, rnd, rot, alpha) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = x.strokeStyle = C.red;
    paint(x, size);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < size * 1.4; i++) {
      x.globalAlpha = rnd() * .7;
      x.beginPath(); x.arc(rnd() * size, rnd() * size, rnd() * 2.6 + .4, 0, Math.PI * 2); x.fill();
    }
    return (ctx, cx, cy) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.drawImage(c, -size / 2, -size / 2); ctx.restore();
    };
  }

  function star(x, cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r;
      x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    x.closePath(); x.fill();
  }

  // 圆形公章：环形文字 + 五角星 + 下方横排
  function seal(rnd) {
    return inked(260, (x, s) => {
      const c = s / 2, r = s / 2 - 10;
      x.lineWidth = 7; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.arc(c, c, r - 10, 0, Math.PI * 2); x.stroke();
      star(x, c, c, 34);
      const text = '星穹列车剧情鉴定处', span = Math.PI * 1.25;
      x.font = `700 28px ${SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      [...text].forEach((ch, i) => {
        const a = -Math.PI / 2 - span / 2 + span * i / (text.length - 1);
        x.save(); x.translate(c + (r - 34) * Math.cos(a), c + (r - 34) * Math.sin(a));
        x.rotate(a + Math.PI / 2); x.fillText(ch, 0, 0); x.restore();
      });
      x.font = `700 22px ${SERIF}`; x.fillText('鉴定专用章', c, c + 62);
    }, rnd, -0.21, .82);
  }

  // 评级戳：长方形双框大字
  function rankStamp(word, rnd) {
    const fs = word.length <= 2 ? 92 : word.length === 3 ? 76 : 64;
    return inked(420, (x, s) => {
      x.font = `900 ${fs}px ${SERIF}`;
      const tw = x.measureText(word).width, bw = tw + 70, bh = fs + 56;
      const x0 = (s - bw) / 2, y0 = (s - bh) / 2;
      x.lineWidth = 8; x.strokeRect(x0, y0, bw, bh);
      x.lineWidth = 3; x.strokeRect(x0 + 12, y0 + 12, bw - 24, bh - 24);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(word, s / 2, s / 2 + fs * .04);
    }, rnd, -0.16, .88);
  }

  function paw(ctx, cx, cy, s, color) { // 帕姆的爪印签名
    ctx.save(); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * .35, s * .55, s * .45, 0, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy] of [[-.62, -.25], [-.22, -.62], [.22, -.62], [.62, -.25]]) {
      ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, s * .2, s * .26, dx * .5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 烫金：竖向渐变 + 细高光
  function foil(ctx, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#fff1c2'); g.addColorStop(.45, '#e6c36a'); g.addColorStop(.55, '#b8862e'); g.addColorStop(1, '#f2d58a');
    return g;
  }
  function sparkle(ctx, x, y, s, color) { // 四芒星角饰
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? s * .22 : s;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function draw(r, history, name, url, when) {
    C = THEMES[r.key] || THEMES.quick;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const d = when || new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    // 编号与印章斑驳只取决于本次答题，改称呼时不会变
    const sig = hash(history.map(h => h.q.id + (h.correct ? 1 : 0)).join('|') + d.getTime());
    const rnd = seeded(sig);
    const no = `${ymd}-${String(sig % 100000).padStart(5, '0')}`;

    // 深空底与星点
    const bg = ctx.createRadialGradient(W / 2, -120, 60, W / 2, 300, 1500);
    bg.addColorStop(0, C.night2); bg.addColorStop(1, C.night);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = .2 + rnd() * .6; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.7 + .3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 纸面
    const px = 48, py = 48, pw = W - 96, ph = H - 148, notchY = 372, mid = W / 2;
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, C.paper[0]); pg.addColorStop(1, C.paper[1]);
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 12) : ctx.rect(px, py, pw, ph); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    guilloche(ctx, mid, 850, 430, C.guil);
    if (C.foil) guilloche(ctx, mid, 210, 260, 'rgba(230,195,106,.06)');
    ctx.restore();
    ctx.fillStyle = bg;
    for (const x of [px, px + pw]) { ctx.beginPath(); ctx.arc(x, notchY, 22, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = C.line; ctx.setLineDash([10, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 40, notchY); ctx.lineTo(px + pw - 40, notchY); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.goldLine; ctx.lineWidth = 3; ctx.strokeRect(px + 22, py + 22, pw - 44, ph - 44);
    ctx.lineWidth = 1; ctx.strokeRect(px + 32, py + 32, pw - 64, ph - 64);
    if (C.foil) { // 金框四角的星饰与角花
      for (const [x, y] of [[px + 27, py + 27], [px + pw - 27, py + 27], [px + 27, py + ph - 27], [px + pw - 27, py + ph - 27]]) {
        ctx.fillStyle = pg; ctx.fillRect(x - 16, y - 16, 32, 32);
        sparkle(ctx, x, y, 18, C.gold);
      }
    }

    const L = px + 90, R = px + pw - 90;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';

    // 票头
    ctx.fillStyle = C.soft; ctx.font = `28px ${SANS}`;
    ctx.fillText(C.head, mid, 158);
    ctx.fillStyle = C.foil ? foil(ctx, 180, 272) : C.ink; ctx.font = `900 104px ${SERIF}`;
    ctx.fillText('剧情鉴定书', mid, 268);
    if (C.foil) { ctx.font = `700 22px ${SERIF}`; ctx.fillStyle = C.gold; ctx.fillText('— 典 藏 版 —', mid, 214 - 112); }
    ctx.fillStyle = C.soft; ctx.font = `24px ${SANS}`;
    ctx.fillText(`${C.no} ${no} 号`, mid, 318);

    // 正文
    ctx.font = `30px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.fillText('兹有乘客', mid, 436);
    const who = name || '无名客';
    ctx.font = `700 68px ${SERIF}`; ctx.fillStyle = C.ink;
    ctx.fillText(who, mid, 522, R - L);
    const nw = Math.min(ctx.measureText(who).width, R - L) + 60;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mid - nw / 2, 544); ctx.lineTo(mid + nw / 2, 544); ctx.stroke();
    ctx.font = `30px ${SANS}`; ctx.fillStyle = C.ink;
    { // 「参加「X」，鉴定得分 NN 分。」——分数放大描金
      const a = `参加「${r.mode}」，鉴定得分 `, num = String(r.score), z = ' 分。';
      const f1 = `30px ${SANS}`, f2 = `900 52px ${SERIF}`;
      ctx.font = f1; const wa = ctx.measureText(a).width, wz = ctx.measureText(z).width;
      ctx.font = f2; const wn = ctx.measureText(num).width;
      let x = mid - (wa + wn + wz) / 2;
      ctx.textAlign = 'left';
      ctx.font = f1; ctx.fillStyle = C.ink; ctx.fillText(a, x, 602); x += wa;
      ctx.font = f2; ctx.fillStyle = C.gold; ctx.fillText(num, x, 604); x += wn;
      ctx.font = f1; ctx.fillStyle = C.ink; ctx.fillText(z, x, 602);
      ctx.textAlign = 'center';
    }
    ctx.fillStyle = C.soft;
    ctx.fillText('经本处审核，评定为', mid, 654);

    // 评定
    ctx.fillStyle = C.foil ? foil(ctx, 690, 810) : C.gold; ctx.font = `900 128px ${SERIF}`;
    ctx.fillText(r.title, mid, 800, R - L);

    // 评语与批注靠左，右侧留给评级戳
    const colW = R - L - 300;
    ctx.textAlign = 'left'; ctx.font = `28px ${SANS}`; ctx.fillStyle = C.ink;
    let y = 872;
    for (const ln of wrap(ctx, r.text, colW)) { ctx.fillText(ln, L, y); y += 44; }
    y += 24;
    ctx.font = `26px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.fillText('鉴定员批注', L, y);
    ctx.font = `italic 700 34px ${SERIF}`; ctx.fillStyle = C.ink;
    ctx.fillText(`「${r.note}」`, L, y + 50, colW + 60);
    const stampY = Math.max(960, (872 + y + 50) / 2);

    // 答题记录：每题一格（右下角留给公章）
    const n = history.length, perRow = n > 20 ? 20 : Math.max(n, 1);
    const gridW = R - L - 250;
    const gx = L, gy = y + 50 + 58, rows = Math.ceil(n / perRow);
    // 评语较长时缩小格子，保证签发日期不压到金框
    const cell = Math.min(40, gridW / perRow, (1290 - 42 - gy) / rows), gap = cell * .24;
    ctx.font = `22px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.fillText('答题记录', gx, gy - 14);
    history.forEach((h, i) => {
      const cx = gx + (i % perRow) * cell, cy = gy + Math.floor(i / perRow) * cell;
      ctx.fillStyle = h.correct ? C.right : C.wrong;
      ctx.fillRect(cx + gap / 2, cy + gap / 2, cell - gap, cell - gap);
    });

    // 票尾：签发与日期
    const rowsH = Math.ceil(n / perRow) * cell;
    const fy = Math.min(1290, Math.max(1290, gy + rowsH + 42));
    ctx.font = `26px ${SANS}`; ctx.fillStyle = C.ink;
    ctx.fillText('鉴定员　列车长 帕姆', L, fy);
    paw(ctx, L + 300, fy - 12, 22, C.paw);
    ctx.fillStyle = C.soft;
    ctx.fillText(`签发日期　${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`, L, fy + 44);

    // 纸外：邀请
    ctx.textAlign = 'center'; ctx.font = `26px ${SANS}`; ctx.fillStyle = C.goldLine;
    ctx.fillText(url ? `你也来测一测：${url}` : '你也来测一测吧', mid, H - 38);

    // 盖章：公章盖在右下，评级戳斜盖在评定上
    seal(rnd)(ctx, R - 96, fy - 40);
    rankStamp(r.stamp || r.title, rnd)(ctx, R - 130, stampY);

    return cv;
  }

  function render(r, history, name, url, when) {
    const cv = draw(r, history, name, url, when);
    return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
  }

  g.Cert = { render };
})(window);
