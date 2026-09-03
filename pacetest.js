// QA do RITMO das retenções mensais no Farol (02/09/2026 — pedido do Luis: "mostrar quanto
// deveríamos estar HOJE pra bater o compromisso"). Roda o BUNDLE real num vm e exercita:
//   buildFarolGroups_  -> pendura paceBp = meta do mês × curva(dia) nos 3 cards de retenção
//   Hero               -> bolinha/% passam a medir RITMO quando paceBp existe (e NADA muda sem ele)
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const open = '<script id="app-bundle">';
const i = html.indexOf(open);
const bundle = html.slice(i + open.length, html.indexOf('</script>', i));
const noop = () => {};
// mini-React: createElement devolve a ÁRVORE (o Hero é componente puro, sem hooks) pra dar pra
// afirmar sobre className/texto renderizado em vez de confiar na leitura do código.
const React = {
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(k => k != null && k !== false) }),
  Fragment: 'Fragment',
  useState: (v) => [v, noop], useEffect: noop, useMemo: (f) => f(), useRef: () => ({ current: null }),
  useCallback: (f) => f,
};
const sandbox = {
  console, React, ReactDOM: { createRoot: () => ({ render: noop }) },
  document: { getElementById: () => ({}), createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }), addEventListener: noop, body: { appendChild: noop } },
  window: { addEventListener: noop, location: { search: '', href: '' }, matchMedia: () => ({ matches: false, addEventListener: noop }) },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
  setTimeout, clearTimeout, setInterval, clearInterval, XMLHttpRequest: function () {},
  navigator: { userAgent: 'node' }, Intl,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox, { filename: 'bundle.js' });
const get = (n) => vm.runInContext(n, sandbox);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-9;

const buildFarolGroups_ = get('buildFarolGroups_');
const Hero = get('Hero');

// ---- fixtures: os números REAIS de 02/09/2026 (o print que o Luis mandou) ----
const MM = {
  retM0M1:   { act: 0.034,  bp: 0.603, fmt: 'pct', label: 'Retenção M0→M1' },
  retM1M2:   { act: 0.0383, bp: 0.640, fmt: 'pct', label: 'Retenção M1→M2' },
  retM3plus: { act: 0.056,  bp: 0.850, fmt: 'pct', label: 'Retenção M3+' },
};
const RANGE = { from: '2026-09-01', to: '2026-09-01' };
// curva medida: no dia 1 de 30 o M+1 já costuma ter ~4,4% do numerador do mês
const RETMES = { mes: '2026-09', diaOk: 1, diasNoMes: 30, mesesCurva: ['2026-06', '2026-07', '2026-08'],
  pace: { m1: 0.044, m2: 0.036, m3: 0.031 } };
const cardOf = (groups, label) => {
  const g = (groups || []).find(x => x.id === 'retencao');
  return g ? (g.cards || []).find(c => c && c.label && c.label.indexOf(label) === 0) : null;
};

console.log('\n— buildFarolGroups_: paceBp = meta do mes x curva(dia) —');
let G = buildFarolGroups_(MM, {}, RANGE, false, null, RETMES);
const c1 = cardOf(G, 'Depósito M0→M1'), c2 = cardOf(G, 'Depósito M1→M2'), c3 = cardOf(G, 'Depósito M3+');
ok(c1 && near(c1.paceBp, 0.603 * 0.044), 'M0->M1: paceBp = 0,603 x 0,044 = ' + (c1 && c1.paceBp));
ok(c2 && near(c2.paceBp, 0.640 * 0.036), 'M1->M2: paceBp = 0,640 x 0,036');
ok(c3 && near(c3.paceBp, 0.850 * 0.031), 'M3+  : paceBp = 0,850 x 0,031');
ok(c1 && near(c1.bp, 0.603), 'a meta do MES continua intacta no card (o ritmo nao a substitui)');
ok(c1 && /dia 1 de 30/.test(c1.paceTitle || ''), 'o tooltip diz o dia e o tamanho do mes');
ok(c1 && /2026-06, 2026-07, 2026-08/.test(c1.paceTitle || ''), 'o tooltip nomeia os meses fechados da curva');
ok(c1 && /linear daria 3%/.test(c1.paceTitle || ''), 'o tooltip mostra o que o LINEAR daria, p/ nao parecer regua linear');

console.log('\n— os 4 casos em que o ritmo NAO pode aparecer —');
ok(!cardOf(buildFarolGroups_(MM, {}, RANGE, false, null, null), 'Depósito M0→M1').paceBp,
   'sem retMes (backend antigo / fetch em erro): degrada pro comportamento de antes');
ok(!cardOf(buildFarolGroups_(MM, {}, { from: '2026-04-01', to: '2026-09-01' }, true, null, RETMES), 'Depósito M0→M1').paceBp,
   'REGRESSAO: janela YTD (abr->set) — mes do card != mes do retmes, senao seria meta de set x curva de abr');
