// QA das seções novas do Farol (pedido do Luis 24/08): "Retenção por jogador", "Retenção de valores (R$)"
// e "Mediana de depósito por safra".
// O que precisa estar certo, em ordem de gravidade:
//   1) DEGRADAÇÃO — backend < v86 (sem retPlay*) e sem ggrSafra: as seções somem INTEIRAS. Nada de título
//      órfão nem card "—" que pareça "retenção zero". É o defeito que o deploy travado do clasp produz.
//   2) Re-escopo por CANAL soma CABEÇAS (Σn/Σd), nunca média de %. Uma média de % daria outro número.
//   3) O card de R$ traz o depósito absoluto da safra e o share fecha 100% entre as 4 safras.
//   4) As duas seções entram DEPOIS de "Retenção" (a leitura é: % em R$ → % em gente → R$ absoluto).
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const open = '<script id="app-bundle">';
const i0 = html.indexOf(open);
const bundle = html.slice(i0 + open.length, html.indexOf('</script>', i0));
const React = { createElement: () => ({}), Fragment: 'F', useState: (v) => [v, () => {}], useRef: (v) => ({ current: v }),
  useMemo: (f) => f(), useEffect: () => {}, useCallback: (f) => f };
const store = {};
const sandbox = { console, React, ReactDOM: { createRoot: () => ({ render: () => {} }) },
  document: { getElementById: () => ({}), createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }), addEventListener: () => {}, body: { appendChild: () => {} } },
  window: { addEventListener: () => {}, location: { search: '', href: '' }, matchMedia: () => ({ matches: false, addEventListener: () => {} }) },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: () => {} },
  fetch: () => ({ then: () => ({ catch: () => {} }) }), setTimeout, clearTimeout, setInterval, clearInterval,
  XMLHttpRequest: function () {}, navigator: { userAgent: 'node' }, Intl };
sandbox.window.localStorage = sandbox.localStorage;
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox, { filename: 'bundle.js' });
const buildFarolGroups_ = vm.runInContext('buildFarolGroups_', sandbox);
const deriveLiveM_ = vm.runInContext('deriveLiveM_', sandbox);
const buildFarolMetrics_ = vm.runInContext('buildFarolMetrics_', sandbox);

let fails = 0;
const ok = (cond, msg, extra) => { if (!cond) { fails++; console.log('  ✗ ' + msg + (extra != null ? '  → ' + extra : '')); } else console.log('  ✓ ' + msg); };
const near = (a, b, tol) => a != null && Math.abs(a - b) <= (tol || 1e-9);
const grupo = (gs, t) => gs.find(g => g.title === t);
const card = (g, lbl) => (g ? (g.cards || []).find(c => c && c.label === lbl) : null);

// ---- fixture: números REAIS medidos no BQ em 24/08 (ago/26 até 23/08), pra o teste falhar se a conta virar
const MM = {
  retM0M1:   { label: 'Retenção M0→M1', act: 0.358, bp: 0.54, fmt: 'pct' },
  retM1M2:   { label: 'Retenção M1→M2', act: 0.452, bp: 0.65, fmt: 'pct' },
  retM3plus: { label: 'Retenção M3+',   act: 0.540, bp: 0.86, fmt: 'pct' },
  retPlayM0M1:   { label: 'Jogadores M0→M1', act: 4665 / 33613, bp: null, fmt: 'pct' },
  retPlayM1M2:   { label: 'Jogadores M1→M2', act: 4291 / 7827,  bp: null, fmt: 'pct' },
  retPlayM3plus: { label: 'Jogadores M3+',   act: 7399 / 10164, bp: null, fmt: 'pct' },
};
const f = {
  depSafra_m0:     { label: 'Depósito M0',  act: 4179373, fmt: 'brl', share: 0.55, shareUnit: 'depósito' },
  depSafra_m1:     { label: 'Depósito M1',  act: 1733873, fmt: 'brl', share: 0.23, shareUnit: 'depósito' },
  depSafra_m2:     { label: 'Depósito M2',  act: 845494,  fmt: 'brl', share: 0.11, shareUnit: 'depósito' },
  depSafra_m3plus: { label: 'Depósito M3+', act: 845000,  fmt: 'brl', share: 0.11, shareUnit: 'depósito' },
};

