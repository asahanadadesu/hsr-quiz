/* 鉴定书：用原生 Canvas 绘制，无需外部库。 */
(function (g) {
  'use strict';
  const W = 900;
  const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const C = { night: '#1a1d3a', night2: '#252a52', paper: '#e9edf6', ink: '#232850', soft: '#5b6189', gold: '#b8902f', goldLight: '#d1aa52', line: 'rgba(35,40,80,.18)' };

  function seeded(seed) { // 让星空图案对同一结果稳定
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function wrap(ctx, text, maxW) { // 中文按字断行，避免标点落在行首
    const lines = []; let line = '';
    const noStart = '，。！？、；：」』）》…';
    for (const ch of text) {
      const t = line + ch;
      if (ctx.measureText(t).width > maxW && line) {
        if (noStart.includes(ch)) { line = t; continue; }
        lines.push(line); line = ch;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function draw(r, history, name, url) {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    // 先排版，按内容决定画布高度
    const x0 = 60, y0 = 70, pw = W - 120, notchY = y0 + 250;
    const L = x0 + 60, R = x0 + pw - 60, mid = W / 2;
    ctx.font = `26px ${SANS}`;
    const lines = wrap(ctx, r.text, R - L - 40);
    const n = history.length, perRow = n > 20 ? 20 : Math.max(n, 1);
    const cell = Math.min(34, (R - L) / perRow), gap = cell * .22, rows = Math.ceil(n / perRow);
    const textTop = notchY + 400, gy = textTop + lines.length * 42 + 50;
    const footY = gy + rows * cell + 80, ph = footY + 60 - y0, H = y0 + ph + 70;
    cv.width = W; cv.height = H;
    const rnd = seeded(r.correct * 131 + r.total * 7 + (name || '').length * 977);

    // 深空背景与星点
    const bg = ctx.createRadialGradient(W / 2, -100, 50, W / 2, 200, 1300);
    bg.addColorStop(0, C.night2); bg.addColorStop(1, C.night);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) {
      ctx.globalAlpha = .25 + rnd() * .6;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 + .3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 车票纸面（两侧打孔缺口）
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x0, y0, pw, ph, 10) : ctx.rect(x0, y0, pw, ph);
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.restore();
    ctx.fillStyle = bg; // 打孔缺口：用背景色“挖”出来，保存的 PNG 不会出现白洞
    for (const x of [x0, x0 + pw]) { ctx.beginPath(); ctx.arc(x, notchY, 18, 0, Math.PI * 2); ctx.fill(); }
    // 打孔线
    ctx.strokeStyle = C.line; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + 30, notchY); ctx.lineTo(x0 + pw - 30, notchY); ctx.stroke();
    ctx.setLineDash([]);
    // 烫金内框
    ctx.strokeStyle = C.goldLight; ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 18, y0 + 18, pw - 36, ph - 36);

    ctx.textBaseline = 'alphabetic';

    // 票头
    ctx.fillStyle = C.soft; ctx.font = `24px ${SANS}`; ctx.textAlign = 'left';
    ctx.fillText('你是星铁云玩家吗？', L, y0 + 90);
    ctx.textAlign = 'right';
    ctx.fillText(r.mode, R, y0 + 90);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
    ctx.font = `700 76px ${SERIF}`;
    ctx.fillText('剧情鉴定书', mid, y0 + 190);

    // 持有人
    let y = notchY + 90;
    ctx.font = `26px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.fillText('兹鉴定', mid, y);
    y += 70;
    ctx.font = `700 52px ${SERIF}`; ctx.fillStyle = C.ink;
    ctx.fillText(name || '无名客', mid, y, R - L);
    y += 60;
    ctx.font = `26px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.fillText(`在${r.mode}中答对 ${r.correct} / ${r.total} 题，评定为`, mid, y);

    // 评定
    y += 110;
    ctx.font = `700 84px ${SERIF}`; ctx.fillStyle = C.gold;
    ctx.fillText(r.title, mid, y, R - L);

    // 评语
    y = textTop;
    ctx.font = `26px ${SANS}`; ctx.fillStyle = C.ink;
    for (const ln of lines) { ctx.fillText(ln, mid, y); y += 42; }

    // 答题记录：每题一格，按作答顺序排成一行（深度测试排成三行）
    const gx = mid - perRow * cell / 2;
    history.forEach((h, i) => {
      const cx = gx + (i % perRow) * cell, cy = gy + Math.floor(i / perRow) * cell;
      ctx.fillStyle = h.correct ? '#3f9a8f' : 'rgba(194,85,105,.35)';
      ctx.fillRect(cx + gap / 2, cy + gap / 2, cell - gap, cell - gap);
    });

    // 票尾
    const d = new Date();
    const date = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    ctx.font = `22px ${SANS}`; ctx.fillStyle = C.soft;
    ctx.textAlign = 'left'; ctx.fillText(date, L, footY);
    ctx.textAlign = 'right'; ctx.fillText(url, R, footY);

    return cv;
  }

  function render(r, history, name, url) {
    const cv = draw(r, history, name, url);
    return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
  }

  g.Cert = { render };
})(window);
