/* 答题核心逻辑：自适应抽题、计分、评价。无 DOM 依赖，可在 node 中测试。 */
(function (g) {
  'use strict';

  // 难度分布矩阵：MATRIX[状态 S1..S5][难度 T1..T5]（见 出题准则.md）
  const MATRIX = [
    [1.0, 0.0, 0.0, 0.0, 0.0],
    [0.2, 0.8, 0.0, 0.0, 0.0],
    [0.0, 0.1, 0.8, 0.1, 0.0],
    [0.0, 0.1, 0.2, 0.6, 0.1],
    [0.0, 0.0, 0.3, 0.3, 0.4],
  ];

  const MODES = {
    quick: { name: '浅度测试', count: 15 },
    deep: { name: '深度测试', count: 60 },
  };

  // 七种评价（文字见 出题准则.md）
  const RANKS = [
    { title: '云完了', stamp: '建议补票', note: '这家伙是怎么溜上列车的帕！', text: '您云完了！您对星铁剧情与世界观的了解程度与完全的圈外人无异，甚至可能更加糟糕。您是这个世界上最不了解星铁剧情的人之一！' },
    { title: '云玩家', stamp: '云', note: '貌似是搭车客在闲逛帕。', text: '您是云玩家！您对星铁剧情与世界观的了解程度略优于多数圈外人，但也只是知道个大概。' },
    { title: '有点儿云', stamp: '跳过党', note: '乘客怎么心不在焉的帕？', text: '您有点儿云！您对星铁剧情与世界观没有特别的兴趣，也许是位光荣的「跳过党」。' },
    { title: '普通剧情玩家', stamp: '已阅', note: '这次的开拓日志也马马虎虎的帕。', text: '您是普通剧情玩家！您对星铁剧情与世界观的了解程度中规中矩，虽然会看剧情，但看进去的不算太多。' },
    { title: '资深剧情玩家', stamp: '合格', note: '是个合格的无名客了帕！', text: '您是资深剧情玩家！您对星铁剧情与世界观的了解程度比较深入，不仅会看剧情，还看得相当仔细。' },
    { title: '硬核剧情玩家', stamp: '优等', note: '乘客好厉害，可以管理智库了帕！', text: '您是硬核剧情玩家！您对星铁剧情与世界观的了解程度已经超越了绝大多数玩家，是行走的「星铁智库」。' },
    { title: '超硬核剧情玩家', stamp: '智识星神', note: '难……难道是博识尊上车了帕？！', text: '您是超硬核剧情玩家！您对星铁剧情与世界观的了解程度已能媲美星铁文案组本身，甚至可能更强。您是这个世界上最了解星铁剧情的人之一！' },
  ];

  function rankOf(correct, total) {
    if (correct <= 0) return 0;
    if (correct >= total) return 6;
    for (let k = 1; k <= 4; k++) if (correct * 5 <= total * k) return k;
    return 5;
  }

  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickTier(state, rnd) {
    const row = MATRIX[state - 1];
    let x = rnd(), acc = 0;
    for (let t = 0; t < 5; t++) {
      acc += row[t];
      if (x < acc) return t + 1;
    }
    // 行和可能因四舍五入略小于 1：落到概率最大的一档
    return row.indexOf(Math.max(...row)) + 1;
  }

  class Session {
    constructor(bank, mode, rnd) {
      this.rnd = rnd || Math.random;
      this.mode = mode;
      this.total = MODES[mode].count;
      this.state = 1;
      this.maxState = 1;
      this.history = []; // {q, choice, correct, tier, state}
      this.pools = [[], [], [], [], []];
      for (const q of bank.questions) this.pools[q.t - 1].push(q);
      this.pools.forEach(p => shuffle(p, this.rnd));
      this.current = null;
    }

    get index() { return this.history.length; }
    get done() { return this.history.length >= this.total; }
    get correctCount() { return this.history.filter(h => h.correct).length; }

    next() {
      if (this.done) return null;
      let tier = pickTier(this.state, this.rnd);
      // 该档题目用完时，就近取相邻难度
      if (!this.pools[tier - 1].length) {
        const order = [1, -1, 2, -2, 3, -3, 4, -4].map(d => tier + d).filter(t => t >= 1 && t <= 5);
        tier = order.find(t => this.pools[t - 1].length);
        if (!tier) return null;
      }
      const q = this.pools[tier - 1].pop();
      // 打乱选项；记录正确项的新位置
      const idx = shuffle([0, 1, 2, 3], this.rnd);
      this.current = { q, tier, state: this.state, options: idx.map(i => q.o[i]), answer: idx.indexOf(0) };
      return this.current;
    }

    answer(choice) {
      const c = this.current;
      if (!c) throw new Error('no current question');
      const correct = choice === c.answer;
      this.history.push({ q: c.q, tier: c.tier, state: c.state, options: c.options, answer: c.answer, choice, correct });
      this.state = correct ? Math.min(5, this.state + 1) : Math.max(1, this.state - 2);
      this.maxState = Math.max(this.maxState, this.state);
      this.current = null;
      return correct;
    }

    result() {
      const correct = this.correctCount;
      const rank = rankOf(correct, this.total);
      const byTier = [1, 2, 3, 4, 5].map(t => {
        const hs = this.history.filter(h => h.tier === t);
        return { tier: t, total: hs.length, correct: hs.filter(h => h.correct).length };
      });
      return { correct, total: this.total, rank, ...RANKS[rank], byTier, maxState: this.maxState, mode: MODES[this.mode].name };
    }
  }

  g.Quiz = { MATRIX, MODES, RANKS, rankOf, pickTier, Session };
})(typeof window !== 'undefined' ? window : globalThis);