console.log('\n1) seções presentes, na ordem certa, com os 3+4 cards');
{
  const gs = buildFarolGroups_(MM, f, null, false, null);
  const titles = gs.map(g => g.title);
  const iRet = titles.indexOf('Retenção'), iJog = titles.indexOf('Retenção por jogador'), iDep = titles.indexOf('Retenção de valores (R$)');
  ok(iJog > iRet, 'Retenção por jogador vem DEPOIS de Retenção', 'ret=' + iRet + ' jog=' + iJog);
  ok(iDep > iJog, 'Depósito por safra vem depois de Retenção por jogador', 'dep=' + iDep);
  const gJ = grupo(gs, 'Retenção por jogador');
  ok(gJ && gJ.cards.length === 3, 'seção de jogador tem 3 cards', gJ && gJ.cards.length);
  ok(near(card(gJ, 'Jogadores M0→M1').act, 0.13878, 1e-4), 'M0→M1 em cabeças = 13,88% (4.665/33.613)');
  ok(near(card(gJ, 'Jogadores M1→M2').act, 0.54822, 1e-4), 'M1→M2 em cabeças = 54,82% (4.291/7.827)');
  ok(near(card(gJ, 'Jogadores M3+').act,   0.72796, 1e-4), 'M3+ em cabeças = 72,80% (7.399/10.164)');
  const gD = grupo(gs, 'Retenção de valores (R$)');
  ok(gD && gD.cards.length === 4, 'seção de R$ tem 4 cards', gD && gD.cards.length);
  ok(card(gD, 'Depósito M1').act === 1733873, 'M1 traz o R$ absoluto, não o %');
  ok(card(gD, 'Depósito M1').fmt === 'brl', 'formato BRL');
  // o card de jogador NÃO pode herdar a meta do card de valor (o plano só tem meta em R$)
  ok(card(gJ, 'Jogadores M0→M1').bp == null, 'card de jogador sai SEM orçado (meta do plano é em R$)');
}

console.log('\n2) degradação: backend < v86 e/ou sem ggrSafra → seção some inteira');
{
  const MMold = { retM0M1: MM.retM0M1, retM1M2: MM.retM1M2, retM3plus: MM.retM3plus };
  const gs = buildFarolGroups_(MMold, {}, null, false, null);
  ok(!grupo(gs, 'Retenção por jogador'), 'sem retPlay* a seção de jogador NÃO renderiza (nem título órfão)');
  ok(!grupo(gs, 'Retenção de valores (R$)'), 'sem depSafra_* a seção de R$ NÃO renderiza');
  ok(!!grupo(gs, 'Retenção'), 'a seção de Retenção original continua de pé');
}
{
  // safra sem dado no bucket (ex.: mês sem M3+) → o card some, os outros ficam
  const f2 = { ...f, depSafra_m3plus: { label: 'Depósito M3+', act: null, fmt: 'brl' } };
  const gD = grupo(buildFarolGroups_(MM, f2, null, false, null), 'Retenção de valores (R$)');
  ok(gD && gD.cards.length === 3, 'bucket vazio sai da tela em vez de virar "—" mudo', gD && gD.cards.length);
}

