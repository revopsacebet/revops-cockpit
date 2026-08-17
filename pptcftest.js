// QA do PPT de Fechamento Mensal (aba Daily Cashflow) — roda o BUNDLE real num vm, com PptxGenJS
// mockado (captura addText/addTable/addShape em vez de gerar arquivo de verdade). Cobre:
//   ensurePPTX_        → resolve na hora quando PptxGenJS já existe no global (sem tentar baixar)
//   cfBpConservadorPnl_ → premissa × GGR do plano fecha com cfRollup_ igual ao realizado
//   pptAttain_/pptAttainColor_ → normalização lowerBetter (CAC) e corte 95/85%
//   gerarPptFechamento_ → 4 slides, sem exceção, com os números certos nas tabelas
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const open = '<script id="app-bundle">';
const i = html.indexOf(open);
const bundle = html.slice(i + open.length, html.indexOf('</script>', i));

const noop = () => {};
// Mock do PptxGenJS: cada slide guarda os addText/addTable/addShape recebidos, em ordem.
class MockSlide {
  constructor() { this.calls = []; this.background = null; }
  addText(t, o) { this.calls.push({ fn: 'addText', t, o }); return this; }
  addTable(rows, o) { this.calls.push({ fn: 'addTable', rows, o }); return this; }
  addShape(name, o) { this.calls.push({ fn: 'addShape', name, o }); return this; }
}
class MockPptxGenJS {
  constructor() { this.slides = []; this._layout = null; this.written = null; MockPptxGenJS.instances.push(this); }
  defineLayout(l) { this._layout = l; }
  set layout(v) { this._layoutName = v; }
  addSlide() { const s = new MockSlide(); this.slides.push(s); return s; }
  writeFile(o) { this.written = o; return Promise.resolve(o.fileName); }
}
MockPptxGenJS.instances = [];

const React = {
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(k => k != null) }),
  Fragment: 'Fragment', useState: (v) => [v, noop], useMemo: (f) => f(), useEffect: noop, useRef: () => ({ current: null }),
};
const sandbox = {
  console, React, ReactDOM: { createRoot: () => ({ render: noop }) }, PptxGenJS: MockPptxGenJS,
  document: { getElementById: () => ({}), createElement: () => ({ style: {}, setAttribute: noop }), addEventListener: noop, head: { appendChild: noop }, body: { appendChild: noop } },
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
const ensurePPTX_ = get('ensurePPTX_');
const cfBpConservadorPnl_ = get('cfBpConservadorPnl_');
const pptAttain_ = get('pptAttain_');
const pptAttainColor_ = get('pptAttainColor_');
const gerarPptFechamento_ = get('gerarPptFechamento_');
const CF_ASSUM = get('CF_ASSUM');
const cfRollup_ = get('cfRollup_');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } };
const near = (a, b, eps) => a != null && b != null && Math.abs(a - b) < (eps == null ? 1e-6 : eps);

console.log('\n— ensurePPTX_ (PptxGenJS já no global) —');
ensurePPTX_().then(() => ok(true, 'resolve sem tentar baixar script (typeof PptxGenJS !== undefined)'))
  .catch(() => ok(false, 'não deveria rejeitar'));

console.log('\n— cfBpConservadorPnl_ (mesma metodologia do "Estimado Fechamento") —');
{
  const ggrBp = 1000000, investBp = 300000, proRataPct = 0.5;
  const o = cfBpConservadorPnl_(ggrBp, investBp, proRataPct);
  ok(o != null, 'retorna objeto p/ GGR do plano presente');
  ok(near(o.ggr, ggrBp), 'GGR = o do plano, sem prorata (já vem da janela)');
  ok(near(o.repasse, -ggrBp * CF_ASSUM.pctRepasse), 'Repasse = -GGR x 13%');
  ok(near(o.custosFixos, -CF_ASSUM.mensal.custosFixos * proRataPct), 'Custos Fixos pró-rata pela mesma fração do realizado');
  ok(near(o.investTotal, -(investBp) + o.influencer + o.creator), 'Investimento Total = -investBp + influencer/creator pró-rata (mesmo somatório do cfRollup_)');
  const o2 = { ...o }; cfRollup_(o2);
  ok(near(o2.resLiq, o.resLiq), 'idempotente sob cfRollup_ (a função já fecha os subtotais)');
  ok(cfBpConservadorPnl_(null, investBp, proRataPct) === null, 'sem GGR do plano → null (não inventa BP zerado)');
}

console.log('\n— pptAttain_/pptAttainColor_ (normalização lowerBetter) —');
{
  // CAC: realizado 90, BP 100 (gastou MENOS por FTD, é bom) → razoão normalizada > 1, cor verde
  const pctCac = pptAttain_(90, 100, true);
  ok(near(pctCac, 100 / 90), 'CAC 90 vs BP 100 (lowerBetter) → razão = bp/act = ' + pctCac.toFixed(3));
  ok(pptAttainColor_(pctCac) === '4ADE80', 'CAC melhor que o BP pinta VERDE (>=95%)');
  // Investimento: realizado 120 vs BP 100 (gastou MAIS, lowerBetter) → razoão < 1, vermelho
  const pctInv = pptAttain_(120, 100, true);
  ok(pctInv < 1, 'Investimento 120 vs BP 100 (lowerBetter) → razão < 1 (' + pctInv.toFixed(3) + ')');
  ok(pptAttainColor_(pctInv) === 'F87171', 'Investimento estourado pinta VERMELHO');
  // GGR (não lowerBetter): realizado 80 vs BP 100 → 80%, amarelo (85-95 seria zona), aqui <85 vermelho
  const pctGgr = pptAttain_(80, 100, false);
  ok(near(pctGgr, 0.8), 'GGR 80 vs BP 100 → 80% de atingimento');
  ok(pptAttainColor_(pctGgr) === 'F87171', '80% < 85% → vermelho (corte igual ao Farol)');
}