const MMsemBp = { retM0M1: { act: 0.034, bp: null, fmt: 'pct', label: 'Retenção M0→M1' } };
ok(!cardOf(buildFarolGroups_(MMsemBp, {}, RANGE, false, null, RETMES), 'Depósito M0→M1').paceBp,
   'escopo de canal/growth (bp ja vem null, nao ha plano por canal): sem meta nao ha ritmo');
ok(!cardOf(buildFarolGroups_(MM, {}, { from: '2026-08-01', to: '2026-08-31' }, false, null,
     { ...RETMES, mes: '2026-08', diaOk: 31, diasNoMes: 31, pace: { m1: 1, m2: 1, m3: 1 } }), 'Depósito M0→M1').paceBp,
   'mes FECHADO (pace = 1): a linha seria identica ao Orcado -> fica de fora');

console.log('\n— Hero: a bolinha e o % passam a medir RITMO —');
const flat = (n, acc = []) => { if (n == null || typeof n !== 'object') { if (n != null) acc.push(String(n)); return acc; }
  acc.push(JSON.stringify({ c: n.props.className, t: n.props.title })); (n.kids || []).forEach(k => flat(k, acc)); return acc; };
const txt = (n) => flat(n).join(' | ');
// act 3,4% vs esperado 2,653% = 128% -> VERDE (contra os 6% da meta do mes, que dava vermelho)
const sFarol = txt(Hero({ metric: c1, variant: 'farol' }));
ok(/Esperado hoje/.test(sFarol), 'aparece a linha "Esperado hoje" no card');
ok(/farol-dot verde/.test(sFarol), 'bolinha VERDE: 3,4% realizado vs 2,7% esperado p/ o dia 1 = 128%');
ok(/128,1% do esperado para hoje/.test(sFarol), 'o title da bolinha diz contra o que ela esta medindo');
ok((sFarol.match(/"pct verde"/g) || []).length === 1, 'so UM % colorido no card (o do ritmo) — o da meta do mes sai');
// REGRESSAO: o mesmo card SEM paceBp tem que voltar ao comportamento vermelho de antes
const semPace = { ...c1 }; delete semPace.paceBp;
const sAntes = txt(Hero({ metric: semPace, variant: 'farol' }));
ok(/farol-dot vermelho/.test(sAntes), 'REGRESSAO: sem paceBp a bolinha volta a ser VERMELHA (3,4% de 60,3% = 6%) — e o defeito que o ritmo corrige');
ok(!/Esperado hoje/.test(sAntes), 'REGRESSAO: sem paceBp nao existe linha de ritmo');
ok(/"pct vermelho"/.test(sAntes), 'REGRESSAO: sem paceBp o % da meta do mes volta a ser exibido e colorido');
// variante PADRAO (fora do Farol) tem que se comportar igual
const sStd = txt(Hero({ metric: c1, variant: null }));
ok(/Esperado hoje/.test(sStd) && /farol-dot verde/.test(sStd), 'variante padrao do Hero: mesmo comportamento');
// card comum (investimento) nao pode ter mudado nada
const inv = { act: 1000, bp: 2000, fmt: 'money', label: 'Investimento' };
const sInv = txt(Hero({ metric: inv, variant: 'farol' }));
ok(!/Esperado hoje/.test(sInv) && /farol-dot vermelho/.test(sInv) && /"pct vermelho"/.test(sInv),
   'REGRESSAO: card sem paceBp (Investimento 1000/2000 = 50%) sai exatamente como antes');
// custo (lowerBetter) com ritmo: a cor tem que INVERTER contra o esperado
const custo = { act: 80, bp: 200, paceBp: 100, fmt: 'money', label: 'CAC', lowerBetter: true };
const sCusto = txt(Hero({ metric: custo, variant: 'farol' }));
ok(/farol-dot verde/.test(sCusto), 'lowerBetter + ritmo: gastar 80 contra 100 esperado = VERDE (a inversao de custo continua valendo)');

// ============================================================================
// MESMO PONTO DO MÊS PASSADO (pedido do Luis, 03/09: "inclui aqui como estávamos pra cada retenção
// no mesmo período do mês passado"). Fixture = o payload REAL de 03/09/2026 (only=retmes), conferido
// contra o BQ no retmestest.js do backend: set até o dia 2 vs ago até o dia 2, e o M3+ na régua
// RESIDUAL do card (4,47% em ago) — não no ratio de coorte (4,31%), que é a régua do deck.
// ============================================================================
console.log('\n— prev: onde estávamos no mesmo dia do mês passado —');
const RETMES_SET = { mes: '2026-09', diaOk: 2, diasNoMes: 30, mesesCurva: ['2026-06', '2026-07', '2026-08'],
  pace: { m1: 0.101, m2: 0.081, m3: 0.078 },
  prev: { mes: '2026-08', dia: 2, diasNoMes: 31, m1: 0.0421, m2: 0.0403, m3: 0.0447, m3Coorte: 0.0431 },
  mtdCard: { m1: 0.0387, m2: 0.0476, m3: 0.0660 } };