console.log('\n3) re-escopo por canal soma CABEÇAS (Σn/Σd), nunca média de %');
{
  // Meta: 100/1000 = 10%   |   Google: 90/100 = 90%   →   Σ = 190/1100 = 17,27%   (média de % daria 50%)
  const playCh = [
    { channel: 'Meta',   nd: { n1: 100, d1: 1000, n2: 10, d2: 20, n3: 5, d3: 10 } },
    { channel: 'Google', nd: { n1: 90,  d1: 100,  n2: 30, d2: 40, n3: 7, d3: 10 } },
  ];
  const comp = { Meta: { mtd: {}, lm: {} }, Google: { mtd: {}, lm: {} } };
  const filter = { channel: null, scope: 'growth' };
  const out = deriveLiveM_(MM, filter, comp, [], [], null, [], [], playCh);
  ok(near(out.retPlayM0M1.act, 190 / 1100, 1e-9), 'growth = Σn/Σd = 17,27%', out.retPlayM0M1.act);
  ok(!near(out.retPlayM0M1.act, 0.5, 1e-9), 'NÃO é a média das taxas (50%)');
  const so = deriveLiveM_(MM, { channel: 'Google', scope: 'all' }, comp, [], [], null, [], [], playCh);
  ok(near(so.retPlayM0M1.act, 0.9, 1e-9), 'canal isolado = a taxa do próprio canal');
  // backend velho: sem a lista por canal, preserva o card da casa em vez de zerar
  const old = deriveLiveM_(MM, filter, comp, [], [], null, [], [], null);
  ok(near(old.retPlayM0M1.act, MM.retPlayM0M1.act, 1e-9), 'sem lista por canal preserva o card da casa (não zera)');
}

console.log('\n4) share do depósito por safra fecha 100% e segue o filtro de canal');
{
  const ggrSafra = {
    m0:     [{ channel: 'Meta', dep: 600, depM1: 500, ggr: 60, turnover: 6000 }, { channel: 'Google', dep: 400, depM1: 300, ggr: 40, turnover: 4000 }],
    m1:     [{ channel: 'Meta', dep: 200, depM1: 150, ggr: 20, turnover: 2000 }],
    m2:     [{ channel: 'Meta', dep: 100, depM1: 100, ggr: 10, turnover: 1000 }],
    m3plus: [{ channel: 'Meta', dep: 700, depM1: 600, ggr: 70, turnover: 7000 }],
  };
  const F = buildFarolMetrics_(MM, null, null, null, null, { channel: null, scope: 'all' }, ggrSafra);
  const soma = ['m0', 'm1', 'm2', 'm3plus'].reduce((a, b) => a + (F['depSafra_' + b].share || 0), 0);
  ok(near(soma, 1, 1e-9), 'as 4 safras somam 100% do depósito', soma);
  ok(F.depSafra_m0.act === 1000, 'M0 soma os canais (600+400)', F.depSafra_m0.act);
  ok(F.depSafra_m0.m1 === 800, 'M-1 vem do depM1 (500+300)', F.depSafra_m0.m1);
  const Fg = buildFarolMetrics_(MM, null, null, null, null, { channel: 'Google', scope: 'all' }, ggrSafra);
  ok(Fg.depSafra_m0.act === 400, 'filtro de canal recorta o R$ da safra', Fg.depSafra_m0.act);
  ok(Fg.depSafra_m1.act == null, 'canal sem linha na safra vira card vazio (some da tela), não 0', Fg.depSafra_m1.act);
}