console.log('\n— gerarPptFechamento_ (fluxo completo, sem exceção) —');
(async () => {
  const mk = (act, bp, m1) => ({ act, bp, m1: m1 == null ? null : m1 });
  const M = {
    ggr: mk(1000000, 1200000, 900000), invest: mk(300000, 350000, 280000),
    depTotal: mk(4000000, 4500000, 3800000), depM0Total: mk(1500000, 1700000, 1400000),
    roasFtd: mk(0.35, 0.30), turnover: mk(20000000, 22000000), rollover: mk(5.0, 5.1), hold: mk(0.05, 0.055),
    ftdAmount: mk(900000, 950000), ftdQty: mk(10000, 10500),
  };
  const farol = { cac: mk(90, 100), multM0: mk(1.66, 1.79), roasGgrM0: mk(0.22, 0.25), roasDepM0: mk(1.5, 1.6), ticketFtd: mk(90, 90) };
  const planScenarios = { conserv: {
    allAgg: { invest: 350000, ftd: 3500, ftdAmount: 950000, depD0: 500000, depM0: 1700000 },
    byChannel: {}, house: { ggr: 1200000, turnover: 22000000, totalDeposit: 4500000, m0tt: 1700000, invest: 350000, ftdAmountTt: 950000, ftdTt: 3500, winDays: 15, planDays: 15 },
  } };
  const totPnl = { ggr: 1000000, ngr: 700000, mc: 250000, lbSemMkt: -50000, investTotal: -300000, lbComMkt: -350000, ebitda: -450000, resLiq: -460000 };
  const totCaixa = { trafegoDefer: -200000, metaDefer: -150000, resLiq: -500000 };
  const projCaixa = { v: { resLiq: -900000 } };
  const ctx = {
    range: { from: '2026-08-01', to: '2026-08-15' }, meta: { dataMaxDate: '2026-08-15' },
    M, farol, planScenarios, chFilter: null, totPnl, totCaixa, projCaixa,
    monthsTouched: ['2026-08'], proRataPct: 15 / 31,
  };
  try {
    await gerarPptFechamento_(ctx);
    ok(true, 'gerarPptFechamento_ rodou sem lançar exceção');
    const p = MockPptxGenJS.instances[MockPptxGenJS.instances.length - 1];
    ok(p.slides.length === 4, '4 slides gerados (Sumário, Breakdown, PnL, Cashflow) — veio ' + p.slides.length);
    ok(!!p.written && /Fechamento Mensal/.test(p.written.fileName), 'writeFile chamado com nome de arquivo do fechamento: ' + (p.written && p.written.fileName));

    const tables = p.slides.map(s => s.calls.filter(c => c.fn === 'addTable'));
    // Slide 3 (índice 2) = PnL vs BP Conservador — checa a linha "Investimento Total" (cinza) e "GGR Líquido" (verde, pois BP conservador é mais baixo)
    const pnlRows = tables[2][0].rows;
    const investRow = pnlRows.find(r => r[0].text === 'Investimento Total');
    ok(!!investRow, 'linha Investimento Total presente na tabela de PnL');
    ok(investRow[3].options.color === '8B949E', 'Investimento Total pintado em CINZA (sem polaridade), veio ' + investRow[3].options.color);
    const ggrRow = pnlRows.find(r => r[0].text === 'GGR Líquido');
    ok(!!ggrRow, 'linha GGR Líquido presente');
    // totPnl.ggr=1.000.000 vs bpPnl.ggr=house.ggr=1.200.000 → delta negativo → vermelho
    ok(ggrRow[3].options.color === 'F87171', 'GGR Líquido abaixo do BP Conservador pinta vermelho, veio ' + ggrRow[3].options.color);

    // Slide 2 (índice 1) = breakdown de receita — confere a linha CAC (lowerBetter) com valores do fixture (90 vs 100 → verde)
    const a1Rows = tables[1][0].rows;
    const cacRow = a1Rows.find(r => r[0].text === 'CAC');
    ok(!!cacRow, 'linha CAC presente na aba 1');
    ok(cacRow[3].options.color === '4ADE80', 'CAC 90 vs BP 100 (lowerBetter) pinta verde, veio ' + cacRow[3].options.color);
    const recRow = a1Rows.find(r => r[0].text === 'Depósitos de Recorrentes');
    ok(!!recRow, 'linha Depósitos de Recorrentes presente (depTotal - depM0)');
    ok(recRow[1].text === 'R$ 2.500.000', 'Depósitos de Recorrentes = depTotal.act(4M) - depM0.act(1,5M) = R$ 2.500.000 (cfBRL não abrevia), veio ' + recRow[1].text);

    // Slide 4 (índice 3) = cashflow/riscos — confere as 2 linhas de risco e o mês de vencimento
    const riskTable = tables[3][0].rows;
    ok(riskTable.length === 3, 'tabela de risco tem cabeçalho + 2 linhas, veio ' + riskTable.length);
    ok(/set\/26/.test(riskTable[1][2].text), 'fatura de tráfego vence no mês seguinte (ago→set), veio "' + riskTable[1][2].text + '"');
    ok(/out\/26/.test(riskTable[2][2].text), 'fatura da Meta vence 2 meses depois (ago→out), veio "' + riskTable[2][2].text + '"');
  } catch (e) {
    ok(false, 'gerarPptFechamento_ lançou: ' + (e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