const Gp = buildFarolGroups_(MM, {}, RANGE, false, null, RETMES_SET, {});
const p1 = cardOf(Gp, 'Depósito M0→M1'), p2 = cardOf(Gp, 'Depósito M1→M2'), p3 = cardOf(Gp, 'Depósito M3+');
ok(p1 && near(p1.prevAct, 0.0421), 'M0->M1: prevAct = 4,21% (ago ate o dia 2)');
ok(p2 && near(p2.prevAct, 0.0403), 'M1->M2: prevAct = 4,03%');
ok(p3 && near(p3.prevAct, 0.0447), 'M3+  : prevAct = 4,47% — a RESIDUAL, nao o 4,31% de coorte');
ok(p1 && /no mesmo dia de ago\/26/.test(p1.prevLabel || ''), 'o rotulo nomeia o mes do lado (ago/26)');
ok(p1 && near(p1.paceBp, 0.603 * 0.101), 'REGRESSAO: o ritmo continua intacto no mesmo card');
ok(p1 && near(p1.act, 0.034) && near(p1.bp, 0.603), 'REGRESSAO: valor e meta do card nao foram tocados');
// o tooltip precisa dar o PAR HONESTO (mesmo corte dos dois lados) — sem isso o leitor compara o
// headline (view mensal, ja com hoje pela metade) contra um numero de outro corte e le flat onde caiu.
ok(p1 && /3,9%/.test(p1.prevTitle || '') && /-8%/.test((p1.prevTitle || '').replace(/\u2212/g, '-')),
   'o tooltip traz o mesmo corte deste mes (3,9%) e o delta (-8%)');
ok(p3 && /residual/.test(p3.prevTitle || ''), 'so o M3+ avisa que a regua e a residual');
ok(p1 && /dia 2 \(de 31\)/.test(p1.prevTitle || ''), 'o tooltip diz ate que dia foi medido o mes passado');

console.log('\n— os casos em que o "mesmo dia do mes passado" NAO pode aparecer —');
ok(!cardOf(buildFarolGroups_(MM, {}, RANGE, false, null, { ...RETMES_SET, prev: null }, {}), 'Depósito M0→M1').prevAct,
   'backend antigo (sem prev no payload): degrada sem linha');
ok(!cardOf(buildFarolGroups_(MM, {}, RANGE, false, null, RETMES_SET, { channels: ['meta_ads'] }), 'Depósito M0→M1').prevAct,
   'slicer de CANAL: o retmes e house-level, mostrar a casa sob um recorte seria mentira');
ok(!cardOf(buildFarolGroups_(MM, {}, RANGE, false, null, RETMES_SET, { scope: 'growth' }), 'Depósito M0→M1').prevAct,
   'escopo GROWTH: mesma razao');
ok(!cardOf(buildFarolGroups_(MM, {}, { from: '2026-04-01', to: '2026-09-01' }, true, null, RETMES_SET, {}), 'Depósito M0→M1').prevAct,
   'janela YTD/multi-mes: o retmes olha outro mes');
// mes FECHADO: os dois lados sao meses inteiros -> o rotulo muda de "mesmo dia" p/ "mes cheio"
const fech = cardOf(buildFarolGroups_(MM, {}, { from: '2026-08-01', to: '2026-08-31' }, false, null,
  { mes: '2026-08', diaOk: 31, diasNoMes: 31, mesesCurva: [], pace: { m1: 1, m2: 1, m3: 1 },
    prev: { mes: '2026-07', dia: 31, diasNoMes: 31, m1: 0.478, m2: 0.522, m3: 0.852 },
    mtdCard: { m1: 0.417, m2: 0.559, m3: 0.711 } }, {}), 'Depósito M0→M1');
ok(fech && near(fech.prevAct, 0.478) && /jul\/26 \(mês cheio\)/.test(fech.prevLabel || ''),
   'mes fechado: compara mes cheio contra mes cheio e o rotulo diz isso');

console.log('\n— Hero: a linha aparece e nao mexe em nada do resto —');
const sPrev = txt(Hero({ metric: p1, variant: 'farol' }));
ok(/no mesmo dia de ago\/26/.test(sPrev), 'a linha sai renderizada no card do Farol');
// 3,4% realizado contra 6,09% esperado p/ o dia 2 (0,603 x 0,101) = 56% -> VERMELHO.
ok(/farol-dot vermelho/.test(sPrev), 'REGRESSAO: a bolinha continua medindo RITMO (nao o mes passado)');
ok((sPrev.match(/"pct (verde|amarelo|vermelho|cinza)"/g) || []).length === 1, 'REGRESSAO: continua so UM % colorido no card (o do ritmo) — a linha nova entra SEM %');
const sPrevStd = txt(Hero({ metric: p1, variant: null }));
ok(/no mesmo dia de ago\/26/.test(sPrevStd), 'variante padrao do Hero: mesma linha');
const semPrev = { ...p1 }; delete semPrev.prevAct;
ok(!/mesmo dia/.test(txt(Hero({ metric: semPrev, variant: 'farol' }))), 'REGRESSAO: card sem prevAct sai como antes');
ok(!/mesmo dia/.test(txt(Hero({ metric: inv, variant: 'farol' }))), 'REGRESSAO: card comum (Investimento) intacto');

console.log('\n' + (fail ? 'FALHOU: ' : 'TUDO OK: ') + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