console.log('\n5) MEDIANA de deposito por safra (nao a media)');
{
  // medScope = os 3 niveis que o backend manda prontos; mediana nao soma, entao o front so ESCOLHE.
  const ggrSafra = {
    m0:     [{ channel: 'Meta', dep: 600, depM1: 500, jog: 30, jogM1: 20, med: 12, medM1: 11, ggr: 60, turnover: 6000 },
             { channel: 'Google', dep: 400, depM1: 300, jog: 10, jogM1: 10, med: 40, medM1: 35, ggr: 40, turnover: 4000 }],
    m1:     [{ channel: 'Meta', dep: 200, depM1: 150, jog: 8,  jogM1: 5, med: 20, medM1: 18, ggr: 20, turnover: 2000 }],
    m2:     [{ channel: 'Meta', dep: 100, depM1: 100, jog: 0,  jogM1: 4, med: null, medM1: 25, ggr: 10, turnover: 1000 }],
    m3plus: [{ channel: 'Meta', dep: 700, depM1: 600, jog: 7,  jogM1: 6, med: 90, medM1: 80, ggr: 70, turnover: 7000 }],
    medScope: {
      m0:     { all: { med: 15, medM1: 13, jog: 40 }, growth: { med: 14, medM1: 12, jog: 40 } },
      m1:     { all: { med: 20, medM1: 18, jog: 8 },  growth: { med: 20, medM1: 18, jog: 8 } },
      m2:     { all: { med: null, medM1: 25, jog: 0 }, growth: { med: null, medM1: 25, jog: 0 } },
      m3plus: { all: { med: 90, medM1: 80, jog: 7 },  growth: { med: 90, medM1: 80, jog: 7 } },
    },
  };
  const F = buildFarolMetrics_(MM, null, null, null, null, { channel: null, scope: 'all' }, ggrSafra);
  ok(F.tktSafra_m0.act === 15, 'Total Casa usa o medScope.all (15), NAO a media 1000/40=25', F.tktSafra_m0.act);
  ok(F.tktSafra_m0.m1 === 13, 'M-1 tambem vem do escopo (13)', F.tktSafra_m0.m1);
  ok(!near(F.tktSafra_m0.act, (12 + 40) / 2, 1e-9), 'NAO e a media das medianas dos canais (26)');
  ok(F.tktSafra_m3plus.act === 90, 'M3+ = 90', F.tktSafra_m3plus.act);
  ok(/40 depositantes/.test(F.tktSafra_m0.note || ''), 'a nota traz os depositantes', F.tktSafra_m0.note);
  ok(/m.dia/i.test(F.tktSafra_m0.note || ''), 'a nota traz TAMBEM a media (o par que mede a assimetria)', F.tktSafra_m0.note);
  ok(F.tktSafra_m2.act == null, 'safra sem depositante nao tem mediana', F.tktSafra_m2.act);

  const Fg = buildFarolMetrics_(MM, null, null, null, null, { channel: null, scope: 'growth' }, ggrSafra);
  ok(Fg.tktSafra_m0.act === 14, 'escopo growth usa o medScope.growth (14)', Fg.tktSafra_m0.act);

  const F1 = buildFarolMetrics_(MM, null, null, null, null, { channel: 'Google', scope: 'all' }, ggrSafra);
  ok(F1.tktSafra_m0.act === 40, 'um canal so usa a mediana DAQUELE canal (40)', F1.tktSafra_m0.act);

  // 2+ canais: nao da pra compor. O card fica vazio DIZENDO por que, e a secao continua na tela.
  const F2 = buildFarolMetrics_(MM, null, null, null, null, { channels: ['Meta', 'Google'], scope: 'all' }, ggrSafra);
  ok(F2.tktSafra_m0.act == null, '2 canais: sem mediana (nao inventa media de medianas)', F2.tktSafra_m0.act);
  ok(/n.o soma entre canais/.test(F2.tktSafra_m0.note || ''), '2 canais: explica o vazio', F2.tktSafra_m0.note);
  const g2 = grupo(buildFarolGroups_(MM, F2, null, false, null), 'Mediana de depósito por safra');
  ok(g2 && g2.cards.length > 0, 'com 2 canais a secao NAO some (mostra o porque)', g2 && g2.cards.length);
  // e o card de R$ da secao de cima continua somando normal (esse SOMA)
  ok(F2.depSafra_m0.act === 1000, 'Deposito por safra (R$) segue somando os 2 canais', F2.depSafra_m0.act);

  // backend < v88 (sem med/medScope): a secao inteira some
  const semMed = { m0: [{ channel: 'Meta', dep: 600, depM1: 500, jog: 30, jogM1: 20, ggr: 60, turnover: 6000 }] };
  const F3 = buildFarolMetrics_(MM, null, null, null, null, { channel: null, scope: 'all' }, semMed);
  ok(F3.tktSafra_m0.act == null, 'backend sem mediana: card vazio', F3.tktSafra_m0.act);
  ok(!grupo(buildFarolGroups_(MM, F3, null, false, null), 'Mediana de depósito por safra'), 'backend velho: secao some inteira');
  ok(F3.depSafra_m0.act === 600, 'e o card de R$ continua de pe', F3.depSafra_m0.act);
}

console.log(fails ? `\n${fails} FALHA(S)\n` : '\nTUDO OK\n');
process.exit(fails ? 1 : 0);
