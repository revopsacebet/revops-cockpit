const { useState, useEffect } = React;

// Estado persistido em localStorage (sobrevive a refresh / troca de aba / sair e voltar).
function usePersistedState(key, initial) {
  const [v, setV] = React.useState(() => {
    try { const s = window.localStorage.getItem(key); return s != null ? JSON.parse(s) : initial; }
    catch (e) { return initial; }
  });
  React.useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }, [key, v]);
  return [v, setV];
}

// ============================================================
// CONFIG — set this to your Apps Script web app URL to go live.
// Quando `null`, o dashboard mostra o snapshot mock (modo dev).
// ============================================================
// Backend na conta acegaming (virada de 2026-08-05). O deployment anterior, na conta
// apostou (AKfycbz23…), segue existindo — rollback = voltar esta linha e rodar build.js.
const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbyEOI20P4Vzk3oqk8jIJDuSfPHhm9z3WAy0FjukzA5cSo5B8raM2qGPXyKydxyJV_s/exec';

// ===== AUTH (front) — sessão validada no backend (doPost). Token em localStorage; os
// fetches de dados (GET) mandam &session=<tok> via authParam_(). Login/admin via apiPost_.
const SESSION_KEY = 'rvops:session';
const USER_KEY = 'rvops:user';
function authParam_() { const s = localStorage.getItem(SESSION_KEY); return 'session=' + encodeURIComponent(s || ''); }
function apiPost_(payload, opts) {
  // ⚠️ COLD START do Apps Script: a 1ª chamada depois de um período ocioso demora MUITO — medido
  // 18,7s no navegador e, num pico, >42s (chegou a devolver 404 enquanto o deploy propagava). Sem
  // timeout o fetch ficava pendurado e a tela "Verificando sessão…" travava pra sempre, sem erro e
  // sem saída (o Luis bateu nisso 2× em 05/08). Timeout + 1 retry automático: se estourar, a promise
  // REJEITA e quem chamou cai no .catch (→ tela de login), em vez de ficar em limbo.
  const timeoutMs = (opts && opts.timeoutMs) || 45000;
  const tries = (opts && opts.tries) || 2;
  const attempt = (n) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    return fetch(ENDPOINT_URL, { method: 'POST', body: JSON.stringify(payload), signal: ctl.signal })
      .then(r => { clearTimeout(timer); return r.json(); })
      .catch(e => {
        clearTimeout(timer);
        if (n + 1 < tries) return attempt(n + 1);   // 2ª tentativa já pega a instância quente
        throw e;
      });
  };
  return attempt(0);
}

// ============================================================
// MOCK DATA — Farol snapshot (22/05/2026) — usado enquanto ENDPOINT_URL = null
// ============================================================
const MOCK_META = { refDate: '22/05/2026', m0Days: 31 };

const MOCK_M = {
  // AQUISIÇÃO
  ftdAmount:  { act: 2143094.85,  bp: 3937500,    m1: 415250,     pctBp: 0.5444, fmt: 'brl',      label: 'FTD Amount' },
  roasFtd:    { act: 0.327,       bp: 0.275,      m1: 0.641,      pctBp: 1.188,  fmt: 'multiple', label: 'ROAS FTD' },
  invest:     { act: 3567125.92,  bp: 10647822.58,m1: 216996.35,  pctBp: 0.3350, fmt: 'brl',      label: 'Investimento' },
  registros:  { act: 41284,       bp: null,       m1: 12907,      pctBp: null,   fmt: 'qty',      label: 'Registros' },
  // RETENÇÃO
  retM0M1:    { act: 0.2079, bp: 0.75, m1: 0.2388, pctBp: 0.2772, fmt: 'pct', label: 'Retenção M0→M1' },
  retM1M2:    { act: 0.7436, bp: 0.72, m1: 0.3295, pctBp: 1.0328, fmt: 'pct', label: 'Retenção M1→M2' },
  retM3plus:  { act: 0.5401, bp: 0.88, m1: 0.7801, pctBp: 0.6138, fmt: 'pct', label: 'Retenção M3+' },
  // DEPÓSITOS
  depTotal:    { act: 10935097.81, bp: 20012903.23, m1: 4780033.68, pctBp: 0.5464, fmt: 'brl', label: 'Depósitos Totais' },
  qtdDep:      { act: 184523, bp: null, m1: 91044, pctBp: null, fmt: 'qty', label: 'Qtd Depósitos' },
  depM0Total:  { act: 7617534.54,  bp: 20012903.23, m1: 1707288.65, pctBp: 0.3806, fmt: 'brl', label: 'DEP M0 Total' },
  depM0Growth: { act: 5032012.26,  bp: 16287097.02, m1: 442584.38,  pctBp: 0.3090, fmt: 'brl', label: 'DEP M0 Growth' },
  // GGR
  ggr:        { act: 1514272.40, bp: 3577746.74, m1: 683588.78, pctBp: 0.4232, fmt: 'brl', label: 'GGR Total' },
  ggrPerDep:  { act: 0.1385,     bp: 0.1788,     m1: 0.1430,    pctBp: 0.7746, fmt: 'pct', label: 'GGR / Depósito' },
  ggrTrend:   { act: 2133747.47, bp: 3577746.74, m1: null,      pctBp: 0.5964, fmt: 'brl', label: 'Close Trend GGR' },
  // APOSTAS (MOCK)
  turnover:    { act: 24850000, bp: 32500000, m1: 11200000, pctBp: 0.7646, fmt: 'brl', label: 'Turnover Total' },
  hold:        { act: 0.0609,   bp: 0.0750,   m1: 0.0610,   pctBp: 0.8120, fmt: 'pct', label: 'Hold % (GGR / Turnover)' },
  rollover:    { act: 2.27,     bp: 2.50,     m1: 2.34,     pctBp: 0.9080, fmt: 'multiple', label: 'Rollover (Turnover / Depósito)' },
};

// Mock — rollover por canal × tipo de jogo (modo dev). Só alimenta a métrica `rollover` do dataset
// mock (card do Farol). ⚠️ 2026-08-05: com a aba Turnover removida, o front NÃO guarda mais
// `payload.rolloverMatrix` — o backend ainda manda, mas ninguém lê no modo live.
// Verticais reais da player_metrics: valor_apostas_esporte / _casino / _loteria
const MOCK_ROLLOVER_MATRIX = {
  columns: ['Sports', 'Casino', 'Loteria'],
  rows: [
    { channel: 'Meta',          values: [0.84, 1.02, 0.38], total: 2.24, weight: 7800000 },
    { channel: 'Google',        values: [0.95, 0.88, 0.45], total: 2.28, weight: 5100000 },
    { channel: 'TikTok',        values: [0.62, 1.18, 0.29], total: 2.09, weight: 1900000 },
    { channel: 'Kwai',          values: [0.51, 1.24, 0.22], total: 1.97, weight: 800000 },
    { channel: 'Afiliados',     values: [1.12, 0.74, 0.52], total: 2.38, weight: 1500000 },
    { channel: 'Orgânico (sem atribuição)', values: [0.98, 0.81, 0.41], total: 2.20, weight: 3200000 },
  ],
};

// Growth = APENAS esta lista fixa (allowlist). 'Outros'/Social/Orgânico/Afiliados ficam
// de fora. Espelha GROWTH_CHANNELS do Code.gs (regra do Luis 2026-06-19). Filtro client-side.
const GROWTH_CHANNELS = ['Meta', 'Google', 'TikTok', 'Kwai', 'Programática'];
const isGrowthCh_ = (ch) => GROWTH_CHANNELS.indexOf(ch) >= 0;

const CLUSTER_DEP = [
  { label: '% DEP Novos', value: 0.7196 },
  { label: '% DEP Recorrentes', value: 0.2350 },
  { label: '% DEP Reativados', value: 0.1156 },
];

// Mock — aquisição por canal (modo dev). Live vem de payload.channels.
// spend: null = canal sem investimento de mídia (social/afiliados/orgânico)
const MOCK_CHANNELS = [
  { channel: 'Meta',          spend: 1842300, ftdQty: 14820, ftdAmount: 1058400, depD0: 1894200 },
  { channel: 'Google',        spend: 1120800, ftdQty: 9640,  ftdAmount: 712300,  depD0: 1218400 },
  { channel: 'TikTok',        spend: 421500,  ftdQty: 4180,  ftdAmount: 268900,  depD0: 423600 },
  { channel: 'Kwai',          spend: 182525,  ftdQty: 2722,  ftdAmount: 103494,  depD0: 161800 },
  { channel: 'Afiliados',     spend: null,    ftdQty: 3210,  ftdAmount: 224800,  depD0: 391500 },
  { channel: 'Social Media',  spend: null,    ftdQty: 1840,  ftdAmount: 96300,   depD0: 152400 },
  { channel: 'Orgânico (sem atribuição)', spend: null, ftdQty: 5420, ftdAmount: 318700, depD0: 540900 },
];

// Mock — BP por canal (modo dev). Live vem de payload.bp. Só byChannel é usado pela UI
// (ChannelTable + FtdBridge): ftdAmount = FTD R$ planejado · invest/ftd/depD0/depM0 = plano.
// Só os canais Growth têm plano (espelha o BP real); orgânico/afiliados/social ficam sem.
const MOCK_BP = {
  byChannel: {
    'Meta':   { invest: 1700000, ftdAmount: 1500000, ftd: 14000, depD0: 2100000, depM0: 3200000 },
    'Google': { invest: 1050000, ftdAmount: 600000,  ftd: 9000,  depD0: 1150000, depM0: 1900000 },
    'TikTok': { invest: 480000,  ftdAmount: 420000,  ftd: 4800,  depD0: 470000,  depM0: 720000 },
    'Kwai':   { invest: 150000,  ftdAmount: 70000,   ftd: 2500,  depD0: 140000,  depM0: 250000 },
  },
};

// Mock — GGR por canal (modo dev). Live vem de payload.ggrChannels.
// "GGR" do negócio = ngr_total da player_metrics (regra Apostou).
const MOCK_GGR_CHANNELS = [
  { channel: 'Meta',          ggr: 612400, spend: 1842300, freespin: 48200, ggrCasino: 629980, ggrEsporte: 30620, ggrLoteria: 0, bonus: 122480 },
  { channel: 'Google',        ggr: 488100, spend: 1120800, freespin: 31500, ggrCasino: 495195, ggrEsporte: 24405, ggrLoteria: 0, bonus: 97620 },
  { channel: 'TikTok',        ggr: 156800, spend: 421500,  freespin: 14800, ggrCasino: 163760, ggrEsporte: 7840,  ggrLoteria: 0, bonus: 31360 },
  { channel: 'Kwai',          ggr: -12400, spend: 182525,  freespin: 6200,  ggrCasino: -5580,  ggrEsporte: -620,  ggrLoteria: 0, bonus: 2480 },
  { channel: 'Orgânico (sem atribuição)', ggr: 269400, spend: null, freespin: 22900, ggrCasino: 278830, ggrEsporte: 13470, ggrLoteria: 0, bonus: 53880 },
  { channel: 'Afiliados',     ggr: 121700, spend: null, freespin: 9800, ggrCasino: 125415, ggrEsporte: 6085, ggrLoteria: 0, bonus: 24340 },
  { channel: 'Social Media',  ggr: 54300,  spend: null, freespin: 4100, ggrCasino: 55685, ggrEsporte: 2715, ggrLoteria: 0, bonus: 10860 },
];

// Mock — GGR por safra (M0/M1/M2/M3+) (modo dev). Live vem de payload.ggrSafra.
// Existe SÓ pra o toggle de safra (Todas/M0/M1/M2/M3+) aparecer durante o load, igual todas as
// outras dimensões já têm mock — senão ele some no 1º acesso (mock não tinha safra). {ggr,ggrM1,dep,depM1}.
const MOCK_GGR_SAFRA = {
  m0: [
    { channel: 'Meta',   ggr: 235800, ggrM1: 218400, dep: 1680000, depM1: 1510000 },
    { channel: 'Google', ggr: 188100, ggrM1: 172300, dep: 1240000, depM1: 1180000 },
    { channel: 'TikTok', ggr: 62800,  ggrM1: 58200,  dep: 448000,  depM1: 420000 },
    { channel: 'Kwai',   ggr: -4400,  ggrM1: -3900,  dep: 96000,   depM1: 88000 },
  ],
  m1: [
    { channel: 'Meta',   ggr: 168400, ggrM1: 154200, dep: 980000, depM1: 910000 },
    { channel: 'Google', ggr: 132900, ggrM1: 121800, dep: 720000, depM1: 690000 },
    { channel: 'TikTok', ggr: 41200,  ggrM1: 38900,  dep: 262000, depM1: 248000 },
  ],
  m2: [
    { channel: 'Meta',   ggr: 121600, ggrM1: 118300, dep: 640000, depM1: 620000 },
    { channel: 'Google', ggr: 98700,  ggrM1: 94100,  dep: 470000, depM1: 452000 },
    { channel: 'TikTok', ggr: 28900,  ggrM1: 27400,  dep: 175000, depM1: 168000 },
  ],
  m3plus: [
    { channel: 'Meta',   ggr: 86600, ggrM1: 82100, dep: 410000, depM1: 396000 },
    { channel: 'Google', ggr: 68400, ggrM1: 65200, dep: 350000, depM1: 338000 },
  ],
};

// Mock — invest + GGR acumulado por safra (ROAS de coorte) (modo dev). Live vem de payload.ggrSafraRoas.
const MOCK_GGR_SAFRA_ROAS = {
  m0: [
    { channel: 'Meta',   invest: 1842300, cumGgr: 235800 },
    { channel: 'Google', invest: 1120800, cumGgr: 188100 },
    { channel: 'TikTok', invest: 421500,  cumGgr: 62800 },
  ],
  m1: [
    { channel: 'Meta',   invest: 1720000, cumGgr: 403200 },
    { channel: 'Google', invest: 1080000, cumGgr: 312400 },
    { channel: 'TikTok', invest: 398000,  cumGgr: 89100 },
  ],
  m2: [
    { channel: 'Meta',   invest: 1560000, cumGgr: 612800 },
    { channel: 'Google', invest: 980000,  cumGgr: 498700 },
    { channel: 'TikTok', invest: 372000,  cumGgr: 168900 },
  ],
  m3plus: [
    { channel: 'Meta',   invest: 245000, cumGgr: 372600 },
    { channel: 'Google', invest: 158000, cumGgr: 268400 },
  ],
};

// Mock — payback de GGR por canal (modo dev). Live vem de payload.ggrPayback.
// paybackDays = dias até o GGR acumulado da safra cobrir o investimento (safras maduras, horizonte 90d).
const MOCK_GGR_PAYBACK = {
  horizonDays: 90,
  cohortFrom: '2025-12-12', cohortTo: '2026-03-12', asOf: '2026-06-09',
  byChannel: {
    'Meta':   { paybackDays: 34, reached: true,  spend: 1842300, ggrH: 2103400, roasH: 1.14 },
    'Google': { paybackDays: 41, reached: true,  spend: 1120800, ggrH: 1198900, roasH: 1.07 },
    'TikTok': { paybackDays: 67, reached: true,  spend: 421500,  ggrH: 438100,  roasH: 1.04 },
    'Kwai':   { paybackDays: null, reached: false, spend: 182525, ggrH: 121300, roasH: 0.66 },
  },
  total: { paybackDays: 38, reached: true, spend: 3567125, ggrH: 3861700, roasH: 1.08 },
};

// Mock — DEP M0 por canal (modo dev). Live vem de payload.depM0Channels.
const MOCK_DEPM0_CHANNELS = [
  { channel: 'Meta',          depM0: 2814000, invest: 1842300 },
  { channel: 'Google',        depM0: 1922000, invest: 1120800 },
  { channel: 'TikTok',        depM0: 684000,  invest: 421500 },
  { channel: 'Kwai',          depM0: 297000,  invest: 182525 },
  { channel: 'Orgânico (sem atribuição)', depM0: 1213000, invest: null },
  { channel: 'Afiliados',     depM0: 688000,  invest: null },
];

// Mock — retenção de valor por canal (modo dev). Live vem de payload.retentionChannels.
const MOCK_RETENTION_CHANNELS = [
  { channel: 'Meta',          m0Total: 4214000, m0m1: 0.243, m1m2: 0.548, m3plus: 0.612, nd: { n1: 0.243*3800000, d1: 3800000, n2: 0.548*920000, d2: 920000, n3: 0.612*480000, d3: 480000 } },
  { channel: 'Google',        m0Total: 2873000, m0m1: 0.281, m1m2: 0.575, m3plus: 0.655, nd: { n1: 0.281*2600000, d1: 2600000, n2: 0.575*730000, d2: 730000, n3: 0.655*390000, d3: 390000 } },
  { channel: 'Orgânico (sem atribuição)', m0Total: 1517000, m0m1: 0.352, m1m2: 0.681, m3plus: 0.742, nd: { n1: 0.352*1400000, d1: 1400000, n2: 0.681*490000, d2: 490000, n3: 0.742*310000, d3: 310000 } },
  { channel: 'TikTok',        m0Total: 1098000, m0m1: 0.194, m1m2: 0.492, m3plus: 0.518, nd: { n1: 0.194*990000, d1: 990000, n2: 0.492*190000, d2: 190000, n3: 0.518*90000, d3: 90000 } },
  { channel: 'Afiliados',     m0Total: 884000,  m0m1: 0.312, m1m2: 0.624, m3plus: 0.701, nd: { n1: 0.312*800000, d1: 800000, n2: 0.624*250000, d2: 250000, n3: 0.701*160000, d3: 160000 } },
  { channel: 'Kwai',          m0Total: 421000,  m0m1: 0.171, m1m2: 0.448, m3plus: 0.476, nd: { n1: 0.171*380000, d1: 380000, n2: 0.448*65000, d2: 65000, n3: 0.476*28000, d3: 28000 } },
];

const CLUSTER_GGR = [
  { label: 'GGR / DEP M0', value: 0.1510 },
  { label: 'GGR / DEP M1', value: 0.0860 },
  { label: 'GGR / DEP M2', value: 0.0427 },
  { label: 'GGR / DEP M3+', value: 0.1794 },
  { label: 'GGR / Reativados', value: 0.0504 },
];

// Mock composition — só usado em modo dev (ENDPOINT_URL = null)
const MOCK_DEP_COMPOSITION = [
  { label: 'Novos (M0)',  value: 0.7196 * MOCK_M.depTotal.act },
  { label: 'Recorrentes', value: 0.2350 * MOCK_M.depTotal.act },
  { label: 'Reativados',  value: 0.1156 * MOCK_M.depTotal.act },
];

const VERTICALS = [
  { label: 'Sports',      value: 0.382, amount: 24850000 * 0.382 },
  { label: 'Slots',       value: 0.354, amount: 24850000 * 0.354 },
  { label: 'Live Casino', value: 0.179, amount: 24850000 * 0.179 },
  { label: 'Outros',      value: 0.085, amount: 24850000 * 0.085 },
];

// ============================================================
// FAROL BANDS — ≥95% verde · 85–94% amarelo · <85% vermelho
// ============================================================
const BAND_VERDE = 0.95, BAND_AMARELO = 0.85;
function farolFromPct(p) {
  if (p === null || p === undefined || isNaN(p)) return 'cinza';
  if (p >= BAND_VERDE) return 'verde';
  if (p >= BAND_AMARELO) return 'amarelo';
  return 'vermelho';
}

// ============================================================
// FORMATTERS
// ============================================================
const fmtBRL = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return sign + 'R$ ' + (abs / 1e6).toFixed(2).replace('.', ',') + 'M';
  if (abs >= 1e3) return sign + 'R$ ' + (abs / 1e3).toFixed(1).replace('.', ',') + 'k';
  return sign + 'R$ ' + abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const fmtPct = (n, d = 1) => (n === null || n === undefined || isNaN(n)) ? '—' : (n * 100).toFixed(d).replace('.', ',') + '%';
const fmtMultiple = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : n.toFixed(2).replace('.', ',') + 'x';
const fmtQty = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(n).toLocaleString('pt-BR');
const fmtVal = (n, fmt) => {
  if (n === null || n === undefined) return '—';
  if (fmt === 'brl') return fmtBRL(n);
  if (fmt === 'pct') return fmtPct(n);
  if (fmt === 'multiple') return fmtMultiple(n);
  if (fmt === 'qty') return fmtQty(n);
  return String(n);
};

// ============================================================
// HERO CARD
// ============================================================

// Farol LIGADO — o backend (Code.gs) manda payload.bp embutido (BP_DATA). ACT negativo ainda esconde.
const BP_FAROL_ON = true;

// Direção da série (4 semanas) via regressão linear: variação modelada ponta-a-ponta ÷ nível médio.
// Banda de 3% pra "flat" não amplificar ruído. Nulls (semana sem dado) são ignorados (usa índice original).
function sparkDir_(vals) {
  const pts = [];
  (vals || []).forEach((x, i) => { if (x != null && isFinite(x)) pts.push([i, x]); });
  if (pts.length < 2) return 'flat';
  const n = pts.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  pts.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0;
  const mean = sy / n;
  const span = (pts[pts.length - 1][0] - pts[0][0]) || 1;
  const rel = mean ? (slope * span) / Math.abs(mean) : 0;   // variação relativa da reta no intervalo
  if (rel > 0.03) return 'up';
  if (rel < -0.03) return 'down';
  return 'flat';
}

// Rótulo COMPACTO do ponto da sparkline (o card já mostra a unidade no valor grande, então o R$ sai
// pra caber 4 rótulos lado a lado). Mantém % e x, que SÃO a unidade e sem elas o número fica ambíguo.
function sparkLbl_(v, fmt) {
  if (v == null || !isFinite(v)) return '';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  const dec = (x, d) => x.toFixed(d).replace('.', ',');
  // brl: MESMA escala/casas do valor grande do card (fmtBRL), só sem o "R$" — a unidade já está no card,
  // e repetir 4× rouba a largura que os rótulos precisam pra não colidir.
  if (fmt === 'brl') return fmtBRL(v).replace('R$ ', '');
  if (fmt === 'qty') {
    if (a >= 1e6) return s + dec(a / 1e6, 1) + 'M';
    if (a >= 1e4) return s + dec(a / 1e3, 1) + 'k';
    return fmtQty(v);
  }
  if (fmt === 'pct') return fmtPct(v, 1);
  if (fmt === 'multiple') return fmtMultiple(v);
  return fmtVal(v, fmt);
}

// 'YYYY-MM-DD' (segunda-feira, início da semana) → '07–13/07' (seg–dom). UTC pra não escorregar por DST.
function sparkWeekLbl_(w) {
  const p = String(w || '').slice(0, 10).split('-');
  if (p.length < 3 || !p[0]) return String(w || '');
  const ini = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  if (isNaN(ini.getTime())) return String(w);
  const fim = new Date(ini.getTime() + 6 * 864e5);
  const dm = (x) => String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0');
  return dm(ini) + '–' + dm(fim);
}

// Sparkline dos hero cards do Farol: linha NEUTRA (branca) dos últimos 4 blocos de 7 dias CORRIDOS
// (2026-08-05: eram semanas de calendário seg–dom), um ponto por bloco, + seta ↑↑/→→/↓↓ branca na base.
// Os blocos não se sobrepõem e terminam na data de referência da janela — a última bolinha é "últimos 7
// dias", a penúltima os 7 anteriores, e assim por diante até 28 dias atrás. Cor de status fica SÓ na bolinha do farol (de propósito).
// Escala com amplitude mínima (~6% da média) pra série flat parecer flat, não amplificar ruído.
// Cada ponto carrega o VALOR daquela semana (rótulo acima da bolinha) + tooltip com o intervalo de datas —
// sem isso a linha só dizia "sobe/desce", não QUANTO. Os rótulos são HTML absoluto (não <text> no SVG)
// porque o SVG usa preserveAspectRatio="none": texto dentro dele sairia esticado na horizontal.
function Sparkline({ values, weeks, fmt }) {
  const raw = values || [];
  const idx = []; raw.forEach((v, i) => { if (v != null && isFinite(v)) idx.push(i); });
  if (idx.length < 2) return null;
  // padTop maior que o padBot: abre a faixa onde os rótulos ficam, sem achatar a curva (H cresceu junto).
  const n = raw.length, W = 300, H = 58, padX = 5, padTop = 20, padBot = 10;
  const xs = (i) => padX + (n > 1 ? i * ((W - 2 * padX) / (n - 1)) : (W / 2));
  const vals = idx.map(i => raw[i]);
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length || 1;
  const center = (mn + mx) / 2;
  let half = Math.max((mx - mn) / 2, Math.abs(mean) * 0.06); if (half <= 0) half = 1;
  const lo = center - half, hi = center + half;
  const ys = (v) => (H - padBot) - ((v - lo) / (hi - lo)) * (H - padTop - padBot);
  const pts = idx.map(i => [xs(i), ys(raw[i])]);
  const d = pts.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const dir = sparkDir_(raw);
  const arrow = dir === 'up' ? '↑↑' : dir === 'down' ? '↓↓' : '→→';
  const dirLbl = dir === 'up' ? 'subindo' : dir === 'down' ? 'caindo' : 'estável';
  const wk = weeks || [];
  const tip = (i) => (wk[i] ? `${sparkWeekLbl_(wk[i])} (7 dias) · ` : '') + fmtVal(raw[i], fmt);
  // Intervalo COBERTO pelas bolinhas, impresso no card (à esquerda, na linha da seta — lado sempre vazio).
  // Sem isso a linha vira armadilha: numa janela curta o card mostra 5 dias e as bolinhas mostram as 4
  // semanas fechadas que desembocam nela, e não dá pra saber disso sem passar o mouse.
  const rangeLbl = wk.length
    ? sparkWeekLbl_(wk[0]).split('–')[0] + '–' + sparkWeekLbl_(wk[wk.length - 1]).split('–')[1]
    : '';
  return (
    <div className="spark" title={`${n} bloco${n > 1 ? 's' : ''} de 7 dias corridos até o fim do período · ${dirLbl}`}>
      {/* a altura CSS do .spark-svg é IGUAL ao H do viewBox → o y do ponto vira px direto no `top` do rótulo */}
      <div className="spark-plot" style={{ height: H + 'px' }}>
        <svg className="spark-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <path d={d} className="spark-line" fill="none" vectorEffect="non-scaling-stroke" />
          {pts.map((p, k) => (
            <circle key={k} cx={p[0]} cy={p[1]} r="3" className="spark-dot">
              <title>{tip(idx[k])}</title>
            </circle>
          ))}
        </svg>
        {pts.map((p, k) => {
          const i = idx[k];
          // ponta esquerda/direita ancoram na borda pra o rótulo não vazar do card
          const anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'mid');
          return (
            <span key={k} className={`spark-lbl ${anchor}`} style={{ left: (p[0] / W * 100) + '%', top: p[1] + 'px' }} title={tip(i)}>
              {sparkLbl_(raw[i], fmt)}
            </span>
          );
        })}
      </div>
      {rangeLbl ? <span className="spark-range">{rangeLbl}</span> : null}
      <span className="spark-arrow" aria-hidden="true">{arrow}</span>
    </div>
  );
}

function Hero({ metric, variant }) {
  // Duas leituras SEPARADAS do "vs BP":
  //  • pct EXIBIDO = razão CRUA ACT/BP (o que o usuário lê: "82/91 = 90% do orçado") — NÃO inverte p/ custo.
  //  • atingimento (só p/ a COR) = maior=melhor → ACT/BP; custo (menor=melhor: CAC/FreeSpins/Bonif) → BP/ACT.
  //    Assim o número diz onde você está vs orçado (>100% = estourou) e a cor diz se isso é bom (custo abaixo do orçado = verde).
  const lb = !!metric.lowerBetter;
  const ratioBp = (v) => (v == null || metric.bp == null || metric.bp === 0) ? null : v / metric.bp;
  const attain  = (v) => (v == null || metric.bp == null || metric.bp === 0 || (lb && v === 0)) ? null
    : (lb ? metric.bp / v : v / metric.bp);
  // Farol off enquanto BP pausado; ACT negativo (dado corrompido) também esconde.
  const gated = !BP_FAROL_ON || (metric.act != null && metric.act < 0);
  const pct   = gated ? null : ratioBp(metric.act);                // razão crua exibida (ACT/BP)
  const farol = farolFromPct(gated ? null : attain(metric.act));   // cor pela qualidade (custo inverte)
  // Variante FAROL: valor à esquerda · BP/Trend/M-1 à direita · sparkline das 4 semanas na base (só cards de fluxo).
  if (variant === 'farol') {
    return (
      <div className="hero hero-farol">
        <div className="head">
          <div className="label">{metric.label}</div>
          <span className={`farol-dot ${farol}`} title={`${fmtPct(pct)} do BP`} />
        </div>
        <div className="hf-body">
          <div className="value">{fmtVal(metric.act, metric.fmt)}</div>
          <div className="hf-stats">
            {pct != null && (
              <div className="hf-bp">
                <span className="bp-label">{metric.bpLabel || 'BP'}</span> <span className="bp-val">{fmtVal(metric.bp, metric.fmt)}</span>{' '}
                <span className={`pct ${farol}`}>{fmtPct(pct, 0)}</span>
              </div>
            )}
            {metric.trend != null && (
              <div className="hf-trend" title="Projeção de fechamento do mês = MTD × (dias do mês ÷ dias decorridos)">
                <span className="trend-tag">↗ Trend</span> <span className="trend-val">{fmtVal(metric.trend, metric.fmt)}</span>
              </div>
            )}
            {metric.m1 != null && metric.act != null && (
              <div className="hf-m1"><span className="m1-val">{fmtVal(metric.m1, metric.fmt)}</span>{' '}mês anterior</div>
            )}
            {/* Peso da safra no GGR do período — diz quanto a métrica deste card importa no resultado. */}
            {metric.share != null && (
              <div className="hf-share" title={`Participação desta safra no ${metric.shareUnit || 'GGR'} do período: Σ ${metric.shareUnit || 'GGR'} da safra ÷ Σ ${metric.shareUnit || 'GGR'} de todas as safras, no escopo de canal atual (as 4 safras somam 100%). Segue o NUMERADOR da métrica deste card.${metric.shareM1 != null ? ` Mesma janela do mês anterior: ${fmtPct(metric.shareM1, 0)}.` : ''}`}>
                <span className="share-val">{fmtPct(metric.share, 0)}</span>{' '}do {metric.shareUnit || 'GGR'}
              </div>
            )}
          </div>
        </div>
        {metric.spark ? <Sparkline values={metric.spark} weeks={metric.sparkWeeks} fmt={metric.fmt} /> : null}
      </div>
    );
  }
  return (
    <div className="hero">
      <div className="head">
        <div className="label">{metric.label}</div>
        <span className={`farol-dot ${farol}`} title={`${fmtPct(pct)} do BP`} />
      </div>
      <div className="value">{fmtVal(metric.act, metric.fmt)}</div>
      {pct != null && (
        <div className="vs-bp">
          <div className="vs-bp-head">
            <span><span className="bp-label">{metric.bpLabel || 'BP'}</span> <span className="bp-val">{fmtVal(metric.bp, metric.fmt)}</span></span>
            <span className={`pct ${farol}`}>{fmtPct(pct, 0)}</span>
          </div>
        </div>
      )}
      {metric.trend != null && (
        <div className="trend-line" title="Projeção de fechamento do mês = MTD × (dias do mês ÷ dias decorridos)">
          <span className="trend-tag">↗ Trend</span>
          <span className="trend-val">{fmtVal(metric.trend, metric.fmt)}</span>
        </div>
      )}
      {metric.m1 != null && metric.act != null && (
        <div className="delta-m1">
          <span className="m1-val">{fmtVal(metric.m1, metric.fmt)}</span>{' '}mês anterior
        </div>
      )}
    </div>
  );
}
// ============================================================
// CHANNEL TABLE — análise de aquisição por canal
//   ROAS = FTD R$ / Investimento · CAC = Investimento / FTD qtd · Ticket = FTD R$ / FTD qtd
// ============================================================

function ChannelTable({ channels, bp }) {
  // Totais pra linha de rodapé
  const tot = channels.reduce((a, c) => ({
    spend: a.spend + (c.spend || 0),
    ftdQty: a.ftdQty + (c.ftdQty || 0),
    ftdAmount: a.ftdAmount + (c.ftdAmount || 0),
    depD0: a.depD0 + (c.depD0 || 0),
  }), { spend: 0, ftdQty: 0, ftdAmount: 0, depD0: 0 });

  // Canais sem mídia (spend null) não têm ROAS/CAC — mostram "—"
  const roas = (c) => (c.spend != null && c.spend > 0 ? c.ftdAmount / c.spend : null);
  const roasD0 = (c) => (c.spend != null && c.spend > 0 && c.depD0 != null ? c.depD0 / c.spend : null);
  const cac = (c) => (c.spend != null && c.ftdQty > 0 ? c.spend / c.ftdQty : null);
  const ticket = (c) => (c.ftdQty > 0 ? c.ftdAmount / c.ftdQty : null);

  // BP por canal (do plano): ROAS FTD = ftdAmount/invest · ROAS D0 = depD0/invest · CAC = invest/ftd.
  const byCh = (bp && bp.byChannel) || {};
  const bpRoasFtd = (ch) => { const b = byCh[ch]; return (b && b.invest > 0) ? b.ftdAmount / b.invest : null; };
  const bpRoasD0  = (ch) => { const b = byCh[ch]; return (b && b.invest > 0 && b.depD0 != null) ? b.depD0 / b.invest : null; };
  const bpCac     = (ch) => { const b = byCh[ch]; return (b && b.ftd > 0) ? b.invest / b.ftd : null; };
  // BP do Total = soma dos canais visíveis (acompanha o filtro de canal).
  const bpTot = channels.reduce((a, c) => { const b = byCh[c.channel]; if (b) { a.invest += b.invest || 0; a.ftdAmount += b.ftdAmount || 0; a.depD0 += b.depD0 || 0; a.ftd += b.ftd || 0; } return a; }, { invest: 0, ftdAmount: 0, depD0: 0, ftd: 0 });

  // Célula colorida vs BP pela regra de 3 faixas do rodapé (≥95% verde · 85–94% amarelo · <85% vermelho).
  // Atingimento: ROAS (maior=melhor) = act/BP; CAC (menor=melhor) = BP/act (invertido). Sem BP → sem cor.
  const cmpCell = (act, bpv, fmt, higherBetter) => {
    if (act == null || isNaN(act)) return <td>—</td>;
    let cls = '';
    if (bpv != null && isFinite(bpv) && bpv > 0) {
      const pct = higherBetter ? act / bpv : bpv / act;
      cls = 'ch-band-' + farolFromPct(pct);
    }
    return <td className={cls}>{fmt === 'brl' ? fmtBRL(act) : fmtMultiple(act)}</td>;
  };

  return (
    <div className="table-scroll"><table className="ch-table">
      <thead>
        <tr>
          <th>Canal</th>
          <th>Investimento</th>
          <th>FTD (R$)</th>
          <th>FTD (qtd)</th>
          <th>ROAS FTD</th>
          <th>ROAS D0</th>
          <th>CAC</th>
          <th>Ticket Médio</th>
        </tr>
      </thead>
      <tbody>
        {channels.map((c, i) => (
          <tr key={i}>
            <td className="ch-name">{c.channel}</td>
            <td>{fmtBRL(c.spend)}</td>
            <td>{fmtBRL(c.ftdAmount)}</td>
            <td>{fmtQty(c.ftdQty)}</td>
            {cmpCell(roas(c), bpRoasFtd(c.channel), 'multiple', true)}
            {cmpCell(roasD0(c), bpRoasD0(c.channel), 'multiple', true)}
            {cmpCell(cac(c), bpCac(c.channel), 'brl', false)}
            <td>{fmtBRL(ticket(c))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td>{fmtBRL(tot.spend)}</td>
          <td>{fmtBRL(tot.ftdAmount)}</td>
          <td>{fmtQty(tot.ftdQty)}</td>
          {cmpCell(tot.spend > 0 ? tot.ftdAmount / tot.spend : null, bpTot.invest > 0 ? bpTot.ftdAmount / bpTot.invest : null, 'multiple', true)}
          {cmpCell(tot.spend > 0 ? tot.depD0 / tot.spend : null, bpTot.invest > 0 ? bpTot.depD0 / bpTot.invest : null, 'multiple', true)}
          {cmpCell(tot.ftdQty > 0 ? tot.spend / tot.ftdQty : null, bpTot.ftd > 0 ? bpTot.invest / bpTot.ftd : null, 'brl', false)}
          <td>{fmtBRL(tot.ftdQty > 0 ? tot.ftdAmount / tot.ftdQty : null)}</td>
        </tr>
      </tfoot>
    </table></div>
  );
}

// ============================================================
// GGR CHANNEL TABLE — GGR, ROAS GGR e FreeSpins por canal
//   ROAS GGR = GGR ÷ Investimento
// ============================================================

function GgrChannelTable({ channels, payback }) {
  const tot = channels.reduce((a, c) => ({
    ggr: a.ggr + (c.ggr || 0),
    bonus: a.bonus + (c.bonus || 0),
    spend: a.spend + (c.spend || 0),
    freespin: a.freespin + (c.freespin || 0),
    hasFreespin: a.hasFreespin || c.freespin != null,
  }), { ggr: 0, bonus: 0, spend: 0, freespin: 0, hasFreespin: false });

  const roasGgr = (c) => (c.spend != null && c.spend > 0 && c.ggr != null ? c.ggr / c.spend : null);
  const ngrOf = (c) => (c.ggr != null ? c.ggr - (c.bonus || 0) : null);
  const roasCell = (r) => {
    if (r == null) return <td>—</td>;
    return <td className={r >= 1 ? 'ch-roas-pos' : 'ch-roas-neg'}>{fmtMultiple(r)}</td>;
  };
  const ggrCell = (v) => (
    <td className={v != null && v < 0 ? 'ch-roas-neg' : ''}>{fmtBRL(v)}</td>
  );

  // Payback de GGR (safras maduras, horizonte H). p = { paybackDays, reached } por canal.
  const H = (payback && payback.horizonDays) || 90;
  const byCh = (payback && payback.byChannel) || {};
  const paybackCell = (p) => {
    if (!p || p.spend == null) return <td title="Canal sem investimento — payback não se aplica">—</td>;
    if (p.paybackDays == null) return <td className="ch-roas-neg" title={`Não atingiu o payback em ${H} dias`}>{`>${H}d`}</td>;
    return <td className="ch-roas-pos">{`${p.paybackDays}d`}</td>;
  };

  return (
    <div className="table-scroll"><table className="ch-table">
      <thead>
        <tr>
          <th>Canal</th>
          <th>GGR</th>
          <th>NGR</th>
          <th>Investimento</th>
          <th>ROAS GGR</th>
          <th>Payback GGR</th>
          <th>FreeSpins</th>
        </tr>
      </thead>
      <tbody>
        {channels.map((c, i) => (
          <tr key={i}>
            <td className="ch-name">{c.channel}</td>
            {ggrCell(c.ggr)}
            {ggrCell(ngrOf(c))}
            <td>{fmtBRL(c.spend)}</td>
            {roasCell(roasGgr(c))}
            {paybackCell(byCh[c.channel])}
            <td>{fmtBRL(c.freespin)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          {ggrCell(tot.ggr)}
          {ggrCell(tot.ggr - tot.bonus)}
          <td>{fmtBRL(tot.spend)}</td>
          {roasCell(tot.spend > 0 ? tot.ggr / tot.spend : null)}
          {paybackCell(payback && payback.total)}
          <td>{tot.hasFreespin ? fmtBRL(tot.freespin) : '—'}</td>
        </tr>
      </tfoot>
    </table></div>
  );
}

// ============================================================
// TABS — 3 KPIs hero + viz de apoio
// ============================================================

// ============================================================
// FTD BRIDGE — waterfall de variância BP → Realizado por canal
//   Start = Σ BP.ftdAmount (canais com plano) · cada degrau = (Realizado − BP) do canal
//   Canais sem BP (orgânico/afiliados/social) viram um balde "Outros (s/ BP)".
//   End = Σ Realizado.ftdAmount (bate com o total da tabela por canal).
// ============================================================
function FtdBridge({ channels, bp }) {
  const [axis, setAxis] = React.useState('zero');   // 'zero' = baseline no zero (proporção real) · 'zoom' = amplia os degraus
  const byCh = (bp && bp.byChannel) || {};
  let bpTotal = 0, actTotal = 0, noBpAct = 0;
  const steps = [];
  channels.forEach(c => {
    const act = c.ftdAmount || 0;
    actTotal += act;
    const b = byCh[c.channel];
    if (b && b.ftdAmount != null && b.ftdAmount > 0) {
      bpTotal += b.ftdAmount;
      steps.push({ name: c.channel, delta: act - b.ftdAmount });
    } else {
      noBpAct += act;
    }
  });
  steps.sort((a, b) => b.delta - a.delta);   // maiores ganhos → maiores quedas
  const hasBucket = noBpAct > 0;
  if (hasBucket) steps.push({ name: 'Outros (s/ BP)', delta: noBpAct, bucket: true });

  // Sem BP por canal no escopo → não há plano pra fazer a ponte.
  if (bpTotal <= 0) {
    return <div className="ch-note">Ponte indisponível — não há BP por canal neste escopo (o plano cobre só os canais Growth). Selecione <strong>“Canais Growth”</strong> ou um canal com plano de mídia.</div>;
  }

  // Barras: BP (do zero) → degraus flutuantes → Realizado (do zero).
  const bars = [{ kind: 'bp', name: 'BP (plano)', value: bpTotal, endLevel: bpTotal, lo: 0, hi: bpTotal }];
  let run = bpTotal;
  steps.forEach(s => { const next = run + s.delta; bars.push({ kind: 'step', name: s.name, delta: s.delta, bucket: s.bucket, lo: Math.min(run, next), hi: Math.max(run, next), endLevel: next }); run = next; });
  bars.push({ kind: 'act', name: 'Realizado', value: actTotal, endLevel: actTotal, lo: 0, hi: actTotal });

  // Escala vertical: 'zero' = baseline no zero (proporção real) · 'zoom' = amplia a faixa dos degraus.
  const endLevels = bars.map(b => b.endLevel);
  let domMin, domMax;
  if (axis === 'zoom') {
    const lo = Math.min.apply(null, endLevels), hi = Math.max.apply(null, endLevels);
    const pad = Math.max((hi - lo) * 0.16, hi * 0.015);   // piso de folga p/ não estourar quando a variância é ínfima
    domMin = lo - pad; domMax = hi + pad;
  } else {
    const allLevels = bars.map(b => b.hi).concat(bars.map(b => b.lo)).concat([0]);
    domMin = Math.min(0, Math.min.apply(null, allLevels));
    domMax = Math.max.apply(null, allLevels) * 1.14;
  }
  const PH = 240, topPad = 44, botPad = 72, slotW = 108, barW = 60;
  const W = bars.length * slotW, H = PH + topPad + botPad;
  const yName = topPad + PH + 24;
  const y = (v) => topPad + (1 - (v - domMin) / (domMax - domMin)) * PH;
  const cx = (i) => i * slotW + slotW / 2;

  const fmtDelta = (n) => (n > 0 ? '+' : '') + fmtBRL(n);
  const colorOf = (b) => {
    if (b.kind === 'bp') return { fill: 'rgba(136,136,136,.16)', stroke: 'var(--text-muted)' };
    if (b.kind === 'act') return { fill: 'rgba(250,204,21,.16)', stroke: 'var(--accent-yellow)' };
    if (b.bucket) return { fill: 'rgba(96,165,250,.18)', stroke: 'var(--accent)' };
    return b.delta >= 0
      ? { fill: 'rgba(74,222,128,.20)', stroke: 'var(--positive)' }
      : { fill: 'rgba(248,113,113,.20)', stroke: 'var(--negative)' };
  };

  const net = actTotal - bpTotal;
  const pct = bpTotal > 0 ? actTotal / bpTotal : null;
  const band = farolFromPct(pct);

  return (
    <React.Fragment>
      <div className="bridge-head">
        <span className="b-act">{fmtBRL(actTotal)}</span>
        <span className="b-bp">vs BP {fmtBRL(bpTotal)}</span>
        <span className={`b-delta ${band}`}>{fmtDelta(net)} · {fmtPct(pct)} do plano</span>
        {hasBucket && <span className="b-extra">inclui {fmtBRL(noBpAct)} de canais sem plano (orgânico/afiliados/social)</span>}
        <span className="bridge-toggle">
          <button className={axis === 'zero' ? 'active' : ''} onClick={() => setAxis('zero')} title="Eixo começa no zero — proporção real entre as barras">Zero</button>
          <button className={axis === 'zoom' ? 'active' : ''} onClick={() => setAxis('zoom')} title="Amplia os degraus — eixo não começa no zero">Zoom</button>
        </span>
      </div>
      <div className="table-scroll">
        <svg className="bridge-svg" viewBox={`0 0 ${W} ${H}`} width={W} style={{ width: '100%', maxWidth: W, minWidth: Math.min(W, 560), height: 'auto', display: 'block', margin: '0 auto' }} preserveAspectRatio="xMidYMid meet">
          {/* linha de referência do plano (BP) */}
          <line x1={0} x2={W} y1={y(bpTotal)} y2={y(bpTotal)} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 4" />
          <text x={W - 4} y={y(bpTotal) - 5} textAnchor="end" fontSize="9.5" fill="var(--text-dim)">plano</text>
          {/* conectores entre o nível corrente de cada barra */}
          {bars.slice(0, -1).map((b, i) => (
            <line key={`c${i}`} x1={cx(i) + barW / 2} x2={cx(i + 1) - barW / 2} y1={y(b.endLevel)} y2={y(b.endLevel)} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 3" />
          ))}
          {/* baseline zero (modo zero) · nota de eixo deslocado (modo zoom) */}
          {axis === 'zero'
            ? <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" />
            : <text x={2} y={topPad + PH + 46} fontSize="10.5" fill="var(--text-dim)">eixo inicia em {fmtBRL(domMin)} — degraus ampliados</text>}
          {/* barras + rótulos */}
          {bars.map((b, i) => {
            const col = colorOf(b);
            // degraus ocupam [lo,hi]; totais (BP/Realizado) descem até o piso do eixo (zero ou domMin no zoom)
            const top = y(b.hi), h = Math.max(2, (b.kind === 'step' ? y(b.lo) : y(domMin)) - y(b.hi));
            const isTotal = b.kind === 'bp' || b.kind === 'act';
            const labelVal = isTotal ? fmtBRL(b.value) : fmtDelta(b.delta);
            return (
              <g key={i}>
                <rect x={cx(i) - barW / 2} y={top} width={barW} height={h} rx="2" fill={col.fill} stroke={col.stroke} strokeWidth="1.5" />
                <text x={cx(i)} y={top - 8} textAnchor="middle" fontSize="11" fontWeight={isTotal ? 700 : 600} fill={isTotal ? 'var(--text)' : col.stroke}>{labelVal}</text>
                <text x={cx(i)} y={yName} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{b.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="ch-note">
        <strong>Ponte de variância FTD (R$):</strong> parte do <strong>BP</strong> (FTD planejado, somado nos canais com plano de mídia) e acumula a diferença <strong>Realizado − BP</strong> de cada canal até o <strong>Realizado</strong>. Verde = acima do plano · vermelho = abaixo.
        {hasBucket && <> O balde <strong>“Outros (s/ BP)”</strong> reúne canais sem plano de mídia (orgânico, afiliados, social) — entram pelo valor cheio por não terem BP; troque o filtro para <strong>“Canais Growth”</strong> para a ponte pura de mídia paga.</>}
        {' '}Acompanha o filtro de canal e bate com o total da tabela abaixo.
      </div>
    </React.Fragment>
  );
}
// Deriva GGR/NGR por canal para UMA vertical (casino|sportsbook). Casino sai líquido de
// freespin (mecânica de casino). Bônus NÃO vem por vertical no BQ → RATEADO pró-rata pela
// participação positiva da vertical no GGR do canal → casino + sportsbook = NGR do canal.
function ggrByVertical_(channels, vertical) {
  return (channels || []).map(c => {
    const casino  = (c.ggrCasino  || 0) - (c.freespin || 0);
    const sports  = (c.ggrEsporte || 0);
    const lottery = (c.ggrLoteria || 0);
    const wSum = Math.max(0, casino) + Math.max(0, sports) + Math.max(0, lottery);
    const wV   = Math.max(0, vertical === 'casino' ? casino : sports);
    const share = wSum > 0 ? wV / wSum : (vertical === 'casino' ? 1 : 0); // fallback: bônus no casino
    const vggr = vertical === 'casino' ? casino : sports;
    return { ...c, ggr: vggr, bonus: (c.bonus || 0) * share, freespin: vertical === 'casino' ? c.freespin : null };
  });
}

// Gráfico de TENDÊNCIA de ROAS GGR por canal (aba GGR · Acumulado YTD). Mesmo visual do RetMultChart
// (grid preto, 1 linha por canal, data labels, tooltip alto contraste). ROAS = GGR ÷ investimento.
// Toggle Acumulado (Σ GGR ÷ Σ invest desde abril) / Semanal (GGR da semana ÷ invest da semana).
function GgrRoasChart({ series, weeks, channelOrder }) {
  const [mode, setMode] = usePersistedState('rvops:ggrRoasMode', 'acum');   // 'acum' | 'sem'
  const [hover, setHover] = React.useState(null);
  const dmLabel = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? `${m[3]}/${m[2]}` : String(s); };
  const byCh = {};
  (series || []).forEach(r => { (byCh[r.channel] || (byCh[r.channel] = {}))[r.week] = { ggr: r.ggr || 0, invest: r.invest || 0 }; });
  const xLabels = (weeks || []).map(dmLabel);
  const chartSeries = (channelOrder || []).map((ch, idx) => {
    const wk = byCh[ch] || {};
    let cg = 0, ci = 0;
    const values = (weeks || []).map(w => {
      const d = wk[w] || { ggr: 0, invest: 0 };
      if (mode === 'acum') { cg += d.ggr; ci += d.invest; return ci > 0 ? cg / ci : null; }
      return d.invest > 0 ? d.ggr / d.invest : null;
    });
    return { name: ch, color: RET_SERIES_COLORS[idx % RET_SERIES_COLORS.length], values };
  }).filter(s => s.values.some(v => v != null && !isNaN(v)));

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '10px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ROAS</label>
        <div className="slicer-presets">
          <button className={`preset-btn ${mode === 'acum' ? 'active' : ''}`} onClick={() => setMode('acum')} title="ROAS acumulado: Σ GGR ÷ Σ investimento desde abril até a semana (converge p/ o ROAS YTD).">Acumulado</button>
          <button className={`preset-btn ${mode === 'sem' ? 'active' : ''}`} onClick={() => setMode('sem')} title="ROAS da semana: GGR da semana ÷ investimento da semana.">Semanal</button>
        </div>
      </span>
    </div>
  );
  if (!chartSeries.length || !xLabels.length) return <React.Fragment>{controls}<div className="ch-note">Sem dados de ROAS p/ este recorte (canais sem investimento rastreado).</div></React.Fragment>;

  const n = xLabels.length;
  const slotW = n > 20 ? 72 : n > 10 ? 118 : 210;
  const padL = 60, padR = 30, padT = 32, padB = 60, plotH = 600;
  const W = Math.max(1500, padL + padR + (n === 1 ? slotW : (n - 1) * slotW));
  const H = padT + plotH + padB;
  const plotW = W - padL - padR;
  const xOf = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const allVals = chartSeries.flatMap(s => s.values).filter(v => v != null && !isNaN(v));
  const yMaxRaw = allVals.length ? Math.max.apply(null, allVals) : 1;
  const yMinRaw = allVals.length ? Math.min.apply(null, allVals) : 0;
  const sortedV = allVals.slice().sort((a, b) => a - b);
  const p95 = sortedV.length ? sortedV[Math.min(sortedV.length - 1, Math.round(0.95 * (sortedV.length - 1)))] : 1;
  const yMaxEff = (p95 > 0 && yMaxRaw > p95 * 1.5) ? p95 : yMaxRaw;
  const ySpan = Math.max(yMaxEff - Math.min(yMinRaw, 0), 0.3);
  const yPad = ySpan * 0.18;
  const domMin = Math.min(yMinRaw - yPad, 0);
  const domMax = Math.max(yMaxEff + yPad, domMin + 0.2);
  const yClamp = (v) => Math.max(domMin, Math.min(domMax, v));
  const yOf = (v) => padT + (1 - (yClamp(v) - domMin) / ((domMax - domMin) || 1)) * plotH;
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => domMin + (domMax - domMin) * i / ticks);
  const lblEvery = Math.ceil(n / 12);
  const single = chartSeries.length === 1;
  const nonNull = chartSeries.reduce((a, s) => a + s.values.filter(v => v != null && !isNaN(v)).length, 0) || 1;
  const labelStride = Math.max(1, Math.ceil(nonNull / (single ? 45 : 42)));
  const dataLblSize = single ? 16 : 12;
  const linePath = (vals) => { let d = '', pen = false; vals.forEach((v, i) => { if (v == null || isNaN(v)) { pen = false; return; } d += (pen ? ' L' : ' M') + xOf(i).toFixed(1) + ',' + yOf(v).toFixed(1); pen = true; }); return d.trim(); };
  const yTitle = mode === 'acum' ? 'ROAS GGR acum. (Σ/Σ)' : 'ROAS GGR semanal';
  return (
    <React.Fragment>
      {controls}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', margin: '2px 0 8px' }}>
        {chartSeries.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ width: '12px', height: '3px', background: s.color, borderRadius: '2px', display: 'inline-block' }} />{s.name}
          </span>
        ))}
      </div>
      <div className="table-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ width: '100%', maxWidth: W, minWidth: Math.min(W, 700), height: 'auto', display: 'block', margin: '0 auto' }} preserveAspectRatio="xMidYMid meet">
          {gridVals.map((v, i) => (
            <g key={`g${i}`}>
              <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '2 4'} />
              <text x={padL - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#cfcfcf">{fmtMultiple(v)}</text>
            </g>
          ))}
          {xLabels.map((lb, i) => (i % lblEvery === 0) ? <text key={`x${i}`} x={xOf(i)} y={padT + plotH + 18} textAnchor="middle" fontSize="10.5" fill="#cfcfcf">{lb}</text> : null)}
          <text x={4} y={14} fontSize="10" fill="#aaaaaa">{yTitle}</text>
          {chartSeries.map((s, si) => (
            <g key={`s${si}`}>
              <path d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (v != null && !isNaN(v)) ? (
                <g key={i}>
                  <circle cx={xOf(i)} cy={yOf(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="1.8" />
                  {(i % labelStride === 0) && <text x={xOf(i)} y={yOf(v) - (single ? 13 : 10)} textAnchor="middle" fontSize={dataLblSize} fontWeight="700" fill={s.color}>{fmtMultiple(v)}</text>}
                  <circle cx={xOf(i)} cy={yOf(v)} r="14" fill="transparent" style={{ cursor: 'pointer', pointerEvents: 'all' }} onMouseEnter={() => setHover({ si, i })} onMouseLeave={() => setHover(null)} />
                </g>
              ) : null)}
            </g>
          ))}
          {hover && chartSeries[hover.si] && chartSeries[hover.si].values[hover.i] != null && !isNaN(chartSeries[hover.si].values[hover.i]) && (() => {
            const s = chartSeries[hover.si], v = s.values[hover.i], cx = xOf(hover.i), cy = yOf(v);
            const l1 = `${s.name} · ROAS GGR`, l2 = `Semana de ${xLabels[hover.i]} · ${fmtMultiple(v)}`;
            const bw = Math.max(l1.length, l2.length) * 9 + 32, bh = 64;
            let tx = Math.max(padL, Math.min(cx - bw / 2, W - padR - bw));
            let ty = cy - bh - 18; if (ty < padT) ty = cy + 20;
            return (
              <g pointerEvents="none">
                <circle cx={cx} cy={cy} r="6.5" fill={s.color} stroke="#000000" strokeWidth="2.5" />
                <rect x={tx} y={ty} width={bw} height={bh} rx="9" fill="#000000" fillOpacity="1" stroke={s.color} strokeWidth="2.5" />
                <text x={tx + 15} y={ty + 27} fontSize="17" fontWeight="700" fill="#ffffff">{l1}</text>
                <text x={tx + 15} y={ty + 49} fontSize="15" fill="#f2f2f2">{l2}</text>
              </g>
            );
          })()}
        </svg>
      </div>
    </React.Fragment>
  );
}

function TabGgr({ M, ggrChannels, ggrSafra, ggrSafraRoas, ggrPayback, chFilter }) {
  const H = (ggrPayback && ggrPayback.horizonDays) || 90;
  const [ggrViewRaw, setGgrView] = usePersistedState('rvops:ggrView', 'total');
  const ggrView = (ggrViewRaw === 'casino' || ggrViewRaw === 'sportsbook') ? ggrViewRaw : 'total';
  // Toggle de SAFRA (idade de coorte). 'todas' = consolidado; senão filtra a aba pro bucket.
  const [safra, setSafra] = usePersistedState('rvops:ggrSafra', 'todas');
  const SAFRAS = [{ id: 'todas', label: 'Todas' }, { id: 'm0', label: 'M0' }, { id: 'm1', label: 'M1' }, { id: 'm2', label: 'M2' }, { id: 'm3plus', label: 'M3+' }, { id: 'ytd', label: 'Acumulado YTD' }];
  const hasSafra = !!(ggrSafra && ggrSafra.m0);
  const ytdActive = safra === 'ytd';
  const safraActive = hasSafra && safra !== 'todas' && !ytdActive;
  // YTD acumulado (abril→agora): fetch próprio do endpoint leve only=ggrytd (independe do slicer de data;
  // o filtro de CANAL é aplicado client-side, igual ao resto do app). Só busca quando a aba YTD está ativa.
  const [ytdState, setYtdState] = React.useState({ data: null, loading: false, error: null });
  React.useEffect(() => {
    if (!ytdActive || !ENDPOINT_URL) return;
    setYtdState(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&only=ggrytd`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setYtdState({ data: j, loading: false, error: null }); })
      .catch(e => setYtdState({ data: null, loading: false, error: String(e.message || e) }));
  }, [ytdActive]);
  const ytdFiltered = React.useMemo(() => {
    const d = ytdState.data; if (!d) return null;
    const sel = chList_(chFilter || { channels: [], scope: 'all' });
    const allow = sel.length ? (c) => sel.indexOf(c) >= 0
      : ((chFilter && chFilter.scope === 'growth') ? (c) => isGrowthCh_(c) : () => true);
    return { ...d, channels: (d.channels || []).filter(c => allow(c.channel)), series: (d.series || []).filter(r => allow(r.channel)) };
  }, [ytdState.data, chFilter]);
  const yCh = (ytdFiltered && ytdFiltered.channels) || [];
  const yTotInvest = yCh.reduce((a, c) => a + (c.invest || 0), 0);
  const yTotGgr = yCh.reduce((a, c) => a + (c.ggr || 0), 0);
  const yRoas = yTotInvest > 0 ? yTotGgr / yTotInvest : null;
  const safraLabel = (SAFRAS.find(s => s.id === safra) || {}).label || '';
  const safraDesc = { m0: 'M0 (FTD no mês)', m1: 'M1 (FTD há 1 mês)', m2: 'M2 (FTD há 2 meses)', m3plus: 'M3+ (FTD há 3+ meses)' };
  const safraChans = safraActive ? (ggrSafra[safra] || []) : null;
  const safraGgr = safraChans ? safraChans.reduce((a, c) => a + (c.ggr || 0), 0) : null;
  const safraGgrM1 = safraChans ? safraChans.reduce((a, c) => a + (c.ggrM1 || 0), 0) : null;
  // Depósitos por safra (backend manda dep/depM1 por canal) → card GGR/Depósito da safra + vs M-1.
  const safraDep = safraChans ? safraChans.reduce((a, c) => a + (c.dep || 0), 0) : null;
  const safraDepM1 = safraChans ? safraChans.reduce((a, c) => a + (c.depM1 || 0), 0) : null;
  const safraGgrPerDep = (safraGgr != null && safraDep > 0) ? safraGgr / safraDep : null;
  const safraGgrPerDepM1 = (safraGgrM1 != null && safraDepM1 > 0) ? safraGgrM1 / safraDepM1 : null;
  // Close Trend da safra = GGR da safra escalado pro fim do mês com a MESMA razão do total (proj ÷ atual).
  const ggrTrendRatio = (M.ggrTrend && M.ggrTrend.act != null && M.ggr && M.ggr.act) ? M.ggrTrend.act / M.ggr.act : null;
  const safraTrend = (ggrTrendRatio != null && safraGgr != null) ? safraGgr * ggrTrendRatio : null;
  const totalGgr = (M.ggr && M.ggr.act) || null;
  const safraShare = (safraGgr != null && totalGgr) ? safraGgr / totalGgr : null;
  // ROAS de coorte da safra: invest = spend de aquisição da safra · cumGgr = GGR acumulado desde o FTD
  // (cohort view, só coortes com mídia paga rastreada). ROAS = cumGgr ÷ invest.
  const roasChans = (safraActive && ggrSafraRoas) ? (ggrSafraRoas[safra] || []) : null;
  const roasByCh = {}; (roasChans || []).forEach(c => { roasByCh[c.channel] = c; });
  const safraInvest = roasChans ? roasChans.reduce((a, c) => a + (c.invest || 0), 0) : null;
  const safraCumGgr = roasChans ? roasChans.reduce((a, c) => a + (c.cumGgr || 0), 0) : null;
  const safraRoas = (safraInvest > 0 && safraCumGgr != null) ? safraCumGgr / safraInvest : null;

  const hasVert = (ggrChannels || []).some(c => c.ggrCasino != null || c.ggrEsporte != null);
  const vLabel = ggrView === 'casino' ? 'Casino' : 'Sportsbook';
  const tblChannels = (ggrView !== 'total' && hasVert) ? ggrByVertical_(ggrChannels, ggrView) : ggrChannels;
  const vGgr = (tblChannels || []).reduce((a, c) => a + (c.ggr || 0), 0);
  const vcard = (label, val, m1) => ({ act: val, m1: m1 != null ? m1 : null, bp: null, pctBp: null, fmt: 'brl', label });

  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Gestão de GGR</h1>
          <div className="subtitle">Receita bruta, margem e projeção de fechamento</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {hasSafra && (
            <div className="slicer-presets">
              {SAFRAS.map(s => (
                <button key={s.id} className={`preset-btn ${safra === s.id ? 'active' : ''}`} onClick={() => setSafra(s.id)}
                  title={s.id === 'todas' ? 'GGR consolidado (todas as safras).' : s.id === 'ytd' ? 'Investimento e GGR acumulados por canal desde abril (YTD) + tendência de ROAS.' : `Só o GGR da safra ${s.label} (${safraDesc[s.id]}).`}>
                  {(s.id === 'todas' || s.id === 'ytd') ? s.label : 'GGR ' + s.label}
                </button>
              ))}
            </div>
          )}
          {hasVert && !safraActive && !ytdActive && (
            <div className="slicer-presets">
              <button className={`preset-btn ${ggrView === 'total' ? 'active' : ''}`} onClick={() => setGgrView('total')} title="GGR consolidado (= o GGR do painel).">Total</button>
              <button className={`preset-btn ${ggrView === 'casino' ? 'active' : ''}`} onClick={() => setGgrView('casino')} title="Só Casino (líquido de freespin): GGR e NGR por canal só de casino.">Casino</button>
              <button className={`preset-btn ${ggrView === 'sportsbook' ? 'active' : ''}`} onClick={() => setGgrView('sportsbook')} title="Só Sportsbook: GGR e NGR por canal só de esporte.">Sportsbook</button>
            </div>
          )}
        </div>
      </div>
      {ytdActive ? (
        <React.Fragment>
          <div className="hero-grid">
            <Hero metric={{ act: yTotInvest, m1: null, bp: null, pctBp: null, fmt: 'brl', label: 'Investimento YTD' }} />
            <Hero metric={{ act: yTotGgr, m1: null, bp: null, pctBp: null, fmt: 'brl', label: 'GGR YTD' }} />
            <Hero metric={{ act: yRoas, m1: null, bp: null, pctBp: null, fmt: 'multiple', label: 'ROAS GGR YTD' }} />
          </div>
          <div className="support">
            <div className="support-title">Acumulado YTD por Canal{ytdState.data ? ` — desde ${fmtBR_(ytdState.data.from)}` : ''}</div>
            {ytdState.loading ? (
              <div className="ch-note">Carregando do BQ…</div>
            ) : ytdState.error ? (
              <div className="ch-note">Erro ao carregar YTD: {ytdState.error}</div>
            ) : yCh.length === 0 ? (
              <div className="ch-note">Sem dados YTD p/ este recorte.</div>
            ) : (
              <React.Fragment>
                <div className="table-scroll"><table className="ch-table">
                  <thead><tr><th>Canal</th><th>Investimento</th><th>GGR</th><th>ROAS GGR</th><th>% do GGR</th></tr></thead>
                  <tbody>
                    {yCh.map((c, i) => {
                      const roas = c.invest > 0 ? c.ggr / c.invest : null;
                      return (
                        <tr key={i}>
                          <td className="ch-name">{c.channel}</td>
                          <td>{c.invest > 0 ? fmtBRL(c.invest) : '—'}</td>
                          <td>{fmtBRL(c.ggr)}</td>
                          <td>{roas != null ? fmtMultiple(roas) : '—'}</td>
                          <td>{yTotGgr !== 0 ? fmtPct((c.ggr || 0) / yTotGgr) : '—'}</td>
                        </tr>
                      );
                    })}
                    <tr className="ch-total">
                      <td>Total</td>
                      <td>{fmtBRL(yTotInvest)}</td>
                      <td>{fmtBRL(yTotGgr)}</td>
                      <td>{yRoas != null ? fmtMultiple(yRoas) : '—'}</td>
                      <td>100%</td>
                    </tr>
                  </tbody>
                </table></div>
                <div className="support-title" style={{ marginTop: '24px' }}>Tendência de ROAS GGR por Canal</div>
                <GgrRoasChart series={ytdFiltered.series} weeks={(ytdState.data && ytdState.data.weeks) || []} channelOrder={yCh.map(c => c.channel)} />
                <div className="ch-note">
                  <strong>Acumulado YTD</strong> = investimento (spend de mídia) e GGR (= NGR) por canal desde {ytdState.data ? fmtBR_(ytdState.data.from) : 'abr/2026'} até hoje. <strong>ROAS GGR</strong> = GGR ÷ investimento. Segue o filtro de canal do slicer (janela é sempre YTD, independe da data). Canais sem mídia paga rastreada (ex.: Orgânico) aparecem sem investimento e ficam fora do gráfico de ROAS.
                </div>
              </React.Fragment>
            )}
          </div>
        </React.Fragment>
      ) : safraActive ? (
        <React.Fragment>
          <div className="hero-grid">
            <Hero metric={vcard('GGR ' + safraLabel, safraGgr, safraGgrM1)} />
            <Hero metric={{ act: safraGgrPerDep, m1: safraGgrPerDepM1, bp: null, pctBp: null, fmt: 'pct', label: 'GGR / Depósito' }} />
            <Hero metric={{ act: safraTrend, m1: null, bp: null, pctBp: null, fmt: 'brl', label: 'Close Trend GGR' }} />
          </div>
          {safraChans && safraChans.length > 0 && (
            <div className="support">
              <div className="support-title">GGR por Canal — Safra {safraLabel}</div>
              <div className="table-scroll"><table className="ch-table">
                <thead><tr><th>Canal</th><th>GGR</th><th>% do total</th><th>Investimento</th><th>GGR acum.</th><th>ROAS GGR</th></tr></thead>
                <tbody>
                  {safraChans.map((c, i) => {
                    const rc = roasByCh[c.channel];
                    const roas = (rc && rc.invest > 0) ? rc.cumGgr / rc.invest : null;
                    return (
                      <tr key={i}>
                        <td className="ch-name">{c.channel}</td>
                        <td>{fmtBRL(c.ggr)}</td>
                        <td>{safraGgr > 0 ? fmtPct((c.ggr || 0) / safraGgr) : '—'}</td>
                        <td>{rc ? fmtBRL(rc.invest) : '—'}</td>
                        <td>{rc ? fmtBRL(rc.cumGgr) : '—'}</td>
                        <td>{roas != null ? fmtMultiple(roas) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="ch-total">
                    <td>Total</td><td>{fmtBRL(safraGgr)}</td><td>100%</td>
                    <td>{safraInvest != null ? fmtBRL(safraInvest) : '—'}</td>
                    <td>{safraCumGgr != null ? fmtBRL(safraCumGgr) : '—'}</td>
                    <td>{safraRoas != null ? fmtMultiple(safraRoas) : '—'}</td>
                  </tr>
                </tbody>
              </table></div>
              <div className="ch-note">
                <strong>Safra {safraLabel}</strong> = GGR (= NGR do painel) gerado nesta janela por jogadores de idade de coorte {safraDesc[safra]}. A soma M0 + M1 + M2 + M3+ = o GGR <strong>Todas</strong>. O card <strong>GGR {safraLabel}</strong> traz o vs M-1 (mesma safra, mesma janela do mês anterior).
                {roasChans && roasChans.length > 0 && <span> <strong>Investimento</strong> = spend de aquisição da safra ({safra === 'm0' ? 'este mês' : safra === 'm1' ? 'mês passado' : safra === 'm2' ? '2 meses atrás' : '3+ meses atrás'}). <strong>ROAS GGR · coorte</strong> = <strong>GGR acum.</strong> da safra (NGR net acumulado desde o FTD — MESMA base da coluna GGR, por isso o GGR acum. do M0 = o GGR M0) ÷ investimento. Só coortes com mídia paga rastreada (a partir de mar/2026) — por isso o M3+ cobre só as safras pagas, não as orgânicas antigas.</span>}
              </div>
            </div>
          )}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="hero-grid">
            <Hero metric={ggrView === 'total' ? M.ggr : vcard('GGR ' + vLabel, vGgr)} />
            <Hero metric={M.ggrPerDep} />
            <Hero metric={M.ggrTrend} />
          </div>
          {ggrChannels && ggrChannels.length > 0 && (
            <div className="support">
              <div className="support-title">{ggrView === 'total' ? 'GGR por Canal' : `GGR por Canal — ${vLabel}`}</div>
              <GgrChannelTable channels={tblChannels} payback={ggrPayback} />
              <div className="ch-note">
                <strong>NGR</strong> = GGR − bonificações (cash bonus; freespin NÃO é descontado).
                {ggrView !== 'total' && <span> Vertical: Casino = GGR líquido de freespin · Sportsbook = GGR esporte; o bônus (não vem por vertical no BQ) é rateado pró-rata pelo GGR → casino + sportsbook = o NGR total. </span>}
                <strong> Payback GGR</strong> = dias até o GGR (NGR) acumulado da safra cobrir o investimento (safras maduras, FTD há ≥{H} dias, horizonte {H}d).
                <span className="ch-roas-neg">{` >${H}d`}</span> = não atingiu o payback.
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
// ============================================================
// SHELL
// ============================================================
// ============================================================
// SAFRAS DIÁRIAS — tabela de safra de FTD por dia (passagem, D0/D1/W1, retenção)
// ============================================================

// Fundo heatmap de 3 cores (vermelho→amarelo→verde) escalado pelo min/max da coluna —
// igual à formatação condicional do Excel do Luis: piores dias em vermelho, melhores em verde.
function heatBg_(v, min, max) {
  if (v == null || isNaN(v)) return undefined;
  const t = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0.5;
  let r, g, b;
  if (t < 0.5) {                 // vermelho → amarelo
    const k = t / 0.5;
    r = Math.round(224 + (250 - 224) * k);
    g = Math.round(72  + (205 - 72)  * k);
    b = Math.round(72  + (80  - 72)  * k);
  } else {                       // amarelo → verde
    const k = (t - 0.5) / 0.5;
    r = Math.round(250 + (60  - 250) * k);
    g = Math.round(205 + (170 - 205) * k);
    b = Math.round(80  + (95  - 80)  * k);
  }
  return `rgba(${r}, ${g}, ${b}, 0.26)`;
}
// ===== Retenções por faixa de FTD — diária; faixa de valor do FTD + canal = filtros =====
const FAIXA_LIST = ['01. R$0–10','02. R$10–25','03. R$25–50','04. R$50–100','05. R$100+'];
const fxLabel_ = (f) => String(f).replace(/^\d+\.\s*/, '');
// Grupo de risco (backend grupo_risco_atual): '1'..'9' → "Grupo N"; null/'sem grupo' → "Sem grupo".
const grupoLabel_ = (g) => (g == null || g === 'sem grupo') ? 'Sem grupo' : ('Grupo ' + g);
// Opções default do filtro de grupo (os grupos que existem hoje na base + 'sem grupo'); se o dado trouxer outros, o
// componente usa os distintos reais. Fixo p/ o multiselect ter opções antes do fetch byGrupo carregar.
const GRUPO_LIST = ['0','1','2','3','4','5','8','9','sem grupo'];

// Mock (modo dev) — dias 01–11/06 × canais × faixas.
const MOCK_RETENCAO_FAIXA = (() => {
  const out = [], chs = [['Meta', 1], ['Google', 0.7], ['Orgânico (sem atribuição)', 0.5]];
  const tkts = [7, 15, 25, 40, 62, 87, 150, 320];
  for (let d = 1; d <= 11; d++) {
    const date = `2026-06-${String(d).padStart(2, '0')}`;
    const dayF = 0.78 + ((d * 3) % 11) / 22; // varia por dia (~0,78–1,23) só pro mock
    chs.forEach(([canal, w]) => FAIXA_LIST.forEach((faixa, i) => {
      const tkt = tkts[i], qtd = Math.max(1, Math.round((40 - i * 4) * w * dayF)), d0 = qtd * tkt * 1.3;
      const r1 = (0.10 + i * 0.012) * dayF, rw = (0.20 + i * 0.018) * dayF, rm = (0.32 + i * 0.022) * dayF;
      out.push({ date, canal, faixa, qtdFtds: qtd, ftdTotal: qtd * tkt, depD0: d0,
        cntD1: Math.round(qtd * r1), valD1: d0 * r1 * 1.1,
        valD4: d0 * (r1 * 1.1 + rw * 1.15) / 2,   // entre D1 e W1 (dias 1–4)
        valD30: d0 * rm * 1.15,   // janela 1–30d (perto do M0) — mock p/ o gráfico D30
        cntW1: Math.round(qtd * rw), valW1: d0 * rw * 1.15,
        cntM0: Math.round(qtd * rm), valM0: d0 * rm * 1.2, ggrM0: qtd * tkt * (0.25 + i * 0.03) });
    }));
  }
  return out;
})();

// Canais selecionados (array) — aceita o shape novo {channels:[]} e o antigo {channel:'x'}.
function chList_(filter) {
  if (!filter) return [];
  if (Array.isArray(filter.channels)) return filter.channels;
  return filter.channel ? [filter.channel] : [];
}
// Rótulo do escopo: 0 sel = scope · 1-2 = nomes · 3+ = "N canais".
function chLabel_(filter, totalLabel) {
  const sel = chList_(filter);
  if (sel.length === 0) return (filter && filter.scope === 'growth') ? 'Canais Growth' : (totalLabel || 'Total Casa');
  if (sel.length <= 2) return sel.join(' + ');
  return sel.length + ' canais';
}
// Seletor de canal por escopo (canais específicos · growth · total casa).
function chSelector_(filter) {
  const sel = chList_(filter);
  if (sel.length) return (ch) => sel.includes(ch);
  if (filter && filter.scope === 'growth') return (ch) => isGrowthCh_(ch);
  return () => true;
}

// Dropdown multiselect de canais (botão + painel de checkboxes; fecha ao clicar fora).
// selected = array; onChange recebe o novo array. [] = "Todos" (cai no escopo Growth/Total).
function ChannelMultiSelect({ options, selected, onChange, labelOf, allLabel, countNoun }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const lf = labelOf || (x => x);           // rótulo de exibição (default = o próprio valor)
  const allTxt = allLabel || 'Todos';
  const noun = countNoun || 'canais';
  const sel = selected || [];
  const toggle = (ch) => onChange(sel.includes(ch) ? sel.filter(c => c !== ch) : [...sel, ch]);
  const label = sel.length === 0 ? allTxt : (sel.length <= 2 ? sel.map(lf).join(', ') : sel.length + ' ' + noun);
  const optBtn = (on) => ({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: on ? 'rgba(250,204,21,.12)' : 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: '12px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' });
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'var(--surface)', border: '1px solid rgba(250,204,21,.45)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '12px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', maxWidth: '220px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '9px', opacity: .7 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, minWidth: '200px', maxHeight: '320px', overflowY: 'auto', background: 'var(--surface)', border: '1px solid rgba(250,204,21,.45)', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          <button type="button" onClick={() => onChange([])} style={optBtn(sel.length === 0)}>
            <span style={{ width: '14px', flexShrink: 0, color: 'var(--accent-yellow)', textAlign: 'center' }}>{sel.length === 0 ? '✓' : ''}</span>
            <span>{allTxt}</span>
          </button>
          {(options || []).map((ch, i) => {
            const on = sel.includes(ch);
            return (
              <button key={i} type="button" onClick={() => toggle(ch)} style={optBtn(on)}>
                <span style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1px solid ' + (on ? 'var(--accent-yellow)' : 'var(--border)'), background: on ? 'var(--accent-yellow)' : 'transparent', color: '#000', fontSize: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on ? '✓' : ''}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lf(ch)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Início (segunda-feira) da semana ISO de 'YYYY-MM-DD' + rótulo "DD/MM–DD/MM".
function weekStartISO_(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));   // recua até segunda
  return dt.toISOString().slice(0, 10);
}
function weekLabel_(startIso) {
  const [y, m, d] = startIso.split('-').map(Number);
  const f = (off) => { const x = new Date(Date.UTC(y, m - 1, d + off)); return String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0'); };
  return f(0) + '–' + f(6);
}
// 'YYYY-MM-DD' + n dias (n pode ser negativo) → 'YYYY-MM-DD' (UTC puro, sem fuso).
function isoAddDays_(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Curva de desenvolvimento de depósito por IDADE: G(idade) = depósito acumulado ÷ valor do FTD, medida
// em coortes MADURAS de maio (FTD ≥30d). Validada: reconstrói o M0 calendário realizado de maio (+1%).
// Usada no "M0 Esperado" = Σ FTD$ × G(runway), runway = dias do FTD até o fim do mês-calendário.
// Por ESCOPO (ticket menor desenvolve mais → Growth fica acima do Total da Casa). Índice = idade 0..30.
const M0_DEV_CURVE = {
  total:  [1.4861, 1.7457, 1.9094, 2.0339, 2.1139, 2.1848, 2.2553, 2.32, 2.384, 2.44, 2.4888, 2.5295, 2.5681, 2.6127, 2.6583, 2.7039, 2.7493, 2.7904, 2.8274, 2.8677, 2.9094, 2.9524, 2.9887, 3.0295, 3.0613, 3.0939, 3.1189, 3.1473, 3.1823, 3.2193, 3.2418],
  growth: [1.6996, 2.0843, 2.3277, 2.5231, 2.6511, 2.7631, 2.882, 2.9865, 3.0726, 3.1528, 3.2249, 3.2877, 3.353, 3.4239, 3.5002, 3.5765, 3.6594, 3.7249, 3.7793, 3.8439, 3.9076, 3.9838, 4.0335, 4.0915, 4.1341, 4.19, 4.2289, 4.2682, 4.3267, 4.3954, 4.4333],
  // Coorte SAME-DAY (FTD no dia do cadastro, DATE(data_cadastro,'America/Sao_Paulo')=data_ref) — maio 01–24.
  // Total desenvolve mais que o calendário (3,45× vs 3,24×); Growth ~igual. Medida igual às de cima + cláusula same-day.
  totalSameday:  [1.529, 1.829, 1.9825, 2.1211, 2.2125, 2.2915, 2.372, 2.4467, 2.5173, 2.5758, 2.6332, 2.6798, 2.7246, 2.7751, 2.8244, 2.8753, 2.9288, 2.9701, 3.0109, 3.0589, 3.1065, 3.1578, 3.1938, 3.236, 3.2669, 3.3016, 3.3281, 3.3556, 3.3948, 3.4326, 3.4544],
  growthSameday: [1.691, 2.0835, 2.2913, 2.4866, 2.6126, 2.7262, 2.8457, 2.9537, 3.0397, 3.1209, 3.1923, 3.255, 3.3207, 3.3929, 3.469, 3.5474, 3.6302, 3.6903, 3.7464, 3.8168, 3.8824, 3.9634, 4.0109, 4.064, 4.1022, 4.1557, 4.1935, 4.2271, 4.284, 4.3452, 4.3782],
};
// Curvas POR CANAL (chave = r.canal da retfaixa, COM acento) — calendário (cal) e same-day (sd). Maio 01–24,
// mesma metodologia das curvas de escopo (somam de volta a Total 3,24× e Growth 4,43× — reconciliado). Kwai
// fica de fora (só 73 FTDs na janela → amostra fraca, cai pro "—"). Atualizar: Downloads/gcurve_bychannel.sql.
const M0_DEV_CURVE_CH = {
  'Meta': { cal: [1.5324, 1.8475, 2.0209, 2.1851, 2.2907, 2.3745, 2.463, 2.562, 2.6298, 2.7044, 2.7805, 2.8406, 2.9018, 2.9637, 3.0278, 3.0735, 3.1345, 3.1967, 3.2576, 3.3223, 3.3923, 3.4767, 3.5246, 3.5888, 3.6268, 3.6915, 3.7321, 3.773, 3.8486, 3.9275, 3.9664], sd: [1.5557, 1.8761, 2.0422, 2.2084, 2.3048, 2.3869, 2.4736, 2.5745, 2.6419, 2.7197, 2.7954, 2.8536, 2.9154, 2.9767, 3.0361, 3.0798, 3.1409, 3.2015, 3.266, 3.3357, 3.4101, 3.4999, 3.5459, 3.6093, 3.6451, 3.71, 3.7526, 3.7874, 3.8619, 3.9403, 3.9758] },
  'Google': { cal: [2.2845, 2.9137, 3.4372, 3.779, 4.0069, 4.1942, 4.4329, 4.5698, 4.7256, 4.8179, 4.8881, 4.9702, 5.053, 5.1525, 5.2741, 5.4051, 5.5222, 5.6159, 5.6725, 5.7631, 5.8226, 5.8993, 5.965, 6.0206, 6.0923, 6.1379, 6.1828, 6.2284, 6.257, 6.3203, 6.3587], sd: [2.1702, 2.8462, 3.2338, 3.5724, 3.8261, 4.0274, 4.2817, 4.4271, 4.5874, 4.6777, 4.7511, 4.8402, 4.9265, 5.0335, 5.1711, 5.3178, 5.4329, 5.5123, 5.5679, 5.6745, 5.7314, 5.8145, 5.8767, 5.9148, 5.9746, 6.0081, 6.0423, 6.0829, 6.1076, 6.1391, 6.1658] },
  'TikTok': { cal: [1.7822, 2.2044, 2.386, 2.535, 2.6424, 2.812, 2.9026, 3.0111, 3.09, 3.211, 3.284, 3.3413, 3.4175, 3.5134, 3.6027, 3.7987, 3.9875, 4.0368, 4.0635, 4.0945, 4.1495, 4.2023, 4.2497, 4.2955, 4.3213, 4.3625, 4.3912, 4.4209, 4.4546, 4.4928, 4.5363], sd: [1.8171, 2.2401, 2.4228, 2.5783, 2.6814, 2.8574, 2.9453, 3.0609, 3.1401, 3.2555, 3.3156, 3.3738, 3.4452, 3.5466, 3.6363, 3.8384, 4.0335, 4.0745, 4.0974, 4.1251, 4.1748, 4.2295, 4.2769, 4.3178, 4.3408, 4.3824, 4.4113, 4.4348, 4.467, 4.4993, 4.5443] },
  'Social Media': { cal: [1.9381, 2.4014, 2.667, 2.8666, 3.0235, 3.0928, 3.1744, 3.2556, 3.3696, 3.4576, 3.5379, 3.5784, 3.6171, 3.6742, 3.7227, 3.7532, 3.7787, 3.8212, 3.8588, 3.8862, 3.9373, 3.9762, 4.015, 4.0996, 4.1421, 4.1758, 4.205, 4.2931, 4.3393, 4.369, 4.3921], sd: [1.8834, 2.3741, 2.6418, 2.8285, 2.9785, 3.0448, 3.1278, 3.2177, 3.3207, 3.4165, 3.4948, 3.5327, 3.5745, 3.6306, 3.6581, 3.6903, 3.713, 3.7505, 3.7776, 3.8084, 3.849, 3.8756, 3.9123, 4.006, 4.0429, 4.0727, 4.0995, 4.1972, 4.238, 4.2603, 4.2799] },
  'Programática': { cal: [1.1616, 1.3107, 1.3633, 1.4136, 1.4337, 1.4746, 1.5218, 1.5463, 1.579, 1.5986, 1.6207, 1.6387, 1.6582, 1.6719, 1.6823, 1.6895, 1.705, 1.7176, 1.7255, 1.7349, 1.7441, 1.7493, 1.7529, 1.7589, 1.7671, 1.7754, 1.7818, 1.7879, 1.7943, 1.8072, 1.8166], sd: [1.1863, 1.2606, 1.3074, 1.3566, 1.3784, 1.413, 1.462, 1.4858, 1.5187, 1.5326, 1.5562, 1.5696, 1.5863, 1.5957, 1.6019, 1.6032, 1.6065, 1.6129, 1.6188, 1.6256, 1.6364, 1.6388, 1.64, 1.641, 1.6469, 1.6528, 1.6582, 1.663, 1.667, 1.6762, 1.6762] },
  'Orgânico (sem atribuição)': { cal: [1.248, 1.3749, 1.4572, 1.5109, 1.5402, 1.575, 1.6017, 1.6295, 1.6686, 1.6997, 1.7244, 1.7459, 1.7609, 1.7809, 1.7992, 1.8194, 1.8339, 1.8534, 1.8751, 1.8953, 1.9166, 1.9309, 1.9553, 1.976, 1.9971, 2.0089, 2.0213, 2.0336, 2.0466, 2.0565, 2.0654], sd: [1.258, 1.4051, 1.4684, 1.5246, 1.5607, 1.5964, 1.6251, 1.6532, 1.6982, 1.721, 1.7565, 1.7833, 1.801, 1.822, 1.8396, 1.8572, 1.877, 1.8942, 1.9171, 1.9384, 1.9634, 1.9796, 2.0003, 2.0198, 2.0401, 2.0509, 2.0625, 2.0705, 2.0862, 2.0955, 2.103] },
};
// Curva aplicável a UMA linha (por r.canal). Canal(is) selecionado(s) → curva do canal (sd|cal por toggle);
// senão a curva do escopo (Total/Growth). Retorna uma FUNÇÃO (canal)→array|null (ou null se nada se aplica).
// Canal sem curva robusta (ex. Kwai) → null naquela linha: some do esperado sem contaminar o resto.
function m0Curve_(chFilter, sameday) {
  const list = chList_(chFilter);
  if (list && list.length) {
    const pick = (canal) => { const c = M0_DEV_CURVE_CH[canal]; return c ? ((sameday && c.sd) ? c.sd : c.cal) : null; };
    return list.some(ch => M0_DEV_CURVE_CH[ch]) ? pick : null;   // nenhum canal selecionado com curva → coluna "—"
  }
  const base = (chFilter && chFilter.scope === 'growth')
    ? (sameday ? M0_DEV_CURVE.growthSameday : M0_DEV_CURVE.growth)
    : (sameday ? M0_DEV_CURVE.totalSameday : M0_DEV_CURVE.total);
  return () => base;
}
// runway = dias do FTD (iso) até o último dia do mês-calendário dele, limitado a 0..30.
function monthEndRunway_(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(0, Math.min(30, lastDay - d));
}
// dias de a até b (b - a).
function isoDiffDays_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
// BIN SEMANAL ANCORADO (definição dos GRÁFICOS, alinhada com o deck semanal — Luis 08/08).
// Em vez da semana-calendário (segunda→domingo), agrupa em blocos de 7 dias terminando na ÂNCORA = o
// último dia com dado MADURO. Motivo: com semana-calendário o ponto mais recente do gráfico para no
// domingo anterior, enquanto a TABELA ao lado já mostra a semana corrente — os dois números divergiam
// sem motivo aparente (foi exatamente o "pq o D0 do gráfico não bate com o da tabela"). Ancorando no
// último dia, o último ponto cobre EXATAMENTE a janela da tabela e os bins não se sobrepõem.
// Retorna o 1º dia do bin (ordena lexicograficamente igual, e weekLabel_ já rotula k..k+6).
// `anchor` nulo → cai na semana-calendário (é o que a TABELA continua usando; não mexer nela).
function weekBinISO_(iso, anchor) {
  if (!anchor) return weekStartISO_(iso);
  const k = Math.floor(isoDiffDays_(String(iso), anchor) / 7);   // 0 = bin que termina na âncora
  return isoAddDays_(anchor, -7 * k - 6);
}

// Agrega retencaoFaixa por DIA ou SEMANA (gran='day'|'week'; canal via chFilter + faixa) no padrão do
// Benchmark (benchMetrics_). SEMANAL re-agrega as bases aditivas e RECALCULA as métricas (não é média
// das %). mode 'qtd'|'val' afeta só as colunas de retenção. ggrM0/m0PerPlayer ficam p/ ROAS GGR e heroes.
// `weekAnchor` (opcional): no gran='week', ancora os bins de 7 dias nesse dia em vez de usar a
// semana-calendário — ver weekBinISO_. Só os GRÁFICOS passam; a tabela segue em semana-calendário.
function aggRetFaixaBench_(retencaoFaixa, chFilter, faixa, mode, gran, gCurve, dataMax, dim, grupoSel, weekAnchor) {
  const rows = benchApostouRows_(retencaoFaixa);
  const selCh = chSelector_(chFilter);
  const faixaArr = Array.isArray(faixa) ? faixa : (faixa && faixa !== 'all' ? [faixa] : []);   // [] = todas
  const selFx = (fx) => faixaArr.length === 0 || faixaArr.includes(fx);
  const grpArr = Array.isArray(grupoSel) ? grupoSel : [];   // [] = todos os grupos (filtro de grupo de risco)
  const selGr = (g) => grpArr.length === 0 || grpArr.indexOf(g || 'sem grupo') >= 0;
  const keys = ['qtd','ftd','d0','cd1','vd1','vd3','vd4','cw1','vw1','cw2','vw2','vd30','cm0','vm0','ggrM0','cstd','cttd','cqtd4','_pass'];
  const zero = () => { const o = {}; keys.forEach(k => o[k] = 0); o._esp = 0; o._espFtd = 0; o._espD0 = 0; o._rwMin = null; o._rwMax = null; return o; };
  const weekly = gran === 'week';
  // Chave de agrupamento da tabela: período (dia/semana · default) OU por canal OU por faixa — toggle
  // "Ver por" na aba, p/ comparação rápida. Métricas re-agregadas das mesmas bases aditivas (não é média das %).
  const groupOf = (r) => dim === 'canal' ? r.canal : dim === 'faixa' ? r.faixa : dim === 'grupo' ? (r.grupo || 'sem grupo') : dim === 'campanha' ? (r.campanha || '(sem campanha)') : (weekly ? weekBinISO_(r.date, weekAnchor) : r.date);
  const labelOf = (k) => dim === 'canal' ? k : dim === 'faixa' ? fxLabel_(k) : dim === 'grupo' ? grupoLabel_(k) : dim === 'campanha' ? k : (weekly ? weekLabel_(k) : k);
  const by = {}, tot = zero();
  rows.forEach(r => {
    if (!selCh(r.canal) || !selFx(r.faixa) || !selGr(r.grupo)) return;
    const b = groupOf(r);
    if (!by[b]) by[b] = zero();
    keys.forEach(k => { by[b][k] += r[k] || 0; tot[k] += r[k] || 0; });
    // M0 ESPERADO (ancorado no realizado): pega o que a coorte JÁ depositou (realized = D0 + M0-até-hoje)
    // e completa só o runway que falta usando a forma da curva: realized × G(runway) ÷ G(idade atual).
    // Em mês fechado idade ≥ runway → vira o próprio realizado. Respeita junho rodar abaixo de maio.
    if (gCurve) {
      const cv = gCurve(r.canal);   // curva da linha: fixa do escopo, ou a do canal (null se o canal não tem curva)
      if (cv) {
        const rw = monthEndRunway_(r.date);
        const age = Math.max(0, Math.min(rw, dataMax ? isoDiffDays_(r.date, dataMax) : rw));
        const realized = (r.d0 || 0) + (r.vm0 || 0);
        const e = (cv[age] > 0) ? realized * cv[rw] / cv[age] : realized;
        by[b]._esp += e; tot._esp += e;
        by[b]._espFtd += (r.ftd || 0); tot._espFtd += (r.ftd || 0);   // FTD$ só das linhas COM curva (denominador do esperado)
        by[b]._espD0 += (r.d0 || 0); tot._espD0 += (r.d0 || 0);       // idem em D0$ — denominador do esperado no toggle "sobre D0"
        [by[b], tot].forEach(o => { o._rwMin = o._rwMin == null ? rw : Math.min(o._rwMin, rw); o._rwMax = o._rwMax == null ? rw : Math.max(o._rwMax, rw); });
      }
    }
  });
  const fin = (b, label, key) => Object.assign(
    { date: label, _key: key || null, ggrM0: b.ggrM0, m0PerPlayer: b.qtd ? (b.d0 + b.vm0) / b.qtd : null,
      m0Esp: (b._espFtd > 0) ? b._esp / b._espFtd : null, m0EspD0: (b._espD0 > 0) ? b._esp / b._espD0 : null,
      m0EspAmt: (b._espFtd > 0) ? b._esp : null, rwMin: b._rwMin, rwMax: b._rwMax },
    benchMetrics_(b, mode));
  // período/faixa: chave ISO/prefixo ordinal ordenam sozinhos · canal: maior FTD$ primeiro (comparação)
  const ks = Object.keys(by).sort((dim === 'canal' || dim === 'campanha') ? (a, b) => (by[b].ftd || 0) - (by[a].ftd || 0) : undefined);
  return { rows: ks.map(k => fin(by[k], labelOf(k), k)), totals: fin(tot, 'Total', null) };
}

// Colunas de multiplicador da Ret. Faixa. base 'ftd' (padrão) = acúmulo (incl. D0) ÷ FTD, começando no D0.
// base 'd0' (toggle da aba) = acúmulo ÷ DEPÓSITO D0: o D0 é a âncora (=1,00x, omitido), então a 1ª coluna é D1/D0.
// base 'd1' = acúmulo ÷ NÍVEL D1 (D0 + dep do dia 1): D0 sai, D1 vira a base (=1,00x). mL = label do M0.
function retMultCols_(base, mL) {
  const M = mL || 'M0';
  if (base === 'd0') return [
    { key: 'd1', label: 'Mult D1/D0', get: r => r.multD1D0, tip: '(D0 + dia 1) ÷ depósito do D0. O D0/D0 (=1,00x) é omitido por ser constante.' },
    { key: 'd3', label: 'Mult D3/D0', get: r => r.multD3D0, tip: '(D0 + dias 1–3) ÷ depósito do D0.' },
    { key: 'd4', label: 'Mult D4/D0', get: r => r.multD4D0, tip: '(D0 + dias 1–4) ÷ depósito do D0.' },
    { key: 'w1', label: 'Mult W1/D0', get: r => r.multW1D0, tip: '(D0 + dias 1–7) ÷ depósito do D0.' },
    { key: 'w2', label: 'Mult W2/D0', get: r => r.multW2D0, tip: '(D0 + dias 1–14) ÷ depósito do D0.' },
    { key: 'm0', label: `Mult ${M}/D0`, get: r => r.multM0D0, tip: `(D0 + ${M}) ÷ depósito do D0.` },
  ];
  if (base === 'd1') return [
    { key: 'd1', label: 'Mult D1/D1', get: r => r.multD1D1, tip: 'Nível D1 (D0 + dep do dia 1) ÷ ele mesmo = 1,00x (âncora da base D1).' },
    { key: 'd3', label: 'Mult D3/D1', get: r => r.multD3D1, tip: '(D0 + dias 1–3) ÷ nível D1.' },
    { key: 'd4', label: 'Mult D4/D1', get: r => r.multD4D1, tip: '(D0 + dias 1–4) ÷ nível D1.' },
    { key: 'w1', label: 'Mult W1/D1', get: r => r.multW1D1, tip: '(D0 + dias 1–7) ÷ nível D1.' },
    { key: 'w2', label: 'Mult W2/D1', get: r => r.multW2D1, tip: '(D0 + dias 1–14) ÷ nível D1.' },
    { key: 'm0', label: `Mult ${M}/D1`, get: r => r.multM0D1, tip: `(D0 + ${M}) ÷ nível D1.` },
  ];
  return [
    { key: 'd0', label: 'Mult D0/FTD', get: r => r.multD0F, tip: 'Dep do D0 ÷ FTD.' },
    { key: 'd1', label: 'Mult D1/FTD', get: r => r.multD1F, tip: '(D0 + dia 1) ÷ FTD.' },
    { key: 'd3', label: 'Mult D3/FTD', get: r => r.multD3F, tip: '(D0 + dias 1–3) ÷ FTD.' },
    { key: 'd4', label: 'Mult D4/FTD', get: r => r.multD4F, tip: '(D0 + dias 1–4) ÷ FTD.' },
    { key: 'w1', label: 'Mult W1/FTD', get: r => r.multW1F, tip: '(D0 + dias 1–7) ÷ FTD.' },
    { key: 'w2', label: 'Mult W2/FTD', get: r => r.multW2F, tip: '(D0 + dias 1–14) ÷ FTD.' },
    { key: 'm0', label: `Mult ${M}/FTD`, get: r => r.multM0F, tip: `(D0 + ${M}) ÷ FTD.` },
  ];
}

function RetFaixaTable({ data, dateLabel, m0Label, base }) {
  const rows = data.rows || [], t = data.totals || {};
  const mL = m0Label || 'M0';
  const multCols = retMultCols_(base, mL);
  // Coluna "M0 Esp." = M0/FTD ESPERADO no fechamento do mês = Σ FTD$ × G(runway) ÷ FTD$ (vem pronto do
  // aggregador em r.m0Esp). G = curva histórica de desenvolvimento por escopo; runway = dias até o fim do
  // mês. null (—) na Coorte 30d ou em canal sem curva robusta (ex. Kwai). Escopo, same-day e por canal: OK.
  // Segue a base do toggle: sobre FTD divide o esperado por Σ FTD$; sobre D0, por Σ D0$ (mesmo numerador).
  const espBase = base === 'd0' ? 'D0' : 'FTD';   // 'd1' não tem esperado próprio → cai no denominador FTD$
  const espOf = (r) => base === 'd0' ? r.m0EspD0 : r.m0Esp;
  const espCell = (r) => {
    const v = espOf(r);
    if (v == null) return <td key="esp" style={{ color: 'var(--text-muted)' }}>—</td>;
    const rw = (r.rwMin != null && r.rwMax != null) ? (r.rwMin === r.rwMax ? `${r.rwMax}` : `${r.rwMax}→${r.rwMin}`) : '—';
    const tip = `M0/${espBase} esperado no fechamento, ancorado no realizado: realizado × G(runway) ÷ G(idade), somado e dividido pelo ${espBase === 'FTD' ? 'FTD$' : 'depósito do D0'}. Runway (dias até o fim do mês) desta linha: ${rw}.`;
    return <td key="esp" style={{ color: 'var(--accent-yellow)', fontWeight: 500 }} title={tip}>{fmtMultiple(v)}</td>;
  };
  const dm = (s) => { if (!s || s === 'Total') return s || '—'; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? `${m[3]}/${m[2]}` : String(s); };
  // Heatmap por coluna (vermelho→amarelo→verde, min/max das linhas) nas retenções —
  // Total (heat=false) mantém o amarelo chapado.
  const range = (key) => { const v = rows.map(x => x[key]).filter(x => x != null && !isNaN(x)); return v.length ? { min: Math.min(...v), max: Math.max(...v) } : { min: 0, max: 1 }; };
  const rD1 = range('retD1'), rW1 = range('retW1'), rW2 = range('retW2'), rM0 = range('retM0');
  // Header sticky: fundo OPACO (tint amarelo composto sobre --surface-2) p/ as linhas não
  // vazarem por baixo do título ao rolar. rgba puro deixava o header transparente.
  const retTh = { background: 'linear-gradient(rgba(250,204,21,0.20),rgba(250,204,21,0.20)), var(--surface-2)' };
  const retThL = { background: 'linear-gradient(rgba(250,204,21,0.20),rgba(250,204,21,0.20)), var(--surface-2)', borderLeft: '2px solid rgba(250,204,21,0.55)' };
  const retCell = (v, rng, heat, left) => {
    const bg = heat ? heatBg_(v, rng.min, rng.max) : 'rgba(250,204,21,0.10)';
    return left ? { background: bg, borderLeft: '2px solid rgba(250,204,21,0.45)' } : { background: bg };
  };
  const cells = (r, heat) => [
    <td key="q">{fmtQty(r.qtd)}</td>,
    <td key="ftd">{fmtBRL(r.ftdMedio)}</td>,
    <td key="d0">{fmtBRL(r.d0Medio)}</td>,
    ...multCols.map(c => <td key={c.key}>{fmtMultiple(c.get(r))}</td>),
    espCell(r),
    <td key="r1" style={retCell(r.retD1, rD1, heat, true)}>{fmtPct(r.retD1, 1)}</td>,
    <td key="rw1" style={retCell(r.retW1, rW1, heat, false)}>{fmtPct(r.retW1, 1)}</td>,
    <td key="rw2" style={retCell(r.retW2, rW2, heat, false)}>{fmtPct(r.retW2, 1)}</td>,
    <td key="rm0" style={retCell(r.retM0, rM0, heat, false)}>{fmtPct(r.retM0, 1)}</td>,
  ];
  // Ordenação client-side por coluna: clique no cabeçalho ordena (1º clique = desc); reclique inverte.
  // sortKey null = ordem que veio do agregador. O Total fica sempre no rodapé (tfoot, fora da ordenação).
  const [sortKey, setSortKey] = React.useState(null);
  const [sortDir, setSortDir] = React.useState('desc');
  const accessors = { date: r => r.date, qtd: r => r.qtd, ftdMedio: r => r.ftdMedio, d0Medio: r => r.d0Medio, m0Esp: espOf, retD1: r => r.retD1, retW1: r => r.retW1, retW2: r => r.retW2, retM0: r => r.retM0 };
  multCols.forEach(c => { accessors[c.key] = c.get; });
  const onSort = (key) => { if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey(key); setSortDir('desc'); } };
  const arrow = (key) => sortKey === key ? (sortDir === 'desc' ? ' ▾' : ' ▴') : '';
  const sortedRows = (!sortKey || !accessors[sortKey]) ? rows : rows.slice().sort((a, b) => {
    const acc = accessors[sortKey], dir = sortDir === 'asc' ? 1 : -1;
    let va = acc(a), vb = acc(b);
    if (sortKey === 'date') { va = String(va || ''); vb = String(vb || ''); return va < vb ? -dir : va > vb ? dir : 0; }
    va = (va == null || isNaN(va)) ? -Infinity : va; vb = (vb == null || isNaN(vb)) ? -Infinity : vb;
    return va < vb ? -dir : va > vb ? dir : 0;
  });
  const Th = (key, label, style, title) => <th key={key} onClick={() => onSort(key)} title={(title ? title + ' · ' : '') + 'clique p/ ordenar'} style={{ ...(style || {}), cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>{label}{arrow(key)}</th>;
  return (
    <div className="table-scroll tall"><table className="ch-table">
      <thead>
        <tr>
          {Th('date', dateLabel || 'Data FTD')}{Th('qtd', 'Qtd FTD')}{Th('ftdMedio', 'FTD $$')}{Th('d0Medio', 'Dep D0 Med')}
          {multCols.map(c => Th(c.key, c.label, null, c.tip))}
          {Th('m0Esp', 'M0 Esp.', null, `M0/${espBase} esperado no fechamento, ancorado no realizado: realizado × G(runway) ÷ G(idade). G = curva histórica de desenvolvimento (maio), por escopo (Total/Growth) e por canal. Canal sem curva robusta (ex. Kwai, amostra pequena) fica —.`)}
          {Th('retD1', 'D1 Ret %', retThL)}{Th('retW1', 'W1 Ret %', retTh)}{Th('retW2', 'W2 Ret %', retTh)}{Th('retM0', mL + ' Ret %', retTh)}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((r, i) => (<tr key={i}><td className="ch-name">{dm(r.date)}</td>{cells(r, true)}</tr>))}
      </tbody>
      <tfoot>
        <tr><td>Total</td>{cells(t, false)}</tr>
      </tfoot>
    </table></div>
  );
}

// Linha de REFERÊNCIA — mês-calendário anterior FECHADO, mesmas colunas/formato da RetFaixaTable
// num único registro agregado. Respeita canal/faixa/modo/same-day (vem do mesmo aggRetFaixaBench_),
// mas SEMPRE M0 = mês-calendário (já maduro), independente do toggle Calendário/Coorte do topo.
function RetFaixaPrevRow({ row, label, loading, error, base }) {
  const retTh = { background: 'linear-gradient(rgba(250,204,21,0.20),rgba(250,204,21,0.20)), var(--surface-2)' };
  const retThL = { ...retTh, borderLeft: '2px solid rgba(250,204,21,0.55)' };
  const flat = { background: 'rgba(250,204,21,0.10)' };
  const flatL = { ...flat, borderLeft: '2px solid rgba(250,204,21,0.45)' };
  const r = row || {};
  const ready = !!row && !loading && !error;
  const multCols = retMultCols_(base, 'M0');
  return (
    <div className="table-scroll"><table className="ch-table">
      <thead>
        <tr>
          <th>Mês</th><th>Qtd FTD</th><th>FTD $$</th><th>Dep D0 Med</th>
          {multCols.map(c => <th key={c.key} title={c.tip}>{c.label}</th>)}
          <th title="Mês fechado — aqui o M0 já é o realizado completo (não há 'esperado').">M0 Esp.</th>
          <th style={retThL}>D1 Ret %</th><th style={retTh}>W1 Ret %</th><th style={retTh}>W2 Ret %</th><th style={retTh}>M0 Ret %</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="ch-name">{label}</td>
          {ready ? [
            <td key="q">{fmtQty(r.qtd)}</td>,
            <td key="ftd">{fmtBRL(r.ftdMedio)}</td>,
            <td key="d0">{fmtBRL(r.d0Medio)}</td>,
            ...multCols.map(c => <td key={c.key}>{fmtMultiple(c.get(r))}</td>),
            <td key="m0p" style={{ color: 'var(--text-muted)' }} title="Mês fechado — M0 já é o realizado completo.">—</td>,
            <td key="r1" style={flatL}>{fmtPct(r.retD1, 1)}</td>,
            <td key="rw1" style={flat}>{fmtPct(r.retW1, 1)}</td>,
            <td key="rw2" style={flat}>{fmtPct(r.retW2, 1)}</td>,
            <td key="rm0" style={flat}>{fmtPct(r.retM0, 1)}</td>,
          ] : <td colSpan={8 + multCols.length} style={{ color: 'var(--text-muted)' }}>{error ? 'erro ao carregar' : (loading ? 'carregando…' : '—')}</td>}
        </tr>
      </tbody>
    </table></div>
  );
}

// Gráfico de linha — X = SEMPRE período (série dos últimos 30 dias corridos). Y = séries dinâmicas: 1 linha
// por multiplicador (D0…D30), OU por canal, OU por faixa (do multiplicador escolhido). Fetch fixo de 30 dias.
const RET_MULT_METRICS = [
  { id: 'D0',  key: 'multD0F',  desc: 'Dep D0 ÷ FTD' },
  { id: 'D1',  key: 'multD1F',  desc: '(D0 + dia 1) ÷ FTD' },
  { id: 'D3',  key: 'multD3F',  desc: '(D0 + dias 1–3) ÷ FTD' },
  { id: 'D7',  key: 'multW1F',  desc: '(D0 + dias 1–7) ÷ FTD' },
  { id: 'D14', key: 'multW2F',  desc: '(D0 + dias 1–14) ÷ FTD' },
  { id: 'D30', key: 'multD30F', desc: '(D0 + dias 1–30) ÷ FTD' },
];
// Mesmas séries na base D0 (toggle da aba). D0 sai da lista: D0/D0 = 1,00x constante, não é série.
const RET_MULT_METRICS_D0 = [
  { id: 'D1',  key: 'multD1D0',  desc: '(D0 + dia 1) ÷ dep D0' },
  { id: 'D3',  key: 'multD3D0',  desc: '(D0 + dias 1–3) ÷ dep D0' },
  { id: 'D7',  key: 'multW1D0',  desc: '(D0 + dias 1–7) ÷ dep D0' },
  { id: 'D14', key: 'multW2D0',  desc: '(D0 + dias 1–14) ÷ dep D0' },
  { id: 'D30', key: 'multD30D0', desc: '(D0 + dias 1–30) ÷ dep D0' },
];
const retChartMetrics_ = (base) => base === 'd0' ? RET_MULT_METRICS_D0 : RET_MULT_METRICS;
const RET_SERIES_COLORS = ['#FF8C00', '#60a5fa', '#4ade80', '#facc15', '#c084fc', '#22d3ee', '#fb7185', '#a3e635'];
// Horizonte de MATURIDADE por multiplicador (dias após o FTD). Nível de módulo porque o cálculo do
// lookback do fetch precisa dele ANTES do corpo do componente chegar no corte de maturidade.
const RET_MAT_H = { D0: 0, D1: 1, D3: 3, D7: 7, D14: 14, D30: 30 };
// Períodos VISÍVEIS no eixo, por granularidade (usado no lookback e no recorte final — tem que ser o mesmo
// número nos dois, senão a busca fica curta e os pontos mais antigos saem com janela deslizante truncada).
const RET_MAX_PERIODS = { week: 8, day: 30 };
function RetMultChart({ chFilter, faixaSel, grupoSel, grupoActive, mode, gran, sameday, dataMax, fallbackRows, cohort, cohortDays, srcRF, srcRFLead, coLo, srcLoading, srcError, base }) {
  const MET = retChartMetrics_(base);            // lista de séries conforme a base do toggle (FTD | D0)
  const bLbl = base === 'd0' ? 'D0' : 'FTD';     // sufixo dos rótulos: Mult D7/FTD vs Mult D7/D0
  const [seriesBy, setSeriesBy] = usePersistedState('rvops:retChartSeries', 'mult'); // 'mult' | 'canal' | 'faixa' | 'grupo' (grupo de risco, pede &byGrupo=1)
  const [metric, setMetric] = usePersistedState('rvops:retChartMetric3', 'D1');   // D0 | D1 | D7 | D14 | D30 — UM multiplicador por vez (sem "Todos")
  const [hover, setHover] = React.useState(null);   // { si, i } do ponto sob o mouse → tooltip custom (SVG nativo era instável)
  const [maDays, setMaDays] = usePersistedState('rvops:retChartMA', 0);   // 0 = off · N = janela da média móvel (dias)
  const [yScale, setYScale] = usePersistedState('rvops:retChartYScale', 'lin');   // 'lin' | 'log' (log espalha grupos que variam de 1x a 10x+)
  // Fonte segue o toggle M0 do topo: COORTE → mesma base/janela da tabela (srcRF, só coortes fechadas);
  // CALENDÁRIO → últimos 30 DIAS CORRIDOS terminando em HOJE-1 (fetch próprio, segue o same-day).
  // Cap SEMPRE em hoje-1 (= todayISO_, regra da tabela): nunca inclui o dia de HOJE (parcial → estragaria a
  // média da semana corrente). Se o dado atrasar (dataMax < ontem), usa dataMax. capTo = min(dataMax, ontem).
  const capTo = dataMax ? (dataMax < todayISO_() ? dataMax : todayISO_()) : todayISO_();
  // UM multiplicador por vez (D0…D30). Coage valor inválido/legado (ex. "Todos" salvo antes) p/ D1.
  // Definido AQUI (e não junto do mDef, lá embaixo) porque o lookback do fetch depende do horizonte dele.
  const effMetric = MET.some(m => m.id === metric) ? metric : 'D1';
  // LOOKBACK DA BUSCA. Era `max(59, maDays + 30)` — curto: com D30 + MM 30d + Semanal (8 semanas) o payload
  // começava em capTo−60 e os pontos ANTIGOS saíam com janela deslizante truncada (7, 14, 21, 28 dias em vez
  // de 30), o que suaviza artificialmente o passado e chegou a APAGAR o vale real de meados de junho. Agora a
  // conta é explícita e cobre os três pedaços que o ponto mais antigo precisa:
  //   maturidade do multiplicador + span visível do eixo + janela da média móvel.
  // No exemplo acima: 30 + 56 + 30 = 116 dias (contra 60). Custa payload; é o preço de a curva ser verdade.
  const spanVisivel = (RET_MAX_PERIODS[gran] || 30) * (gran === 'week' ? 7 : 1);
  const lookback = (RET_MAT_H[effMetric] || 0) + spanVisivel + (maDays || 0);
  const fetchFrom = capTo ? isoAddDays_(capTo, -Math.max(59, lookback)) : null;
  // Quebra por GRUPO DE RISCO: pede &byGrupo=1 (payload com grupo por linha). Como o srcRF da coorte NÃO tem
  // grupo, o modo grupo SEMPRE usa o fetch próprio de calendário (mesmo em coorte) — janela/maturidade de calendário.
  const grpMode = seriesBy === 'grupo' || !!grupoActive;   // precisa do dado byGrupo tanto p/ quebrar quanto p/ FILTRAR por grupo
  const [f30, setF30] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!ENDPOINT_URL || !dataMax || (cohort && !grpMode)) return;   // coorte (não-grupo) usa o srcRF da tabela, sem fetch próprio
    setF30(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${fetchFrom}&to=${capTo}&only=retfaixa${sameday ? '&sameday=1' : ''}${grpMode ? '&byGrupo=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setF30({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setF30({ rows: null, loading: false, error: String(e.message || e) }));
  }, [fetchFrom, dataMax, sameday, cohort, grpMode]);
  // Na coorte com MA ligada, agrega sobre o srcRFLead (janela visível + CO_MA_LEAD dias de histórico ANTES
  // dela) — a janela deslizante precisa desse passado p/ os 1ºs pontos visíveis terem janela CHEIA. Os pontos
  // de lead-in são recortados depois da suavização (`coLo`), então não aparecem no eixo.
  const maWanted = maDays > 0;
  const coLead = (cohort && !grpMode && maWanted && srcRFLead && srcRFLead.length) ? srcRFLead : null;
  const rows30 = (cohort && !grpMode) ? (coLead || srcRF || []) : (f30.rows || (!ENDPOINT_URL ? (fallbackRows || []) : null));
  const busy = (cohort && !grpMode) ? !!srcLoading : f30.loading;
  const err = (cohort && !grpMode) ? srcError : f30.error;
  const dmLabel = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? `${m[3]}/${m[2]}` : String(s); };
  const mDef = MET.find(m => m.id === effMetric) || MET[0];
  // Média móvel EFETIVA. Roda nos DOIS modos: no Calendário sobre a busca de N+30 dias; na Coorte sobre o
  // srcRFLead (janela visível + CO_MA_LEAD dias antes). Só cai pra 0 se o lead-in não veio (backend velho ou
  // fetch da coorte ainda em voo) — aí suavizar sobre a janela fechada daria janela parcial em quase todo
  // ponto, que é suavização falsa.
  // ⚠️ O `effGran` TEM que seguir o maEff, não o maDays: a MA só força resolução diária porque a janela
  // deslizante é em dias. Quando ela NÃO roda, forçar 'day' joga o gráfico pra diário ignorando o toggle
  // Visão=Semanal E sem suavizar nada — a linha vira ruído de safra diária com o botão "Semanal" aceso.
  const maEff = (maDays > 0 && (!cohort || !!coLead)) ? maDays : 0;
  const effGran = maEff > 0 ? 'day' : gran;   // média móvel opera em resolução DIÁRIA (janela deslizante em dias)

  // MATURIDADE no NÍVEL DA COORTE (dia do FTD), não da semana: mantém só FTDs que já fecharam a janela do
  // multiplicador → date <= capTo − horizonte (capTo = ontem, último dia completo; horizonte D0=0·D1=1·D7=7·
  // D14=14·D30=30). Filtrar por DIA (e só depois agregar em semana) faz a SEMANA mais recente aparecer com
  // suas coortes maduras (ex.: semana 06–12/07 entra pelas coortes 06→11/07, sem esperar o domingo 12/07
  // maturar nem arrastar dia imaturo pra média). Só no modo calendário — coorte já traz coortes fechadas.
  const MAT_H = RET_MAT_H;
  const matDay = ((!cohort || grpMode) && dataMax) ? isoAddDays_(capTo, -(MAT_H[effMetric] || 0)) : null;
  const matRows = matDay ? (rows30 || []).filter(r => r && r.date != null && String(r.date) <= matDay) : (rows30 || []);

  // ÂNCORA dos bins semanais e PISO do dado. Ambos saem das MESMAS linhas (matRows), então valem igual p/
  // todas as séries — se cada canal ancorasse no seu próprio último dia, as linhas do gráfico ficariam
  // deslocadas entre si e a comparação seria falsa.
  //  · anchor = último dia MADURO com dado → os bins de 7 dias terminam nele (ver weekBinISO_).
  //  · dataFloor = primeiro dia que o payload realmente trouxe → qualquer janela deslizante que comece
  //    antes dele está TRUNCADA e não pode ser plotada como se fosse cheia.
  let anchor = null, dataFloor = null;
  (matRows || []).forEach(r => {
    if (!r || r.date == null) return;
    const d = String(r.date);
    if (anchor == null || d > anchor) anchor = d;
    if (dataFloor == null || d < dataFloor) dataFloor = d;
  });
  const weekAnchor = gran === 'week' ? anchor : null;

  // Eixo X = período (unificado); séries = 1 por multiplicador OU por canal OU por faixa.
  // isoKeys[i] = chave ISO da coorte no ponto i (dia = data do FTD · semana = 2ª-feira de início) → usada no corte de maturidade.
  let xLabels = [], series = [], isoKeys = [];
  // Peso da média móvel = DENOMINADOR do multiplicador ativo (Σ FTD$ na base FTD · Σ D0$ na base D0).
  // Tem que ser o mesmo denominador da razão: só assim a MA da janela = razão pooled Σacc ÷ Σbase.
  // Com peso de FTD$ numa razão /D0 a MA vira média ponderada com peso errado (viés silencioso).
  const ftdOf = (r) => (r.qtd || 0) * ((base === 'd0' ? r.d0Medio : r.ftdMedio) || 0);
  if (seriesBy === 'mult') {
    const agg = aggRetFaixaBench_(matRows, chFilter, faixaSel, mode, effGran, null, dataMax, null, grupoSel, weekAnchor); // dim = período
    xLabels = agg.rows.map(r => dmLabel(r.date));
    isoKeys = agg.rows.map(r => r._key);
    series = [{ name: 'Mult ' + mDef.id, mid: mDef.id, color: RET_SERIES_COLORS[MET.indexOf(mDef) % RET_SERIES_COLORS.length], values: agg.rows.map(r => r[mDef.key]), ftd: agg.rows.map(ftdOf) }];
  } else {
    // grupos (canais ou faixas) presentes no recorte, cada um agregado por período p/ o multiplicador escolhido
    const groupAgg = aggRetFaixaBench_(matRows, chFilter, faixaSel, mode, 'day', null, dataMax, seriesBy, grupoSel, weekAnchor);
    const groups = groupAgg.rows.map(r => ({ key: r._key, label: r.date }));
    const perGroup = groups.map(g => {
      const sub = seriesBy === 'canal'
        ? aggRetFaixaBench_(matRows, { ...chFilter, channels: [g.key] }, faixaSel, mode, effGran, null, dataMax, null, grupoSel, weekAnchor)
        : seriesBy === 'grupo'
        ? aggRetFaixaBench_((matRows || []).filter(r => (r.grupo || 'sem grupo') === g.key), chFilter, faixaSel, mode, effGran, null, dataMax, null, null, weekAnchor)
        : aggRetFaixaBench_(matRows, chFilter, [g.key], mode, effGran, null, dataMax, null, grupoSel, weekAnchor);
      const m = {}; sub.rows.forEach(r => { m[r._key] = { y: r[mDef.key], f: ftdOf(r), label: r.date }; });
      return { g, m };
    });
    const labelByKey = {}; perGroup.forEach(pg => Object.keys(pg.m).forEach(k => { labelByKey[k] = pg.m[k].label; }));
    const keys = Object.keys(labelByKey).sort();
    xLabels = keys.map(k => dmLabel(labelByKey[k]));   // dia ISO → dd/mm (igual ao modo mult); rótulo de semana passa direto
    isoKeys = keys;
    series = perGroup.map((pg, i) => ({ name: pg.g.label, mid: effMetric, color: RET_SERIES_COLORS[i % RET_SERIES_COLORS.length], values: keys.map(k => pg.m[k] ? pg.m[k].y : null), ftd: keys.map(k => pg.m[k] ? pg.m[k].f : 0) }));
  }
  // MÉDIA MÓVEL (só calendário): substitui cada ponto do dia d pela razão PONDERADA na janela deslizante
  // [d−N+1, d] = Σ(mult×ftd) ÷ Σftd — NÃO é média das razões diárias (que distorce em dia de baixo volume).
  // A MA é sempre calculada em DIAS (effGran='day'); o EIXO X segue o toggle: se Semanal, colapsa depois em
  // semanas (cada semana = valor da MA no ÚLTIMO dia dela). Aplica ANTES do recorte (usa o histórico de N+30 dias).
  if (maEff > 0) {
    series = series.map(s => {
      const nv = isoKeys.map((k, i) => {
        if (k == null) return null;
        const lo = isoAddDays_(k, -(maEff - 1));
        // JANELA CHEIA OBRIGATÓRIA: se a janela começa antes do 1º dia que o payload trouxe, ela está
        // TRUNCADA — a média sairia sobre menos dias do que o rótulo promete. Antes esses pontos eram
        // plotados como se fossem MM completa, o que suavizava o passado e escondia quedas reais.
        // Com o lookback corrigido acima nenhum ponto VISÍVEL deve cair aqui; isto é a rede de segurança.
        if (dataFloor && lo < dataFloor) return null;
        let num = 0, den = 0, any = false;
        for (let j = i; j >= 0 && isoKeys[j] != null && isoKeys[j] >= lo; j--) {
          const v = s.values[j], f = s.ftd ? s.ftd[j] : 0;
          if (v != null && !isNaN(v) && f > 0) { num += v * f; den += f; any = true; }
        }
        return (any && den > 0) ? num / den : null;
      });
      return { ...s, values: nv };
    });
    // Toggle SEMANAL: colapsa o eixo diário da MA em bins de 7 dias ANCORADOS no último dia maduro (não na
    // semana-calendário) — cada bin pega o valor da MA no seu ÚLTIMO dia. É o que faz o ponto mais recente
    // do gráfico cobrir a MESMA janela da tabela ao lado. Ver weekBinISO_.
    if (gran === 'week') {
      const lastIdxByWeek = {};   // isoKeys asc → o último i de cada bin é o dia máximo dele
      isoKeys.forEach((k, i) => { if (k != null) lastIdxByWeek[weekBinISO_(String(k), weekAnchor)] = i; });
      const wKeys = Object.keys(lastIdxByWeek).sort();
      const idxs = wKeys.map(ws => lastIdxByWeek[ws]);
      xLabels = wKeys.map(ws => weekLabel_(ws));
      isoKeys = wKeys;
      series = series.map(s => ({ ...s, values: idxs.map(i => s.values[i]), ftd: s.ftd ? idxs.map(i => s.ftd[i]) : s.ftd }));
    }
  }
  // Janela: últimos N PERÍODOS terminando na última coorte madura (diário = 30 dias · semanal = 8 semanas).
  // Usa o gran do TOGGLE (display), não o effGran — com MA+Semanal os pontos já foram colapsados em semanas.
  const matCutId = effMetric, matCutISO = matDay;
  if (!cohort && dataMax) {
    const maxPeriods = RET_MAX_PERIODS[gran] || 30;
    if (isoKeys.length > maxPeriods) {
      const start = isoKeys.length - maxPeriods;
      xLabels = xLabels.slice(start); isoKeys = isoKeys.slice(start);
      series = series.map(s => ({ ...s, values: s.values.slice(start), ftd: s.ftd ? s.ftd.slice(start) : s.ftd }));
    }
  } else if (coLead && coLo) {
    // Coorte com lead-in: os dias anteriores a `coLo` entraram SÓ p/ encher a janela deslizante — corta-os do
    // eixo agora que a MA já rodou, senão o gráfico mostraria um período que a tabela ao lado não mostra.
    // No Semanal a chave é o 1º dia do BIN ancorado → compara com o bin de coLo (o 1º bin visível).
    const lo = gran === 'week' ? weekBinISO_(coLo, weekAnchor) : coLo;
    const start = isoKeys.findIndex(k => k != null && String(k) >= lo);
    if (start > 0) {
      xLabels = xLabels.slice(start); isoKeys = isoKeys.slice(start);
      series = series.map(s => ({ ...s, values: s.values.slice(start), ftd: s.ftd ? s.ftd.slice(start) : s.ftd }));
    }
  }
  series = series.filter(s => s.values.some(v => v != null && !isNaN(v)));

  const SERIES_OPTS = [['mult', 'Multiplicadores'], ['canal', 'Canal'], ['faixa', 'Faixa'], ['grupo', 'Grupo de risco']];
  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '10px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Linhas por</label>
        <span className="slicer-presets">
          {SERIES_OPTS.map(([id, lbl]) => (
            <button key={id} className={`preset-btn ${seriesBy === id ? 'active' : ''}`} onClick={() => setSeriesBy(id)}
              title={id === 'mult' ? 'Uma linha por multiplicador (D0…D30)' : `Uma linha por ${lbl.toLowerCase()} — do multiplicador escolhido`}>{lbl}</button>
          ))}
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Multiplicador</label>
        <span className="slicer-presets">
          {MET.map(m => (
            <button key={m.id} className={`preset-btn ${effMetric === m.id ? 'active' : ''}`} onClick={() => setMetric(m.id)} title={`Multiplicador ${m.id}/${bLbl} = ${m.desc}`}>{m.id}</button>
          ))}
        </span>
      </span>
      {/* O "active" segue o maEff, não o maDays: se por algum motivo a MA não estiver rodando (lead-in da
          coorte ainda carregando), o botão não pode ficar aceso fingindo que está. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média móvel</label>
        <span className="slicer-presets">
          <button className={`preset-btn ${maEff === 0 ? 'active' : ''}`} onClick={() => setMaDays(0)} title="Sem média móvel (valor do período)">Off</button>
          {[7, 14, 30].map(d => (
            <button key={d} className={`preset-btn ${maEff === d ? 'active' : ''}`} onClick={() => setMaDays(d)} title={`Média móvel de ${d} dias (janela deslizante diária, ponderada pelo denominador ativo)${cohort ? ` — na Coorte usa os ${d} dias ANTERIORES à janela como histórico, então o 1º ponto já sai com janela cheia` : ''}`}>{d}d</button>
          ))}
        </span>
        <input type="number" min="2" max="60" value={maDays || ''} placeholder="dias"
          onChange={e => { const v = parseInt(e.target.value, 10); setMaDays(isNaN(v) ? 0 : Math.max(0, Math.min(60, v))); }}
          title="Escolher N dias da média móvel (janela deslizante)"
          style={{ width: '62px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 6px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Escala</label>
        <span className="slicer-presets">
          <button className={`preset-btn ${yScale === 'lin' ? 'active' : ''}`} onClick={() => setYScale('lin')} title="Eixo Y linear">Linear</button>
          <button className={`preset-btn ${yScale === 'log' ? 'active' : ''}`} onClick={() => setYScale('log')} title="Eixo Y logarítmico — espalha grupos que variam de 1x a 10x+ (bom p/ comparar quebra por grupo)">Log</button>
        </span>
      </span>
    </div>
  );
  if (!series.length || !xLabels.length) return <React.Fragment>{controls}<div className="ch-note">{busy ? 'Carregando…' : err ? 'Erro ao carregar.' : 'Sem dados p/ o gráfico neste recorte.'}</div></React.Fragment>;

  const n = xLabels.length;
  const slotW = n > 20 ? 72 : n > 10 ? 118 : 210;
  const padL = 60, padR = 30, padT = 32, padB = 60, plotH = 600;
  // Piso de largura ALTO (~= largura da tabela) p/ o gráfico encher o container mesmo com poucos pontos
  // (semanal). Com muitos pontos cresce além e rola na horizontal, igual às tabelas.
  const W = Math.max(1500, padL + padR + (n === 1 ? slotW : (n - 1) * slotW));
  const H = padT + plotH + padB;
  const plotW = W - padL - padR;
  const xOf = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const allVals = series.flatMap(s => s.values).filter(v => v != null && !isNaN(v));
  const yMaxRaw = allVals.length ? Math.max.apply(null, allVals) : 1;
  const yMinRaw = allVals.length ? Math.min.apply(null, allVals) : 1;
  // Eixo Y ENQUADRA a linha (preenche a vertical, menos "achatado"), mas NUNCA abaixo de 1,00x (multiplicador
  // ≥ 1: D0 já inclui o FTD). Span mínimo 0,3x p/ não magnificar ruído quando a linha é quase plana. Ponto
  // atípico < 1 (raro) baixa o piso p/ não cortar (min(1, yMin)).
  // ROBUSTO A OUTLIER: quando o topo cru destoa MUITO da massa (ex.: grupo minúsculo → multiplicador de ruído que
  // dispara pra 50x), enquadra o topo pelo P95 dos pontos em vez do máximo, e GRAMPEIA (clamp) os pontos acima no
  // topo — o rótulo/tooltip seguem mostrando o valor REAL. Sem outlier (P95 ≈ máximo) usa o máximo (normal).
  const sortedV = allVals.slice().sort((a, b) => a - b);
  const pctV = (q) => sortedV.length ? sortedV[Math.min(sortedV.length - 1, Math.round(q * (sortedV.length - 1)))] : 1;
  const p95 = pctV(0.95);
  const yMaxEff = (p95 > 0 && yMaxRaw > p95 * 1.5) ? p95 : yMaxRaw;
  const ySpan = Math.max(yMaxEff - yMinRaw, 0.3);
  const yPad = ySpan * 0.18;
  const domMin = Math.max(Math.min(1, yMinRaw), yMinRaw - yPad);
  const domMax = Math.max(yMaxEff + yPad, domMin + 0.2);
  const yClamp = (v) => Math.max(domMin, Math.min(domMax, v));
  // Escala LOG (opcional): espalha grupos que variam de 1x a 10x+ (o cluster de baixo deixa de ficar espremido).
  // Piso em 0,5 p/ o log não explodir perto de zero. yOf mapeia em log quando ligado; gridlines viram "nice" (1,2,5,10…).
  const isLog = yScale === 'log';
  const lg_ = (v) => Math.log(Math.max(v, 0.5));
  const dLo = isLog ? lg_(Math.max(domMin, 0.5)) : domMin;
  const dHi = isLog ? lg_(domMax) : domMax;
  const yOf = (v) => { const c = isLog ? lg_(yClamp(v)) : yClamp(v); return padT + (1 - (c - dLo) / ((dHi - dLo) || 1)) * plotH; };
  const ticks = 4;
  const NICE_LOG = [0.5, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200];
  let gridVals;
  if (isLog) {
    gridVals = NICE_LOG.filter(v => v >= domMin * 0.999 && v <= domMax * 1.001);
    if (gridVals.length < 2) gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.exp(dLo + (dHi - dLo) * i / ticks));
  } else {
    gridVals = Array.from({ length: ticks + 1 }, (_, i) => domMin + (domMax - domMin) * i / ticks);
  }
  const lblEvery = Math.ceil(n / 12);
  const single = series.length === 1;
  // Data labels: SEMPRE aparecem (inclusive canal/faixa multi-linha) — antes um teto de 40 rótulos zerava
  // tudo no diário multi-linha. Agora afina por STRIDE de x p/ não virar sopa: single mostra todos (~30 pts);
  // multi-linha mostra a cada N dias (teto ~42 rótulos no total) e com fonte menor p/ empilhar sem colar.
  const nonNull = series.reduce((a, s) => a + s.values.filter(v => v != null && !isNaN(v)).length, 0) || 1;
  const labelStride = Math.max(1, Math.ceil(nonNull / (single ? 45 : 42)));
  const dataLblSize = single ? 16 : 12;
  const showLabelAt = (i) => (i % labelStride === 0);
  // path com quebras nos nulos (M no início de cada trecho contínuo)
  const linePath = (vals) => { let d = '', pen = false; vals.forEach((v, i) => { if (v == null || isNaN(v)) { pen = false; return; } d += (pen ? ' L' : ' M') + xOf(i).toFixed(1) + ',' + yOf(v).toFixed(1); pen = true; }); return d.trim(); };
  const yTitle = `${maEff > 0 ? `Mult ${effMetric}/${bLbl} · MM ${maEff}d` : `Mult ${effMetric}/${bLbl}`}${isLog ? ' · log' : ''}`;
  // Tooltip custom (hover): linha 1 = O QUE é (multiplicador OU canal/faixa+multiplicador); linha 2 = PERÍODO · valor.
  const tipHead = (s) => (seriesBy === 'mult') ? `${s.name}/${bLbl}` : `${s.name} · Mult ${effMetric}/${bLbl}`;
  const tipSub  = (i, v) => `${gran === 'week' ? 'Semana de ' : ''}${xLabels[i]} · ${fmtMultiple(v)}`;
  return (
    <React.Fragment>
      {controls}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', margin: '2px 0 8px' }}>
        {series.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ width: '12px', height: '3px', background: s.color, borderRadius: '2px', display: 'inline-block' }} />{s.name}
          </span>
        ))}
      </div>
      <div className="table-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ width: '100%', maxWidth: W, minWidth: Math.min(W, 700), height: 'auto', display: 'block', margin: '0 auto' }} preserveAspectRatio="xMidYMid meet">
          {gridVals.map((v, i) => (
            <g key={`g${i}`}>
              <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '2 4'} />
              <text x={padL - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#cfcfcf">{fmtMultiple(v)}</text>
            </g>
          ))}
          {xLabels.map((lb, i) => (i % lblEvery === 0) ? <text key={`x${i}`} x={xOf(i)} y={padT + plotH + 18} textAnchor="middle" fontSize="10.5" fill="#cfcfcf">{lb}</text> : null)}
          <text x={4} y={14} fontSize="10" fill="#aaaaaa">{yTitle}</text>
          {series.map((s, si) => (
            <g key={`s${si}`}>
              <path d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (v != null && !isNaN(v)) ? (
                <g key={i}>
                  <circle cx={xOf(i)} cy={yOf(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="1.8" />
                  {showLabelAt(i) && <text x={xOf(i)} y={yOf(v) - (single ? 13 : 10)} textAnchor="middle" fontSize={dataLblSize} fontWeight="700" fill={s.color}>{fmtMultiple(v)}</text>}
                  {/* alvo de hover generoso por cima (pointer-events all garante o hover mesmo com fill transparente) */}
                  <circle cx={xOf(i)} cy={yOf(v)} r="14" fill="transparent" style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseEnter={() => setHover({ si, i })} onMouseLeave={() => setHover(null)} />
                </g>
              ) : null)}
            </g>
          ))}
          {hover && series[hover.si] && series[hover.si].values[hover.i] != null && !isNaN(series[hover.si].values[hover.i]) && (() => {
            const s = series[hover.si], v = s.values[hover.i], cx = xOf(hover.i), cy = yOf(v);
            const l1 = tipHead(s), l2 = tipSub(hover.i, v);
            const bw = Math.max(l1.length, l2.length) * 9 + 32, bh = 64;
            let tx = Math.max(padL, Math.min(cx - bw / 2, W - padR - bw));
            let ty = cy - bh - 18; if (ty < padT) ty = cy + 20;   // acima do ponto; se colar no topo, vai p/ baixo
            return (
              <g pointerEvents="none">
                <circle cx={cx} cy={cy} r="6.5" fill={s.color} stroke="#000000" strokeWidth="2.5" />
                {/* fundo PRETO sólido + borda grossa na cor da série + texto branco → alto contraste, legível */}
                <rect x={tx} y={ty} width={bw} height={bh} rx="9" fill="#000000" fillOpacity="1" stroke={s.color} strokeWidth="2.5" />
                <text x={tx + 15} y={ty + 27} fontSize="17" fontWeight="700" fill="#ffffff">{l1}</text>
                <text x={tx + 15} y={ty + 49} fontSize="15" fill="#f2f2f2">{l2}</text>
              </g>
            );
          })()}
        </svg>
      </div>
      <div className="ch-note">
        <strong>{cohort ? `Coorte de ${cohortDays} dias — mesma base/janela da tabela (só coortes fechadas)` : `Janela: ${gran === 'week' ? 'últimas 8 semanas' : '30 dias corridos'} terminando na ÚLTIMA safra MADURA${matCutId ? ` do ${matCutId}` : ''}${matCutISO ? ` (até ${dmLabel(matCutISO)})` : ''} — coortes ainda imaturas são cortadas${gran === 'week' ? ' (a semana é um bloco de 7 dias terminando na última safra madura, não a semana-calendário — assim o ponto mais recente cobre a mesma janela da tabela)' : ''}`}</strong>. Eixo X = <strong>{gran === 'week' ? 'semana' : 'dia'} de FTD</strong>; {seriesBy === 'mult' ? <>evolução do <strong>multiplicador {effMetric}/{bLbl}</strong></> : <>uma linha por <strong>{seriesBy === 'canal' ? 'canal' : 'faixa de FTD'}</strong> (multiplicador {effMetric}/{bLbl})</>}. Cada ponto = média ponderada (Σ/Σ) do KPI no período. Segue canal/faixa/modo/same-day/M0.{busy ? ' · carregando…' : ''}{err ? ' · erro' : ''}
        {maEff > 0 && <React.Fragment>{' '}<em style={{ color: 'var(--text-dim)' }}>Média móvel de {maEff} dias: janela deslizante ponderada pelo DENOMINADOR ativo (Σ mult×{bLbl}$ ÷ Σ {bLbl}$ = a própria razão pooled da janela) dos últimos {maEff} dias, calculada em dias e {gran === 'week' ? 'amostrada por semana (valor no último dia da semana)' : 'plotada por dia'} — segue o toggle Diário/Semanal e suaviza o ruído. É uma janela TRAILING (só passado): uma virada real aparece com ~{Math.ceil(maEff / 2)} dias de atraso, somados ao corte de maturidade acima. Ponto cuja janela deslizante não esteja CHEIA não é plotado — média sobre menos dias que o rótulo promete suaviza o passado e chega a apagar quedas reais.{maEff > 7 && gran === 'week' ? ' Com MM > 7d no Semanal, semanas vizinhas dividem parte da janela — a linha fica mais "tendenciosa" do que o dado.' : ''}</em></React.Fragment>}{cohort && maEff > 0 && <React.Fragment>{' '}<em style={{ color: 'var(--text-dim)' }}>Na Coorte a janela deslizante puxa como histórico os dias ANTERIORES à janela visível (busca estendida em {maEff} dia{maEff > 1 ? 's' : ''}), então o 1º ponto já sai com janela cheia — o eixo continua mostrando só as safras fechadas da tabela.</em></React.Fragment>}{cohort && maDays > 0 && maEff === 0 && <React.Fragment>{' '}<em style={{ color: 'var(--accent-yellow)' }}>Média móvel esperando o histórico da coorte carregar — os pontos abaixo ainda são o valor bruto do período.</em></React.Fragment>}
        {!cohort && <React.Fragment>{' '}<em>Maturidade: o multiplicador só entra depois de a coorte ter os dias p/ fechar a janela (D0=0 · D1=1 · D7=7 · D14=14 · D30=30 dias após o FTD).</em></React.Fragment>}
      </div>
    </React.Fragment>
  );
}

function TabRetencaoFaixa({ retencaoFaixa, chFilter, channels, bp, meta }) {
  const [faixaSel, setFaixaSel] = React.useState([]);   // multi-select de faixas de FTD; [] = todas
  const [grupoSel, setGrupoSel] = React.useState([]);   // multi-select de GRUPO DE RISCO; [] = todos (filtro global da aba, igual faixas)
  const [mode, setMode] = React.useState('val');   // default Valor · 'val' (% do depósito sobre o D0) | 'qtd' (% redepositou)
  const [sameday, setSameday] = React.useState(false);  // default COORTE CHEIA — bate com a aba Benchmark (que é coorte cheia); same-day é opt-in
  const [gran, setGran] = React.useState('week');       // default Semanal · 'day' | 'week' (colapsa em médias semanais)
  const [tableDim, setTableDim] = React.useState('periodo'); // tabela de baixo: 'periodo' (por dia/semana) | 'canal' | 'faixa'
  const [cohortDays, setCohortDays] = React.useState(0); // 0 = calendário (M0 = fim do mês) | 30|60|90 = janela fixa de N dias corridos (só coortes fechadas)
  // Base dos multiplicadores da ABA (toggle "Multiplicador"): 'ftd' (padrão, ÷ FTD$) | 'd0' (÷ depósito do D0).
  // Vale p/ tabela, linha do mês anterior, cards do topo e gráfico por dimensão. A Ponte de variância NÃO
  // segue: ela compara BP → Realizado e o plano só tem meta sobre FTD$ (depM0 ÷ ftdAmount).
  // ('d1' existe em retMultCols_/benchMetrics_ desde antes, sem UI — segue sem UI.)
  const [multBase, setMultBase] = React.useState('ftd');
  const d0Base = multBase === 'd0';
  const baseLbl = d0Base ? 'D0' : 'FTD';
  const cohort = cohortDays > 0;
  const faixaAll = faixaSel.length === 0;
  const faixaLabelTxt = faixaAll ? 'todas as faixas' : (faixaSel.length <= 2 ? faixaSel.map(fxLabel_).join(' + ') : faixaSel.length + ' faixas');
  const grupoActive = grupoSel.length > 0;   // filtro de grupo ligado → aba toda passa a usar o dado byGrupo
  const grupoLabelTxt = !grupoActive ? 'todos os grupos' : (grupoSel.length <= 2 ? grupoSel.map(grupoLabel_).join(' + ') : grupoSel.length + ' grupos');
  // Same-day puxado sob demanda (only=retfaixa&sameday=1) p/ a MESMA janela global; sem custo extra quando off.
  const [sdFetch, setSdFetch] = React.useState({ rows: null, loading: false, error: null });
  const winFrom = meta && meta.from, winTo = meta && meta.to;
  React.useEffect(() => {
    if (cohort || !sameday || !winFrom || !winTo || !ENDPOINT_URL) return;
    setSdFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${winFrom}&to=${winTo}&only=retfaixa&sameday=1`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setSdFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setSdFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [cohort, sameday, winFrom, winTo]);
  // Cohort view: puxa o PRÓPRIO último ciclo de N dias FECHADO (independe do slicer global, igual ao Benchmark).
  // Busca [dataMax-(N+30), dataMax]; mostra só coortes com FTD <= dataMax-N (já fecharam os N dias) e troca o
  // M0 da tabela pela janela fixa de N dias (cntD{N}/valD{N}). N = 30|60|90 pelo toggle.
  const dataMax = meta && meta.dataMaxDate;
  const completeBefore = (dataMax && cohort) ? isoAddDays_(dataMax, -cohortDays) : null;
  // Início da janela VISÍVEL da coorte (as 31 safras que a tabela mostra). A busca vai CO_MA_LEAD dias mais
  // atrás só p/ dar lead-in à média móvel do gráfico — sem isso a janela deslizante sairia parcial nos
  // primeiros pontos e a MA ficaria desligada aqui. ⚠️ O `srcRF` da TABELA passou a ter piso explícito
  // (`>= coLo`): antes o filtro era só o teto (`<= completeBefore`), então estender a busca pra trás
  // alargaria a janela da tabela em silêncio.
  const CO_MA_LEAD = 30;   // cobre a MA máxima do gráfico (30d)
  const coLo = (dataMax && cohort) ? isoAddDays_(dataMax, -(cohortDays + 30)) : null;
  const [coFetch, setCoFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!cohort || !dataMax || !ENDPOINT_URL) return;
    const from = isoAddDays_(dataMax, -(cohortDays + 30 + CO_MA_LEAD)), to = dataMax;
    setCoFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${from}&to=${to}&only=retfaixa${sameday ? '&sameday=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setCoFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setCoFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [cohortDays, dataMax, sameday]);
  // Linha de referência do MÊS-CALENDÁRIO ANTERIOR ao período selecionado no slicer (jun→mai, mai→abr).
  // Âncora = fim da janela global (winTo). Puxa o próprio período via only=retfaixa; respeita o toggle
  // same-day. M0 sempre calendário. Sem custo quando o backend já cacheou a janela.
  const pm = React.useMemo(() => prevMonthRangeOf_(winTo), [winTo]);
  const [pmFetch, setPmFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!ENDPOINT_URL || !pm) return;
    setPmFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${pm.from}&to=${pm.to}&only=retfaixa${sameday ? '&sameday=1' : ''}${grupoActive ? '&byGrupo=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setPmFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setPmFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [pm, sameday, grupoActive]);
  // Dado COM grupo (&byGrupo=1) — usado pela tabela "Ver por = Grupo" E pelo FILTRO de grupo do topo (quando ligado,
  // a aba TODA passa a usar essa base). Fetch próprio no mesmo window/sameday da fonte atual (coorte usa a janela da coorte).
  const grNeed = grupoActive || tableDim === 'grupo';
  const [grFetch, setGrFetch] = React.useState({ rows: null, loading: false, error: null });
  const grFrom = cohort ? (dataMax ? isoAddDays_(dataMax, -(cohortDays + 30)) : null) : winFrom;
  const grTo = cohort ? dataMax : winTo;
  React.useEffect(() => {
    if (!grNeed || !ENDPOINT_URL || !grFrom || !grTo) return;
    setGrFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${grFrom}&to=${grTo}&only=retfaixa${sameday ? '&sameday=1' : ''}&byGrupo=1`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setGrFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setGrFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [grNeed, grFrom, grTo, sameday]);
  // Dado COM campanha (&byCampaign=1) — usado só pela tabela "Ver por = Campanha". Mesma janela/coorte da fonte;
  // segue o same-day. Quando o filtro de GRUPO está ligado, pede TAMBÉM &byGrupo=1
  // (senão as linhas vêm sem grupo e o filtro de grupo zera a tabela). Payload maior (linha por campanha) → opt-in.
  const campNeed = tableDim === 'campanha';
  const [campDimFetch, setCampDimFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!campNeed || !ENDPOINT_URL || !grFrom || !grTo) return;
    setCampDimFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${grFrom}&to=${grTo}&only=retfaixa${sameday ? '&sameday=1' : ''}&byCampaign=1${grupoActive ? '&byGrupo=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setCampDimFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setCampDimFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [campNeed, grFrom, grTo, sameday, grupoActive]);
  const campDimSrc = cohort
    ? (campDimFetch.rows || []).filter(r => completeBefore && r.date <= completeBefore).map(r => ({ ...r, cntM0: r['cntD' + cohortDays], valM0: r['valD' + cohortDays] }))
    : (campDimFetch.rows || []);
  // Fonte: coorte (fetch próprio · só coortes fechadas · M0 = janela de 30 dias) · same-day · padrão (slicer global).
  let srcRF;
  // Coorte, com lead-in: TUDO que veio do fetch (inclui os CO_MA_LEAD dias antes da janela visível), já
  // maduro (<= completeBefore). Só o GRÁFICO usa — é o histórico que alimenta a janela deslizante da MA.
  const srcRFLead = cohort
    ? (coFetch.rows || [])
      .filter(r => completeBefore && r.date <= completeBefore)
      .map(r => ({ ...r, cntM0: r['cntD' + cohortDays], valM0: r['valD' + cohortDays] }))
    : null;
  if (cohort) {
    srcRF = (srcRFLead || []).filter(r => coLo && r.date >= coLo);   // janela visível: piso + teto (ver coLo)   // janela visível: piso + teto (ver coLo)
  } else {
    srcRF = sameday ? (sdFetch.rows || []) : retencaoFaixa;
  }
  // Fonte COM grupo (byGrupo), no MESMO modo (coorte remapeia M0 como o srcRF).
  const srcRFGrupo = cohort
    ? (grFetch.rows || []).filter(r => completeBefore && r.date <= completeBefore).map(r => ({ ...r, cntM0: r['cntD' + cohortDays], valM0: r['valD' + cohortDays] }))
    : (grFetch.rows || []);
  // Fonte EFETIVA: com o filtro de grupo ligado, cards/tabela/bridge passam a usar a base byGrupo (filtrada por grupoSel).
  const srcE = grupoActive ? srcRFGrupo : srcRF;
  // Coluna "M0 Esperado": curva G do escopo (Total/Growth; canal específico → null). Same-day usa
  // curva própria (m0Curve_ escolhe). OFF só na Coorte 30d (janela fixa de 30d ≠ mês-calendário → runway não se aplica).
  const gCurve = !cohort ? m0Curve_(chFilter, sameday) : null;
  const data = aggRetFaixaBench_(srcE, chFilter, faixaSel, mode, gran, gCurve, dataMax, null, grupoSel);
  const t = data.totals || {};
  // Tabela de baixo: reagrupada por canal/faixa/grupo quando "Ver por" ≠ "período". Grupo sempre usa a base byGrupo.
  const tableData = tableDim === 'periodo' ? data
    : tableDim === 'grupo' ? aggRetFaixaBench_(srcRFGrupo, chFilter, faixaSel, mode, gran, gCurve, dataMax, 'grupo', grupoSel)
    : tableDim === 'campanha' ? aggRetFaixaBench_(campDimSrc, chFilter, faixaSel, mode, gran, gCurve, dataMax, 'campanha', grupoSel)
    : aggRetFaixaBench_(srcE, chFilter, faixaSel, mode, gran, gCurve, dataMax, tableDim, grupoSel);
  // Mês anterior fechado: mesmo recorte (canal/faixa/modo) num único agregado (.totals). Sem curva (já maduro).
  const pmRow = pmFetch.rows ? aggRetFaixaBench_(pmFetch.rows, chFilter, faixaSel, mode, 'day', null, dataMax, null, grupoSel).totals : null;
  // BP do escopo (Total/Growth/canal). Só faz sentido p/ "Todas as faixas" — o plano não tem meta
  // por faixa de FTD. M0/FTD do plano = depM0÷ftdAmount · FTD médio do plano = ftdAmount÷ftd.
  // Total da Casa usa os totais "tt" do house (M0 tt / FTD tt — inclui não-growth, bate com o ACT
  // que soma todos os canais); growth/canal usam os agregados per-canal. M0/FTD = M0÷FTD$.
  let bpScope = null;
  if (bp) {
    const list = chList_(chFilter);
    if (list.length) {
      const agg = {};
      list.forEach(ch => { const b = bp.byChannel && bp.byChannel[ch]; if (b) ['depM0','ftdAmount','ftd'].forEach(k => { if (b[k] != null) agg[k] = (agg[k] || 0) + b[k]; }); });
      bpScope = { m0: agg.depM0, ftdAmount: agg.ftdAmount, ftd: agg.ftd };
    } else if (chFilter && chFilter.scope === 'growth') {
      const g = bp.growthAgg || {};
      bpScope = { m0: g.depM0, ftdAmount: g.ftdAmount, ftd: g.ftd };
    } else {
      const h = bp.house || {};
      bpScope = { m0: h.m0tt, ftdAmount: h.ftdAmountTt, ftd: h.ftdTt };
    }
  }
  // Sem figura de plano p/ same-day, coorte 30d, faixa filtrada OU base D0 (o plano só tem meta sobre FTD$) → farol off.
  const showBp = faixaAll && bpScope && !sameday && !cohort && !d0Base;
  const bpMultM0F  = (showBp && bpScope.ftdAmount > 0) ? bpScope.m0 / bpScope.ftdAmount : null;
  const bpFtdMedio = (showBp && bpScope.ftd > 0) ? bpScope.ftdAmount / bpScope.ftd : null;
  const pb = (act, bpv) => (bpv && act != null) ? act / bpv : null;
  // Cards 1 e 3 seguem o toggle de base (FTD$ ou depósito D0); o do meio (FTD médio) não é multiplicador.
  // Na base D0 não há meta de plano → bp null (showBp já desliga), e o card mostra só o realizado.
  const heroM0 = d0Base ? t.multM0D0 : t.multM0F;
  const heroD1 = d0Base ? t.multD1D0 : t.multD1F;
  const heroes = [
    { label: `${cohort ? '30d' : 'M0'} / ${baseLbl}`, act: heroM0, m1: null, bp: bpMultM0F, pctBp: pb(heroM0, bpMultM0F), fmt: 'multiple' },      // (D0+janela) ÷ base
    { label: 'FTD médio do período', act: t.ftdMedio, m1: null, bp: bpFtdMedio, pctBp: pb(t.ftdMedio, bpFtdMedio), fmt: 'brl' },
    // D1 / base = multiplicador médio PONDERADO por valor: (Σ D0 + Σ dep dia 1) ÷ Σ base. Sem BP (o plano
    // não tem meta de D1), sem M-1 (igual ao card irmão M0/base).
    { label: `D1 / ${baseLbl}`, act: heroD1, m1: null, bp: null, pctBp: null, fmt: 'multiple' },
  ];
  const chLabel = chLabel_(chFilter);
  const coSuffix = cohort ? ` · coorte ${cohortDays}d (FTD até ${completeBefore ? completeBefore.slice(8, 10) + '/' + completeBefore.slice(5, 7) : '—'})` : '';
  const loadingRF = (cohort && coFetch.loading) || (sameday && sdFetch.loading) || (grNeed && grFetch.loading) || (campNeed && campDimFetch.loading);
  const errorRF = (cohort && coFetch.error) || (sameday && sdFetch.error) || (grNeed && grFetch.error) || (campNeed && campDimFetch.error);
  // Opções do multiselect de grupo: os grupos REAIS do dado byGrupo (quando já carregou), senão o default GRUPO_LIST.
  const grupoOptions = (grFetch.rows && grFetch.rows.length)
    ? Array.from(new Set(grFetch.rows.map(r => r.grupo != null ? String(r.grupo) : 'sem grupo'))).sort()
    : GRUPO_LIST;
  const selStyle = { background: 'var(--surface)', border: '1px solid rgba(249,115,22,.5)', color: 'var(--text)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit' };
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Retenções por faixa de FTD</h1>
          <div className="subtitle">Safra de FTD por dia (só Apostou) — ticket de FTD, depósito D0, multiplicadores {d0Base ? 'D1–M0 sobre o depósito do D0' : 'D0–M0 sobre o FTD$'} e retenção D1/W1/M0; filtrável por faixa e canal</div>
        </div>
      </div>
      <div className="slicer-group slicer-ruler">
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Faixa FTD</label>
          <ChannelMultiSelect options={FAIXA_LIST} selected={faixaSel} onChange={setFaixaSel} labelOf={fxLabel_} allLabel="Todas" countNoun="faixas" />
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Grupo de risco</label>
          <ChannelMultiSelect options={grupoOptions} selected={grupoSel} onChange={setGrupoSel} labelOf={grupoLabel_} allLabel="Todos" countNoun="grupos" />
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Retenção</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${mode === 'val' ? 'active' : ''}`} onClick={() => setMode('val')} title="Retenção por VALOR: $ depositado na janela ÷ depósito do D0 (em %, pode passar de 100%)">Valor</button>
            <button className={`preset-btn ${mode === 'qtd' ? 'active' : ''}`} onClick={() => setMode('qtd')} title="Retenção por QUANTIDADE: % dos FTDs que voltaram a depositar na janela">Qtd</button>
          </div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Multiplicador</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${!d0Base ? 'active' : ''}`} onClick={() => setMultBase('ftd')} title="Multiplicadores sobre o FTD$: depósito acumulado (incl. D0) ÷ valor do primeiro depósito. Começa no D0/FTD e é a base que tem meta de plano (farol ligado).">sobre FTD</button>
            <button className={`preset-btn ${d0Base ? 'active' : ''}`} onClick={() => setMultBase('d0')} title="Multiplicadores sobre o depósito do D0: acumulado ÷ Σ depósito do dia do FTD. Mede quanto o dinheiro do 1º dia se multiplicou, sem o efeito do ticket de FTD. D0/D0 = 1,00x é omitido; sem meta de plano (farol off).">sobre D0</button>
          </div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Coorte</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${!sameday ? 'active' : ''}`} onClick={() => setSameday(false)} title="Todos os FTDs da janela">Todos</button>
            <button className={`preset-btn ${sameday ? 'active' : ''}`} onClick={() => setSameday(true)} title="Só FTDs que depositaram no MESMO dia do cadastro (FTD = dia do cadastro)">Same-day</button>
          </div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Visão</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${gran === 'day' ? 'active' : ''}`} onClick={() => setGran('day')} title="Uma linha por dia de FTD">Diário</button>
            <button className={`preset-btn ${gran === 'week' ? 'active' : ''}`} onClick={() => setGran('week')} title="Colapsa em semanas (seg–dom): re-agrega as bases e recalcula as métricas — não é média das %">Semanal</button>
          </div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Ver por</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${tableDim === 'periodo' ? 'active' : ''}`} onClick={() => setTableDim('periodo')} title="Tabela de safra: uma linha por dia/semana (segue a Visão)">Período</button>
            <button className={`preset-btn ${tableDim === 'canal' ? 'active' : ''}`} onClick={() => setTableDim('canal')} title="Tabela de safra: uma linha por canal — compara os canais no período todo (maior FTD$ primeiro)">Canal</button>
            <button className={`preset-btn ${tableDim === 'faixa' ? 'active' : ''}`} onClick={() => setTableDim('faixa')} title="Tabela de safra: uma linha por faixa de FTD — compara as faixas no período todo">Faixa</button>
            <button className={`preset-btn ${tableDim === 'grupo' ? 'active' : ''}`} onClick={() => setTableDim('grupo')} title="Tabela de safra: uma linha por grupo de risco — compara os grupos no período todo (puxa &byGrupo do BQ)">Grupo</button>
            <button className={`preset-btn ${tableDim === 'campanha' ? 'active' : ''}`} onClick={() => setTableDim('campanha')} title="Tabela de safra: uma linha por campanha (utm_ftd_campaign) — compara as campanhas no período todo (maior FTD$ primeiro; puxa &byCampaign do BQ). Respeita o filtro de canal/campanha.">Campanha</button>
          </div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>M0</label>
          <div className="slicer-presets">
            <button className={`preset-btn ${!cohort ? 'active' : ''}`} onClick={() => setCohortDays(0)} title="M0 = depósito do dia do FTD até o FIM do mês-calendário (visão atual; coortes recentes ficam curtas).">Calendário</button>
            <button className={`preset-btn ${cohortDays === 30 ? 'active' : ''}`} onClick={() => setCohortDays(30)} title="M0 = janela FIXA de 30 dias corridos do FTD; só coortes que já fecharam os 30 dias (a mais recente ~30 dias atrás). Puxa o período sozinho, independe do slicer do topo.">Coorte 30d</button>
          </div>
        </div>
      <div className="hero-grid">
        {heroes.map((m, i) => <Hero key={i} metric={m} />)}
      </div>
      <div className="support">
        <div className="support-title">Mês anterior · {monthLabelPt_(pm.from)} · {chLabel} · {faixaLabelTxt}{sameday ? ' · same-day' : ''} · mult sobre {baseLbl}{pmFetch.loading ? ' · carregando…' : ''}{pmFetch.error ? ' · erro ao carregar' : ''}</div>
        <RetFaixaPrevRow row={pmRow} label={monthLabelPt_(pm.from)} loading={pmFetch.loading} error={pmFetch.error} base={multBase} />
        <div className="ch-note">Mês-calendário <strong>anterior ao período selecionado</strong> no slicer ({monthLabelPt_(pm.from)}), agregado num único registro, no mesmo recorte de canal/faixa/modo. O M0 é sempre mês-calendário (não muda com o toggle Calendário/Coorte).</div>
      </div>
      <div className="support">
        <div className="support-title">Safra {tableDim === 'periodo' ? 'por ' + (gran === 'week' ? 'Semana' : 'Dia') : 'por ' + (tableDim === 'canal' ? 'Canal' : tableDim === 'faixa' ? 'Faixa' : tableDim === 'campanha' ? 'Campanha' : 'Grupo de risco')} · {chLabel} · {faixaLabelTxt}{sameday ? ' · same-day' : ''}{coSuffix} · mult sobre {baseLbl}{loadingRF ? ' · carregando…' : ''}{errorRF ? ' · erro ao carregar' : ''}</div>
        <RetFaixaTable data={tableData} dateLabel={tableDim === 'canal' ? 'Canal' : tableDim === 'faixa' ? 'Faixa' : tableDim === 'grupo' ? 'Grupo' : tableDim === 'campanha' ? 'Campanha' : (gran === 'week' ? 'Semana' : 'Data FTD')} m0Label={cohort ? cohortDays + 'd' : 'M0'} base={multBase} />
      </div>
      <div className="support">
        <div className="support-title">Multiplicador por dimensão · sobre {baseLbl} · {cohort ? 'coorte ' + cohortDays + 'd' : 'últimos 30 dias corridos'} · {chLabel} · {faixaLabelTxt}{grupoActive ? ' · ' + grupoLabelTxt : ''}{sameday ? ' · same-day' : ''}</div>
        <RetMultChart chFilter={chFilter} faixaSel={faixaSel} grupoSel={grupoSel} grupoActive={grupoActive} mode={mode} gran={gran} sameday={sameday} dataMax={dataMax} fallbackRows={retencaoFaixa} cohort={cohort} cohortDays={cohortDays} srcRF={srcRF} srcRFLead={srcRFLead} coLo={coLo} srcLoading={cohort && coFetch.loading} srcError={cohort ? coFetch.error : null} base={multBase} />
      </div>
    </React.Fragment>
  );
}

// ============================================================
// CAC CALCULATOR — Teto CAC por canal
//   Teto CAC = (Ticket FTD × Mult M0/D1 do canal × margem GGR) ÷ meta ROAS GGR M0
//     Ticket FTD  = nível de depósito D1 por FTD (D0 + redep. do dia 1) no ÚLTIMO dia (ou média 7d)
//     Mult M0/D1  = razão M0/D1 do MÊS ANTERIOR por canal (níveis, ambos incl. D0) — projeta o M0 a
//                   partir do sinal precoce de D1 (mesma ideia da "Tend. M0(D1)"); segue a faixa filtrada
//     M0 proj/FTD = Ticket FTD × Mult  → GGR/FTD = × margem GGR → Teto CAC = ÷ meta ROAS GGR M0
//   Compara o Teto contra o CAC realizado (Investimento ÷ FTD qtd, da tabela de canais).
// ============================================================
function TabCacCalculator({ retencaoFaixa, channels, componentsByChannel, chFilter, meta, ggrSafra }) {
  const [faixaSel, setFaixaSel] = React.useState([]);        // multi-select de faixas; [] = todas
  const [margem, setMargem] = React.useState(null);          // % margem GGR: null = usa o GGR/Dep M0 ao vivo; nº = override do usuário
  const [metaRoas, setMetaRoas] = React.useState(23.72);     // % meta ROAS GGR M0 (editável)

  const dataMax = meta && meta.dataMaxDate;
  // Mult M0/D1 = razão do ÚLTIMO COORTE DE 30 DIAS FECHADO (mesma lógica da Ret. Faixa "Coorte 30d"):
  // fetch [dataMax-60, dataMax], usa só coortes com FTD ≤ dataMax-30 (já fecharam os 30d); M0 = val_d30 (janela fixa).
  const coFrom = dataMax ? isoAddDays_(dataMax, -60) : null;
  const completeBefore = dataMax ? isoAddDays_(dataMax, -30) : null;
  const [coFetch, setCoFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!ENDPOINT_URL || !dataMax) return;
    setCoFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${coFrom}&to=${dataMax}&only=retfaixa`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setCoFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setCoFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [coFrom, dataMax]);
  // Mock/dev (sem endpoint): reusa a base atual só p/ a tela não ficar vazia.
  const coRows = coFetch.rows || (!ENDPOINT_URL ? (retencaoFaixa || []) : null);

  const faixaKey = faixaSel.join('|');
  const faixaSet = faixaSel.length ? new Set(faixaSel) : null;
  const selFx = (fx) => !faixaSet || faixaSet.has(fx);
  const faixaAll = faixaSel.length === 0;
  const faixaLabelTxt = faixaAll ? 'todas as faixas' : (faixaSel.length <= 2 ? faixaSel.map(fxLabel_).join(' + ') : faixaSel.length + ' faixas');

  // Mult M0/D1 = (MULT 30D/FTD) ÷ (MULT D1/FTD) do ÚLTIMO COORTE DE 30 DIAS FECHADO (FTD ≤ dataMax-30).
  // Como os dois multiplicadores são /FTD e INCLUEM D0, o FTD cancela → = (Σ D0 + Σ val_d30) ÷ (Σ D0 + Σ val_d1).
  // Ex. Google: 6,32 ÷ 2,81 = 2,25.
  const pmByCh = React.useMemo(() => {
    const m = {};
    (coRows || []).forEach(r => {
      if (!selFx(r.faixa)) return;
      if (completeBefore && r.date > completeBefore) return;   // só coortes que já fecharam os 30 dias
      const o = m[r.canal] || (m[r.canal] = { d0: 0, d1: 0, d30: 0 });
      o.d0 += (r.depD0 || 0);
      o.d1 += (r.valD1 || 0);
      o.d30 += (r.valD30 != null ? r.valD30 : r.valM0) || 0;   // redep 30d (janela fixa); fallback valM0 no mock
    });
    return m;
  }, [coRows, faixaKey, completeBefore]);

  // Margem GGR = GGR/Depósito do M0 ao VIVO (Σ GGR M0 ÷ Σ DEP M0 dos canais growth do ggrSafra) — MESMO
  // número do card GGR/Depósito M0 da aba GGR. É o % do depósito M0 que vira GGR, então é o que roda
  // sobre o M0 estimado na fórmula. Editável: se o usuário digitar, usa o override; senão, o live.
  const liveMarginM0 = React.useMemo(() => {
    const m0 = ggrSafra && ggrSafra.m0;
    if (!m0 || !m0.length) return null;
    let g = 0, d = 0;
    m0.forEach(c => { if (isGrowthCh_(c.channel)) { g += c.ggr || 0; d += c.dep || 0; } });
    return d > 0 ? (g / d) * 100 : null;
  }, [ggrSafra]);
  const margemEff = (margem != null && margem !== '') ? margem : liveMarginM0;   // p/ o input: override do usuário, ou o live blend
  const margemInputVal = (typeof margemEff === 'number' && !isNaN(margemEff)) ? Math.round(margemEff * 100) / 100 : '';
  const metaF   = (typeof metaRoas === 'number' && !isNaN(metaRoas)) ? metaRoas / 100 : 0;

  // Margem GGR M0 POR CANAL (GGR M0 ÷ Dep M0 do canal, ao vivo do ggrSafra) — alimenta o Teto de CADA linha.
  // O campo % da fórmula é OVERRIDE GLOBAL: preenchido = fixa a MESMA margem em todos (simulação);
  // vazio = cada canal usa a sua margem M0 ao vivo (Total = blend growth = liveMarginM0, = card da aba GGR no escopo growth).
  const m0ByCh = React.useMemo(() => {
    const m = {}; ((ggrSafra && ggrSafra.m0) || []).forEach(c => { m[c.channel] = { ggr: c.ggr || 0, dep: c.dep || 0 }; });
    return m;
  }, [ggrSafra]);
  const margemOverrideF = (margem != null && margem !== '' && !isNaN(Number(margem))) ? Number(margem) / 100 : null;
  const blendMarginF = (typeof liveMarginM0 === 'number' && !isNaN(liveMarginM0)) ? liveMarginM0 / 100 : 0;

  // Base do MÊS CORRENTE (MTD, calendário) por canal: MULT D1/FTD = (Σ D0 + Σ val_d1) ÷ Σ FTD$.  Ex. Google: 2,67.
  const winByCh = React.useMemo(() => {
    const m = {};
    (retencaoFaixa || []).forEach(r => {
      if (!selFx(r.faixa)) return;
      const o = m[r.canal] || (m[r.canal] = { d0: 0, d1: 0, ftdTotal: 0, ftdQty: 0 });
      o.d0 += (r.depD0 || 0);
      o.d1 += (r.valD1 || 0);
      o.ftdTotal += r.ftdTotal || 0;
      o.ftdQty += r.qtdFtds || 0;
    });
    return m;
  }, [retencaoFaixa, faixaKey]);

  // Uma linha por canal — SÓ canais de crescimento (Meta, Google, TikTok, Kwai, Programática).
  // M0 estimado/FTD (mult) = Mult M0/D1 (coorte) × MULT D1/FTD (MTD). Ex. Google: 2,25 × 2,67 = 6,01.
  // M0 estimado R$/FTD = mult × FTD médio; GGR/FTD = margem × M0 est R$; Teto CAC = GGR/FTD ÷ meta.
  const rows = (channels || []).filter(c => isGrowthCh_(c.channel)).map(c => {
    const pmc = pmByCh[c.channel], win = winByCh[c.channel];
    const cmp = componentsByChannel && componentsByChannel[c.channel] && componentsByChannel[c.channel].mtd;
    const spend   = (cmp && cmp.spend != null) ? cmp.spend : c.spend;            // Investimento = spend do FAROL (tbl_performance_daily); fallback channels no mock
    const ftdQtyC = (cmp && cmp.ftdQty) ? cmp.ftdQty : c.ftdQty;                 // FTD qtd do mesmo escopo do spend (p/ CAC bater com o Farol)
    const mult    = (pmc && (pmc.d0 + pmc.d1) > 0) ? (pmc.d0 + pmc.d30) / (pmc.d0 + pmc.d1) : null;   // Mult M0/D1 = (30D/FTD)÷(D1/FTD) coorte, incl. D0
    const winFtd  = win ? win.ftdQty : 0;                                        // nº de FTDs do canal (MTD)
    const winFtdTot = win ? win.ftdTotal : 0;                                    // Σ FTD$ do canal (MTD)
    const baseD1  = (win && winFtdTot > 0) ? (win.d0 + win.d1) / winFtdTot : null;   // MULT D1/FTD do mês corrente (incl. D0)
    const m0estM  = (mult != null && baseD1 != null) ? mult * baseD1 : null;     // MULT M0/FTD estimado (Google ~6,01)
    const ftdMed  = (win && winFtd > 0) ? winFtdTot / winFtd : null;             // FTD médio (R$) do mês corrente
    const m0estFtd = (m0estM != null && ftdMed != null) ? m0estM * ftdMed : null; // M0 estimado R$ por FTD
    const chM0    = m0ByCh[c.channel];
    const chMargin = (chM0 && chM0.dep > 0) ? chM0.ggr / chM0.dep : null;         // % GGR/Dep M0 do canal (ao vivo)
    const useMarginF = margemOverrideF != null ? margemOverrideF : (chMargin != null ? chMargin : blendMarginF);  // margem do canal, ou override global
    const teto    = (m0estFtd != null && metaF > 0) ? (m0estFtd * useMarginF) / metaF : null;  // Teto CAC (margem do canal)
    const cac     = (spend != null && spend > 0 && ftdQtyC > 0) ? spend / ftdQtyC : null;
    const folga   = (teto != null && cac != null) ? teto - cac : null;
    const ratio   = (teto != null && cac != null && cac > 0) ? teto / cac : null;
    const m0Total = (m0estFtd != null && winFtd > 0) ? m0estFtd * winFtd : null;  // M0 total estimado (montante)
    const ggrTot  = (m0Total != null) ? m0Total * useMarginF : null;             // GGR total estimado = M0 total × margem do canal
    const roas    = (ggrTot != null && spend != null && spend > 0) ? ggrTot / spend : null;  // ROAS = GGR total estimado ÷ Investimento
    return { ch: c.channel, mult, m0estM, ftdMed, chMargin, teto, cac, folga, ratio, ftd: winFtd, spend, ftdQty: ftdQtyC, ftdTot: winFtdTot, m0Total, ggrTot, roas };
  }).sort((a, b) => (b.ftdTot || 0) - (a.ftdTot || 0));

  // Totais: M0 estimado/FTD blended (Σ M0 total ÷ Σ FTDs) + somas de montante (Investimento/FTD/M0/GGR total).
  const T = rows.reduce((a, r) => {
    if (r.m0Total != null) { a.m0Total += r.m0Total; a.ftd += r.ftd; a.ggrTot += r.ggrTot || 0; }
    if (r.spend != null && r.spend > 0 && r.ftdQty > 0) { a.spend += r.spend; a.ftdQty += r.ftdQty; }
    if (r.ftdTot != null) a.ftdTot += r.ftdTot;
    return a;
  }, { m0Total: 0, ftd: 0, ggrTot: 0, spend: 0, ftdQty: 0, ftdTot: 0 });
  const totM0estFtd = T.ftd > 0 ? T.m0Total / T.ftd : null;       // M0 estimado/FTD blended
  const totMarginF = margemOverrideF != null ? margemOverrideF : blendMarginF;   // Total: override, ou blend growth (= liveMarginM0)
  const totTicket = T.ftd > 0 ? T.ftdTot / T.ftd : null;          // Ticket médio blended = Σ FTD$ ÷ Σ FTDs
  const totTeto = (totM0estFtd != null && metaF > 0) ? (totM0estFtd * totMarginF) / metaF : null;
  const totCac = T.ftdQty > 0 ? T.spend / T.ftdQty : null;
  const totFolga = (totTeto != null && totCac != null) ? totTeto - totCac : null;
  const totRatio = (totTeto != null && totCac != null && totCac > 0) ? totTeto / totCac : null;
  const totRoas = (T.spend > 0) ? T.ggrTot / T.spend : null;   // ROAS blended = Σ GGR total ÷ Σ Investimento
  const totM0estM = (T.ftdTot > 0) ? T.m0Total / T.ftdTot : null;   // Mult M0/FTD blended = Σ M0 total ÷ Σ FTD$

  const GREEN = '#34d399', ORANGE = '#FF8C00', divCol = { borderLeft: '2px solid var(--border)' };   // laranja Apostou (claramente laranja, não o red-orange #f97316)
  const pctInput = (val, set, color) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <input type="number" step="0.01" value={val === '' ? '' : val}
        onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))}
        style={{ width: '66px', textAlign: 'right', background: 'var(--surface)', border: '1px solid ' + color, borderRadius: '6px', color: color, fontFamily: 'inherit', fontSize: '15px', fontWeight: 700, padding: '3px 6px' }} />
      <span style={{ color, fontWeight: 700, fontSize: '15px' }}>%</span>
    </span>
  );
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>CAC Calculator</h1>
          <div className="subtitle">Teto de CAC por canal de crescimento = quanto dá pra pagar por FTD mantendo a meta de ROAS GGR M0 — Teto = multiplicador D30 × ticket FTD × margem ÷ meta. Também mostra Investimento e projeta D30/GGR totais por canal.</div>
        </div>
        <div className="slicer-group">
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Faixa FTD</label>
          <ChannelMultiSelect options={FAIXA_LIST} selected={faixaSel} onChange={setFaixaSel} labelOf={fxLabel_} allLabel="Todas" countNoun="faixas" />
        </div>
      </div>

      {/* A FÓRMULA — os dois parâmetros são editáveis e recalculam a tabela ao vivo */}
      <div className="support">
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap', padding: '4px 2px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 700 }}>A FÓRMULA</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>Teto CAC <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>=</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '15px', paddingBottom: '8px' }}>
              <b style={{ color: ORANGE }}>multiplicador D30</b>
              <span style={{ color: 'var(--text-muted)' }}>×</span>
              <span>ticket FTD</span>
              <span style={{ color: 'var(--text-muted)' }}>×</span>
              {pctInput(margemInputVal, setMargem, GREEN)}
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px', paddingTop: '8px' }}>
              {pctInput(metaRoas, setMetaRoas, GREEN)}
              <span style={{ color: 'var(--text-muted)' }}>· meta ROAS GGR M0</span>
            </div>
          </div>
        </div>
        <div className="ch-note" style={{ marginTop: '12px' }}>
          <strong>multiplicador D30</strong> = Mult M0/D1 (coorte) × MULT D1/FTD (MTD). <strong>ticket FTD</strong> = FTD médio do mês corrente. GGR estimado/FTD = multiplicador D30 × ticket FTD × margem; <strong>Teto CAC</strong> = GGR/FTD ÷ meta.
          <strong> Mult M0/D1</strong> = (MULT 30D/FTD ÷ MULT D1/FTD) do <strong>último coorte de 30 dias fechado</strong> (FTD até {completeBefore ? completeBefore.slice(8,10)+'/'+completeBefore.slice(5,7) : '—'}) = (Σ D0 + Σ val_d30) ÷ (Σ D0 + Σ val_d1) — os multiplicadores /FTD incluem o D0 (ex. Google 6,32÷2,81 = 2,25).
          <strong> MULT D1/FTD (MTD)</strong> = (Σ D0 + Σ val_d1) ÷ Σ FTD$ do mês corrente (ex. Google 2,67 → multiplicador D30 = 2,25×2,67 = 6,01).
          <strong> Margem GGR</strong> = <strong>GGR/Depósito M0 POR CANAL, ao vivo</strong> (GGR M0 ÷ Dep M0 de cada canal) — cada linha usa a sua; o Total é o blend growth{liveMarginM0 != null ? ' = ' + fmtPct(liveMarginM0 / 100) : ''} (= card GGR/Depósito M0 da aba GGR no escopo growth). O <strong>%</strong> acima é OVERRIDE: preenchido, fixa a mesma margem em todos (simulação); vazio, cada canal usa a sua. <strong>meta ROAS GGR M0</strong> também editável.
          {coFetch.loading ? ' · carregando coorte…' : ''}{coFetch.error ? ' · erro ao carregar coorte' : ''}
        </div>
      </div>

      <div className="support">
        <div className="support-title">Teto CAC por Canal · Crescimento · {faixaLabelTxt} · D1 = média MTD</div>
        <div className="table-scroll"><table className="ch-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th style={{ color: ORANGE }} title="Multiplicador D30/FTD estimado = Mult M0/D1 do coorte 30d (30D/FTD ÷ D1/FTD) × MULT D1/FTD do mês corrente. Ex. Google: 2,25 × 2,67 = 6,01">multiplicador D30/FTD</th>
              <th title="Ticket médio de FTD (1º depósito) do canal no mês corrente = Σ FTD$ ÷ nº de FTDs">Ticket médio</th>
              <th style={{ color: GREEN }} title="Margem M0 do canal = GGR M0 ÷ Depósito M0 (ao vivo). É ela que corre sobre o M0 estimado da linha; edite o % na fórmula p/ fixar a mesma margem em todos">% GGR/Dep M0</th>
              <th title="M0 estimado/FTD (= multiplicador D30/FTD × ticket médio) × margem GGR/Dep M0 do canal ÷ meta ROAS GGR M0 = máximo CAC que mantém a meta">Teto CAC</th>
              <th title="CAC realizado = Investimento ÷ FTD qtd (janela do slicer)">CAC atual</th>
              <th title="Teto CAC − CAC atual. Verde = folga p/ pagar mais; vermelho = pagando acima do teto">Folga</th>
              <th style={divCol} title="Investimento do canal (mesma fonte do Farol: tbl_performance_daily, com imposto Meta)">Investimento</th>
              <th title="Valor total de FTD (1º depósito) do canal na janela">FTD total</th>
              <th title="multiplicador D30 × Σ FTD$ do canal na janela = depósito D30 total estimado">D30 projetado</th>
              <th title="M0 total estimado × margem GGR = GGR total estimado">GGR total proj</th>
              <th title="ROAS = GGR total estimado ÷ Investimento">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="ch-name">{r.ch}</td>
                <td style={{ color: ORANGE, fontWeight: 600 }}>{fmtMultiple(r.m0estM)}</td>
                <td>{fmtBRL(r.ftdMed)}</td>
                <td style={{ color: GREEN, fontWeight: 600 }}>{fmtPct(margemOverrideF != null ? margemOverrideF : r.chMargin)}</td>
                <td style={{ fontWeight: 700 }}>{fmtBRL(r.teto)}</td>
                <td>{fmtBRL(r.cac)}</td>
                <td className={r.ratio != null ? 'ch-band-' + farolFromPct(r.ratio) : ''}>{r.folga != null ? fmtBRL(r.folga) : '—'}</td>
                <td style={divCol}>{fmtBRL(r.spend)}</td>
                <td>{fmtBRL(r.ftdTot)}</td>
                <td>{fmtBRL(r.m0Total)}</td>
                <td style={{ color: GREEN, fontWeight: 600 }}>{fmtBRL(r.ggrTot)}</td>
                <td style={{ fontWeight: 600 }}>{fmtMultiple(r.roas)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total · Crescimento</td>
              <td style={{ color: ORANGE, fontWeight: 700 }}>{fmtMultiple(totM0estM)}</td>
              <td>{fmtBRL(totTicket)}</td>
              <td style={{ color: GREEN, fontWeight: 700 }}>{fmtPct(margemOverrideF != null ? margemOverrideF : (liveMarginM0 != null ? liveMarginM0 / 100 : null))}</td>
              <td style={{ fontWeight: 700 }}>{fmtBRL(totTeto)}</td>
              <td>{fmtBRL(totCac)}</td>
              <td className={totRatio != null ? 'ch-band-' + farolFromPct(totRatio) : ''}>{totFolga != null ? fmtBRL(totFolga) : '—'}</td>
              <td style={divCol}>{fmtBRL(T.spend || null)}</td>
              <td>{fmtBRL(T.ftdTot || null)}</td>
              <td>{fmtBRL(T.m0Total || null)}</td>
              <td style={{ color: GREEN, fontWeight: 700 }}>{fmtBRL(T.ggrTot || null)}</td>
              <td style={{ fontWeight: 700 }}>{fmtMultiple(totRoas)}</td>
            </tr>
          </tfoot>
        </table></div>
        <div className="ch-note">
          Só <strong>canais de crescimento</strong> (Meta, Google, TikTok, Kwai, Programática). O <strong>Teto CAC</strong> é o quanto dá pra pagar por FTD para o ROAS GGR M0 bater a meta;
          a coluna <strong>Folga</strong> compara com o CAC realizado (verde ≥ teto, vermelho abaixo). <strong>multiplicador D30/FTD</strong> = M0/FTD estimado = [Mult M0/D1 do coorte 30d (30D/FTD ÷ D1/FTD, incl. D0)] × [MULT D1/FTD do mês corrente] (ex. Google 2,25 × 2,67 = 6,01). <strong>Ticket médio</strong> = Σ FTD$ ÷ nº de FTDs do canal (mês corrente); <strong>% GGR/Dep M0</strong> = margem M0 do canal (GGR M0 ÷ Dep M0, ao vivo) — é ela que corre sobre o M0 estimado de cada canal (Programática pode ficar negativa em M0; canal sem M0 usa o blend growth).
          <strong> Investimento</strong> = spend do canal (mesma fonte do Farol: <code>tbl_performance_daily</code>, com imposto Meta +13,83%) · <strong>FTD total</strong> = valor do 1º depósito do canal na janela · <strong>M0 total proj</strong> = M0 est/FTD × nº de FTDs do canal · <strong>GGR total proj</strong> = M0 total × margem GGR · <strong>ROAS</strong> = GGR total estimado ÷ Investimento.
          Filtrar por faixa recalcula a projeção; Investimento e CAC realizado são do canal inteiro (o spend não é rateado por faixa).
        </div>
      </div>
    </React.Fragment>
  );
}

// ============================================================
// BENCHMARK ENTRE CASAS — Apostou vs concorrentes (Excel estático → benchmark.json)
// Mesmas bases aditivas da query retencaoFaixa_: qtd, ftd($), d0($),
// cd1/cw1/cm0 (contagens retidas) + vd1/vw1/vm0 ($ por janela, excl. D0).
// FTD$$ = Σftd/Σqtd · D0$$ = Σd0/Σqtd · retX(qtd)=Σcdx/Σqtd · retX(val)=Σvdx/Σd0
// ============================================================
const BENCH_HOUSE_ORDER = ['lottu', 'betpontobet', 'donaldbet'];
const benchDM_ = (iso) => { if (!iso) return '—'; const p = String(iso).split('-'); return `${p[2]}/${p[1]}`; };   // dd/mm
const dateRangeLabel_ = (a, b) => (a && b) ? (a === b ? benchDM_(a) : `${benchDM_(a)}–${benchDM_(b)}`) : '—';
function dateBounds_(rows) {
  if (!rows || !rows.length) return null;
  let min = rows[0].date, max = rows[0].date;
  rows.forEach(r => { if (r.date < min) min = r.date; if (r.date > max) max = r.date; });
  return { min, max };
}

// Linhas colunares das casas -> {date, canal, faixa, qtd, ftd, d0, cd1, vd1, cw1, vw1, cm0, vm0}
function benchHouseRows_(bench, hkey) {
  if (!bench || !bench.houses || !bench.houses[hkey]) return [];
  const { dates, canais, faixas } = bench;
  return bench.houses[hkey].rows.map(r => ({
    date: dates[r[0]], canal: canais[r[1]], faixa: faixas[r[2]],
    qtd: r[3], ftd: r[4], d0: r[5], cd1: r[6], vd1: r[7], cw1: r[8], vw1: r[9], cm0: r[10], vm0: r[11],
    dep: r[12] || 0, saq: r[13] || 0, net: r[14] || 0,   // saque/net (só benchmark_net.json)
    // Janela FIXA de 30 dias (dias 1–30). Só existe em builds do benchmark_net com `hasD30` (export Lottu
    // 'turbinado_2026' em diante). Em JSON antigo r[15]/r[16] são undefined → 0, e o toggle de coorte fica escondido.
    cd30: r[15] || 0, vd30: r[16] || 0,
  }));
}
// retencaoFaixa (Apostou, diária) -> mesmo shape, mantendo o dia. ggrM0 = p/ ROAS GGR na aba Ret. Faixa.
function benchApostouRows_(retencaoFaixa) {
  return (retencaoFaixa || []).map(r => {
    // Caixa LÍQUIDO da safra (mesma base "totais da safra" da Lottu): Σ depósitos − Σ saques OBSERVADOS
    // (todo o histórico da coorte, não a janela M0). Vem do BQ via retfaixa (depTot/saqTot).
    const dep = r.depTot || 0, saq = r.saqTot || 0;
    return {
      date: String(r.date), canal: r.canal, faixa: r.faixa, grupo: (r.grupo != null ? r.grupo : null), campanha: (r.campanha != null ? r.campanha : null),
      qtd: r.qtdFtds || 0, ftd: r.ftdTotal || 0, d0: r.depD0 || 0,
      cd1: r.cntD1 || 0, vd1: r.valD1 || 0, vd3: r.valD3 || 0, vd4: r.valD4 || 0, cw1: r.cntW1 || 0, vw1: r.valW1 || 0, cw2: r.cntW2 || 0, vw2: r.valW2 || 0, cd30: r.cntD30 || 0, vd30: r.valD30 || 0, cm0: r.cntM0 || 0, vm0: r.valM0 || 0,
      // Funil D0+D1 (backend v58+). _pass = 0 marca payload ANTIGO (campo ausente) → as taxas saem "—" em vez
      // de 0,0%, que seria lido como "ninguém passou". Sem isso um cache velho mentiria na tela.
      cstd: r.cntStd || 0, cttd: r.cntTtd || 0, cqtd4: r.cntQtd4 || 0,
      // Coorte semanal de CALENDÁRIO (backend v60+): S0 = semana ISO do FTD, S1 = a seguinte. Aba Métricas do dia a dia.
      vs0: r.valS0 || 0, vs1: r.valS1 || 0, cs1: r.cntS1 || 0,
      _pass: (r.cntStd === undefined || r.cntStd === null) ? 0 : 1,
      ggrM0: r.ggrM0 || 0,
      dep, saq, net: dep - saq,
    };
  });
}
function aggBench_(rows, sel) {
  const out = { qtd: 0, ftd: 0, d0: 0, cd1: 0, vd1: 0, vd3: 0, vd4: 0, cw1: 0, vw1: 0, cw2: 0, vw2: 0, cd30: 0, vd30: 0, cm0: 0, vm0: 0, dep: 0, saq: 0, net: 0, cstd: 0, cttd: 0, cqtd4: 0, _pass: 0 };
  const canals = sel.canals || (sel.canal && sel.canal !== 'all' ? [sel.canal] : []);
  (rows || []).forEach(r => {
    // canais específicos têm precedência; senão, scope 'growth' = só mídia paga (exclui social/orgânico/afiliados)
    if (canals.length) { if (!canals.includes(r.canal)) return; }
    else if (sel.scope === 'growth' && !isGrowthCh_(r.canal)) return;
    if (sel.faixa && sel.faixa !== 'all' && r.faixa !== sel.faixa) return;
    if (sel.from && r.date < sel.from) return;
    if (sel.to && r.date > sel.to) return;
    out.qtd += r.qtd; out.ftd += r.ftd; out.d0 += r.d0;
    out.cd1 += r.cd1; out.vd1 += r.vd1; out.vd3 += r.vd3 || 0; out.vd4 += r.vd4 || 0; out.cw1 += r.cw1; out.vw1 += r.vw1; out.cw2 += r.cw2 || 0; out.vw2 += r.vw2 || 0; out.cd30 += r.cd30 || 0; out.vd30 += r.vd30 || 0; out.cm0 += r.cm0; out.vm0 += r.vm0;
    out.dep += r.dep || 0; out.saq += r.saq || 0; out.net += r.net || 0;
    out.cstd += r.cstd || 0; out.cttd += r.cttd || 0; out.cqtd4 += r.cqtd4 || 0; out._pass += r._pass || 0;
  });
  return out;
}
// Bases -> 5 métricas do template. mode 'qtd'|'val' afeta só as colunas de retenção.
function benchMetrics_(a, mode) {
  const ret = (cnt, val) => mode === 'val' ? (a.d0 ? val / a.d0 : null) : (a.qtd ? cnt / a.qtd : null);
  const multF = (acc) => a.ftd ? acc / a.ftd : null;   // depósito acumulado (incl. D0) ÷ valor do FTD
  const d1base = a.d0 + (a.vd1 || 0);                   // nível D1 = D0 + dep do dia 1 (base do toggle "sobre D1")
  const multD1 = (acc) => d1base ? acc / d1base : null; // depósito acumulado ÷ nível D1 (sem D0 na tabela nesse modo)
  const multD0 = (acc) => a.d0 ? acc / a.d0 : null;     // depósito acumulado ÷ DEPÓSITO D0 (toggle "sobre D0")
  return {
    qtd: a.qtd,
    ftdMedio: a.qtd ? a.ftd / a.qtd : null,   // FTD $$ = ticket médio do 1º depósito
    d0Medio: a.qtd ? a.d0 / a.qtd : null,     // Dep D0 Med = Σ D0 ÷ qtd FTDs
    multD0F: multF(a.d0),                      // D0 ÷ FTD
    multD1F: multF(a.d0 + a.vd1),              // (D0 + dia 1) ÷ FTD — acumulado
    // D3 só existe a partir do backend v58 (e nunca no JSON de benchmark). Sem a base, devolve null em vez de
    // cair pro nível D0 — um 1,42x silencioso seria lido como "o D3 não cresceu", que é falso.
    multD3F: a._pass > 0 ? multF(a.d0 + (a.vd3 || 0)) : null,   // (D0 + dias 1–3) ÷ FTD
    multD4F: multF(a.d0 + (a.vd4 || 0)),       // (D0 + dias 1–4) ÷ FTD
    multW1F: multF(a.d0 + a.vw1),              // (D0 + dias 1–7) ÷ FTD
    multW2F: multF(a.d0 + (a.vw2 || 0)),       // (D0 + dias 1–14) ÷ FTD
    multD30F: multF(a.d0 + (a.vd30 || 0)),     // (D0 + dias 1–30) ÷ FTD — janela fixa 30d
    multM0F: multF(a.d0 + a.vm0),              // (D0 + resto do mês do FTD) ÷ FTD
    // Mesmos acúmulos, mas divididos pelo NÍVEL D1 (toggle "sobre D1"): D1 vira a base (=1,00x), sem D0.
    multD1D1: multD1(a.d0 + (a.vd1 || 0)),     // = 1,00x (âncora)
    multD3D1: a._pass > 0 ? multD1(a.d0 + (a.vd3 || 0)) : null,
    multD4D1: multD1(a.d0 + (a.vd4 || 0)),
    multW1D1: multD1(a.d0 + a.vw1),
    multW2D1: multD1(a.d0 + (a.vw2 || 0)),
    multM0D1: multD1(a.d0 + a.vm0),
    // Mesmos acúmulos ÷ DEPÓSITO D0 (toggle "sobre D0"): D0 vira a base (=1,00x, não vai pra tela).
    // Quanto o dinheiro do primeiro dia se multiplicou — não depende do ticket de FTD.
    multD1D0: multD0(a.d0 + (a.vd1 || 0)),
    // D3 tem a MESMA guarda do multD3F: sem a base vd3 (payload < v58, ou o Excel da Lottu, que não exporta
    // janela D3) devolve null → tela mostra "—". Cair no nível D0 seria lido como "o D3 não cresceu".
    multD3D0: a._pass > 0 ? multD0(a.d0 + (a.vd3 || 0)) : null,
    multD4D0: multD0(a.d0 + (a.vd4 || 0)),
    multW1D0: multD0(a.d0 + a.vw1),
    multW2D0: multD0(a.d0 + (a.vw2 || 0)),
    multD30D0: multD0(a.d0 + (a.vd30 || 0)),
    multM0D0: multD0(a.d0 + a.vm0),
    retD1: ret(a.cd1, a.vd1),
    retW1: ret(a.cw1, a.vw1),
    retW2: ret(a.cw2 || 0, a.vw2 || 0),
    retD30: ret(a.cd30 || 0, a.vd30 || 0),   // janela FIXA de 30 dias (toggle Coorte 30d do Benchmark)
    retM0: ret(a.cm0, a.vm0),
    // As DUAS leituras do D1 lado a lado, independentes do toggle Valor/Qtd (o toggle troca retD1; estas não).
    // Base (jogadores) = % dos FTDs que voltaram a depositar no dia 1. Montante = R$ do dia 1 ÷ depósito do D0.
    // A distância entre as duas é a INTENSIDADE de quem volta (montante ÷ base) — o gap central vs a Lottu.
    retQtdD1: a.qtd ? a.cd1 / a.qtd : null,
    retValD1: a.d0 ? a.vd1 / a.d0 : null,
    // Funil de passagem na janela D0+D1, por CONTAGEM DE DEPÓSITOS (inclui o 2º depósito feito no próprio D0).
    // _pass = 0 → payload de backend anterior ao v58, que não traz as contagens: devolve null (tela mostra —).
    passStd: (a._pass > 0 && a.qtd) ? a.cstd / a.qtd : null,          // FTD → 2TD
    passTtd: (a._pass > 0 && a.cstd) ? a.cttd / a.cstd : null,        // 2TD → 3TD
    passQtd: (a._pass > 0 && a.cttd) ? a.cqtd4 / a.cttd : null,       // 3TD → 4TD
    // Alcance acumulado sobre a base de FTD (o "funil" do estudo: 1 → sSTD → sTTD → sQTD).
    reachStd: (a._pass > 0 && a.qtd) ? a.cstd / a.qtd : null,
    reachTtd: (a._pass > 0 && a.qtd) ? a.cttd / a.qtd : null,
    reachQtd: (a._pass > 0 && a.qtd) ? a.cqtd4 / a.qtd : null,
  };
}

const BENCH_SEL_STYLE = { background: 'var(--surface)', border: '1px solid rgba(249,115,22,.5)', color: 'var(--text)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit' };

// Gráfico de multiplicadores por período (2 linhas: Apostou vs a casa). Bench carrega D0/D1/W1/M0 e, desde o
// export 'turbinado_2026' da Lottu, também D30 (janela fixa). O D30 só entra na lista quando o JSON tem `hasD30`
// — senão a linha da Lottu seria uma reta em D0/FTD e pareceria colapso de multiplicador.
// Segue os MESMOS filtros da aba (canal/escopo/faixa/janelas).
// `mat` = dias que a safra precisa ter vivido p/ a métrica estar FECHADA. Safra mais nova que isso entra
// com o acumulado truncado e derruba o multiplicador sem que nada tenha piorado de verdade — por isso o
// eixo é cortado em (fim da janela − mat). O M0 é mês-calendário (horizonte variável), fica sem corte fixo.
const BENCH_MULT_METRICS = [
  { id: 'D0', of: a => a.ftd ? a.d0 / a.ftd : null,             desc: 'D0 ÷ FTD', mat: 0 },
  { id: 'D1', of: a => a.ftd ? (a.d0 + a.vd1) / a.ftd : null,   desc: '(D0 + dia 1) ÷ FTD', mat: 1 },
  { id: 'W1', of: a => a.ftd ? (a.d0 + a.vw1) / a.ftd : null,   desc: '(D0 + dias 1–7) ÷ FTD', mat: 7 },
  { id: 'D30', of: a => a.ftd ? (a.d0 + (a.vd30 || 0)) / a.ftd : null, desc: '(D0 + dias 1–30) ÷ FTD', d30: true, mat: 30 },
  { id: 'M0', of: a => a.ftd ? (a.d0 + a.vm0) / a.ftd : null,   desc: '(D0 + resto do mês) ÷ FTD', mat: null },
];
// Agrega bench rows por PERÍODO (dia/semana), com o mesmo filtro do aggBench_. Só as bases dos 4 mult.
function benchPeriodAgg_(rows, sel, weekly) {
  const canals = sel.canals || [];
  const b = {};
  (rows || []).forEach(r => {
    if (canals.length) { if (!canals.includes(r.canal)) return; }
    else if (sel.scope === 'growth' && !isGrowthCh_(r.canal)) return;
    if (sel.faixa && sel.faixa !== 'all' && r.faixa !== sel.faixa) return;
    if (sel.from && r.date < sel.from) return;
    if (sel.to && r.date > sel.to) return;
    const k = weekly ? weekBinISO_(String(r.date), sel.weekAnchor) : String(r.date);
    const a = b[k] || (b[k] = { qtd: 0, ftd: 0, d0: 0, vd1: 0, vw1: 0, vd30: 0, vm0: 0 });
    a.qtd += r.qtd || 0; a.ftd += r.ftd || 0; a.d0 += r.d0 || 0; a.vd1 += r.vd1 || 0; a.vw1 += r.vw1 || 0; a.vd30 += r.vd30 || 0; a.vm0 += r.vm0 || 0;
  });
  return b;
}
// Média móvel deslizante (ponderada por FTD) sobre buckets DIÁRIOS do bench (saída do benchPeriodAgg_ com weekly=false).
// Cada dia d vira Σ(mult×FTD) ÷ Σ FTD na janela [d−N+1, d] — NÃO a média das razões diárias (distorce em dia de baixo
// volume). Retorna {chaveDisplay: valorMult}: dias (≥ fromISO) no modo diário; no semanal, cada semana = valor da MA no
// seu ÚLTIMO dia. Os dias < fromISO (lead-in agregado a mais) entram só como histórico p/ os 1ºs dias visíveis terem
// janela cheia. `ofFn` = mDef.of (bases → multiplicador).
function benchMovAvg_(dailyBuckets, ofFn, N, weekly, fromISO, weekAnchor) {
  const days = Object.keys(dailyBuckets).sort();
  const floor = days[0] || null;   // 1º dia que o payload trouxe — piso da janela deslizante
  const val = days.map(k => ofFn(dailyBuckets[k]));
  const wt = days.map(k => dailyBuckets[k].ftd || 0);
  const ma = days.map((k, i) => {
    const lo = isoAddDays_(k, -(N - 1));
    // Janela CHEIA obrigatória: começando antes do 1º dia disponível, a média sairia sobre menos dias do
    // que o rótulo promete (mesma armadilha do gráfico da aba Multiplicadores). O extLo acima já estende a
    // busca em N−1 dias, então na prática só os pontos fora da janela visível caem aqui.
    if (floor && lo < floor) return null;
    let num = 0, den = 0, any = false;
    for (let j = i; j >= 0 && days[j] >= lo; j--) {
      const v = val[j], f = wt[j];
      if (v != null && !isNaN(v) && f > 0) { num += v * f; den += f; any = true; }
    }
    return (any && den > 0) ? num / den : null;
  });
  const out = {};
  if (!weekly) {
    days.forEach((k, i) => { if (!fromISO || k >= fromISO) out[k] = ma[i]; });
  } else {
    const lastIdxByWeek = {};   // dias asc → o último i de cada semana é o dia máximo dela (dentro do range visível)
    days.forEach((k, i) => { if (!fromISO || k >= fromISO) lastIdxByWeek[weekBinISO_(k, weekAnchor)] = i; });
    Object.keys(lastIdxByWeek).forEach(ws => { out[ws] = ma[lastIdxByWeek[ws]]; });
  }
  return out;
}
function BenchMultChart({ aptRows, houseRows, houseLabel, canals, scope, faixa, aptFrom, aptTo, houseFrom, houseTo, hasD30 }) {
  const [metric, setMetric] = usePersistedState('rvops:benchsd:chartMult', 'D1');
  const [gran, setGran] = usePersistedState('rvops:benchsd:chartGran', 'week');
  const [maDays, setMaDays] = usePersistedState('rvops:benchsd:chartMA', 0);   // 0 = off · N = janela da média móvel (dias)
  const [hover, setHover] = React.useState(null);
  // Sem D30 nos dois lados o botão some (e um 'D30' persistido cai no default) — nunca plotar reta de D0 disfarçada.
  const metrics = BENCH_MULT_METRICS.filter(m => hasD30 || !m.d30);
  const mDef = metrics.find(m => m.id === metric) || metrics.find(m => m.id === 'D1') || metrics[0];
  const weekly = gran === 'week';
  const maOn = maDays > 0;
  const dmLabel = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? `${m[3]}/${m[2]}` : String(s); };
  // Com MA: agrega em DIÁRIO (piso da janela estendido em N−1 dias p/ os 1ºs dias visíveis terem janela cheia), aplica
  // a deslizante ponderada por FTD e, no Semanal, colapsa por semana. Sem MA: agrega direto no período e o multiplicador
  // sai das bases via mDef.of (aptB/lotB guardam bases). Nos dois casos aptB/lotB = {chave: valor} lido pelo mkVals.
  const extLo = (f) => (maOn && f) ? isoAddDays_(f, -(maDays - 1)) : f;
  // CORTE DE MATURIDADE por métrica: a última safra que pode entrar é a que já fechou o horizonte
  // (D1 = 1 dia, W1 = 7, D30 = 30). Sem isso o D30 das últimas safras entra truncado e a linha CAI no fim
  // do gráfico sem que nada tenha piorado — o eixo passa a mostrar imaturidade, não performance.
  // Aplicado IGUAL aos dois lados (mesmo teto) p/ a comparação continuar honesta.
  const matTo = (t) => (mDef.mat != null && t) ? isoAddDays_(t, -mDef.mat) : t;
  const aptToM = matTo(aptTo), houseToM = matTo(houseTo);
  // Se o corte de maturidade passa do INÍCIO da janela (típico: D30 com a janela default em MTD — o teto
  // maduro recua 30 dias e cai antes do dia 1º), o gráfico ficaria VAZIO. Em vez disso desliza a janela
  // inteira p/ trás pelo mesmo tanto: mesma duração, na região madura. O eixo mostra as datas reais e a
  // legenda avisa — nunca deslocar período em silêncio.
  const matShift = !!(mDef.mat && aptFrom && aptToM && aptFrom > aptToM);
  const shiftF = (f) => (matShift && f) ? isoAddDays_(f, -mDef.mat) : f;
  const aptFromS = shiftF(aptFrom), houseFromS = shiftF(houseFrom);
  // ÂNCORA dos bins de 7 dias = o menor teto maduro dos dois lados. Tem que ser UMA só: se cada lado
  // ancorasse no seu próprio último dia, os bins ficariam deslocados e as duas linhas comparariam
  // períodos diferentes no mesmo ponto do eixo. Ver weekBinISO_.
  const wAnchor = weekly ? ((aptToM && houseToM) ? (aptToM < houseToM ? aptToM : houseToM) : (aptToM || houseToM)) : null;
  const aptB = maOn
    ? benchMovAvg_(benchPeriodAgg_(aptRows, { canals, scope, faixa, from: extLo(aptFromS), to: aptToM, weekAnchor: wAnchor }, false), mDef.of, maDays, weekly, aptFromS, wAnchor)
    : benchPeriodAgg_(aptRows, { canals, scope, faixa, from: aptFromS, to: aptToM, weekAnchor: wAnchor }, weekly);
  const lotB = maOn
    ? benchMovAvg_(benchPeriodAgg_(houseRows, { canals, scope, faixa, from: extLo(houseFromS), to: houseToM, weekAnchor: wAnchor }, false), mDef.of, maDays, weekly, houseFromS, wAnchor)
    : benchPeriodAgg_(houseRows, { canals, scope, faixa, from: houseFromS, to: houseToM, weekAnchor: wAnchor }, weekly);
  const allKeys = Array.from(new Set(Object.keys(aptB).concat(Object.keys(lotB)))).sort();
  const xLabels = allKeys.map(k => weekly ? weekLabel_(k) : dmLabel(k));
  const mkVals = (B) => allKeys.map(k => (k in B) ? (maOn ? B[k] : (B[k] ? mDef.of(B[k]) : null)) : null);
  const HL = houseLabel || 'Lottu';
  let series = [
    { name: 'Apostou', color: '#f97316', values: mkVals(aptB) },
    { name: HL, color: '#60a5fa', values: mkVals(lotB) },
  ].filter(s => s.values.some(v => v != null && !isNaN(v)));

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '10px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Multiplicador</label>
        <span className="slicer-presets">
          {metrics.map(m => (
            <button key={m.id} className={`preset-btn ${mDef.id === m.id ? 'active' : ''}`} onClick={() => setMetric(m.id)} title={`Multiplicador ${m.id}/FTD = ${m.desc}`}>{m.id}</button>
          ))}
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Visão</label>
        <span className="slicer-presets">
          <button className={`preset-btn ${gran === 'day' ? 'active' : ''}`} onClick={() => setGran('day')} title="Uma coluna por dia de FTD">Diário</button>
          <button className={`preset-btn ${gran === 'week' ? 'active' : ''}`} onClick={() => setGran('week')} title="Colapsa em semanas (seg–dom)">Semanal</button>
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média móvel</label>
        <span className="slicer-presets">
          <button className={`preset-btn ${maDays === 0 ? 'active' : ''}`} onClick={() => setMaDays(0)} title="Sem média móvel (valor do período)">Off</button>
          {[7, 14, 30].map(d => (
            <button key={d} className={`preset-btn ${maDays === d ? 'active' : ''}`} onClick={() => setMaDays(d)} title={`Média móvel de ${d} dias (janela deslizante diária, ponderada por FTD) — aplicada às duas linhas`}>{d}d</button>
          ))}
        </span>
        <input type="number" min="2" max="60" value={maDays || ''} placeholder="dias"
          onChange={e => { const v = parseInt(e.target.value, 10); setMaDays(isNaN(v) ? 0 : Math.max(0, Math.min(60, v))); }}
          title="Escolher N dias da média móvel (janela deslizante)"
          style={{ width: '62px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 6px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit' }} />
      </span>
    </div>
  );
  if (!series.length || !allKeys.length) return <React.Fragment>{controls}<div className="ch-note">Sem dados p/ o gráfico neste recorte.</div></React.Fragment>;

  const n = xLabels.length;
  const slotW = n > 20 ? 72 : n > 10 ? 118 : 210;
  const padL = 60, padR = 30, padT = 32, padB = 60, plotH = 480;
  const W = Math.max(1500, padL + padR + (n === 1 ? slotW : (n - 1) * slotW));
  const H = padT + plotH + padB;
  const plotW = W - padL - padR;
  const xOf = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const allVals = series.flatMap(s => s.values).filter(v => v != null && !isNaN(v));
  const yMaxRaw = allVals.length ? Math.max.apply(null, allVals) : 1;
  const yMinRaw = allVals.length ? Math.min.apply(null, allVals) : 1;
  const ySpan = Math.max(yMaxRaw - yMinRaw, 0.3);
  const yPad = ySpan * 0.18;
  const domMin = Math.max(Math.min(1, yMinRaw), yMinRaw - yPad);
  const domMax = Math.max(yMaxRaw + yPad, domMin + 0.2);
  const yOf = (v) => padT + (1 - (v - domMin) / (domMax - domMin)) * plotH;
  const gridVals = Array.from({ length: 5 }, (_, i) => domMin + (domMax - domMin) * i / 4);
  const lblEvery = Math.ceil(n / 12);
  const nonNull = series.reduce((a, s) => a + s.values.filter(v => v != null && !isNaN(v)).length, 0) || 1;
  const labelStride = Math.max(1, Math.ceil(nonNull / 42));
  const linePath = (vals) => { let d = '', pen = false; vals.forEach((v, i) => { if (v == null || isNaN(v)) { pen = false; return; } d += (pen ? ' L' : ' M') + xOf(i).toFixed(1) + ',' + yOf(v).toFixed(1); pen = true; }); return d.trim(); };
  const yTitle = maOn ? `Mult ${mDef.id}/FTD · MM ${maDays}d` : `Mult ${mDef.id}/FTD`;
  const tipHead = (s) => `${s.name} · Mult ${mDef.id}/FTD`;
  const tipSub = (i, v) => `${weekly ? 'Semana de ' : ''}${xLabels[i]} · ${fmtMultiple(v)}`;
  return (
    <React.Fragment>
      {controls}
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center', margin: '2px 0 8px' }}>
        {series.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ width: '14px', height: '3px', background: s.color, borderRadius: '2px', display: 'inline-block' }} />{s.name}
          </span>
        ))}
      </div>
      <div className="table-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ width: '100%', maxWidth: W, minWidth: Math.min(W, 700), height: 'auto', display: 'block', margin: '0 auto' }} preserveAspectRatio="xMidYMid meet">
          {gridVals.map((v, i) => (
            <g key={`g${i}`}>
              <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '2 4'} />
              <text x={padL - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#cfcfcf">{fmtMultiple(v)}</text>
            </g>
          ))}
          {xLabels.map((lb, i) => (i % lblEvery === 0) ? <text key={`x${i}`} x={xOf(i)} y={padT + plotH + 18} textAnchor="middle" fontSize="10.5" fill="#cfcfcf">{lb}</text> : null)}
          <text x={4} y={14} fontSize="10" fill="#aaaaaa">{yTitle}</text>
          {series.map((s, si) => (
            <g key={`s${si}`}>
              <path d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (v != null && !isNaN(v)) ? (
                <g key={i}>
                  <circle cx={xOf(i)} cy={yOf(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="1.8" />
                  {(i % labelStride === 0) && <text x={xOf(i)} y={yOf(v) - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill={s.color}>{fmtMultiple(v)}</text>}
                  <circle cx={xOf(i)} cy={yOf(v)} r="14" fill="transparent" style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseEnter={() => setHover({ si, i })} onMouseLeave={() => setHover(null)} />
                </g>
              ) : null)}
            </g>
          ))}
          {hover && series[hover.si] && series[hover.si].values[hover.i] != null && !isNaN(series[hover.si].values[hover.i]) && (() => {
            const s = series[hover.si], v = s.values[hover.i], cx = xOf(hover.i), cy = yOf(v);
            const l1 = tipHead(s), l2 = tipSub(hover.i, v);
            const bw = Math.max(l1.length, l2.length) * 9 + 32, bh = 64;
            let tx = Math.max(padL, Math.min(cx - bw / 2, W - padR - bw));
            let ty = cy - bh - 18; if (ty < padT) ty = cy + 20;
            return (
              <g pointerEvents="none">
                <circle cx={cx} cy={cy} r="6.5" fill={s.color} stroke="#000000" strokeWidth="2.5" />
                <rect x={tx} y={ty} width={bw} height={bh} rx="9" fill="#000000" fillOpacity="1" stroke={s.color} strokeWidth="2.5" />
                <text x={tx + 15} y={ty + 27} fontSize="17" fontWeight="700" fill="#ffffff">{l1}</text>
                <text x={tx + 15} y={ty + 49} fontSize="15" fill="#f2f2f2">{l2}</text>
              </g>
            );
          })()}
        </svg>
      </div>
      <div className="ch-note">
        <strong>Multiplicador {mDef.id}/FTD por {weekly ? 'semana' : 'dia'} de FTD</strong> — <span style={{ color: '#f97316' }}>laranja = Apostou</span>, <span style={{ color: '#60a5fa' }}>azul = {HL}</span>. Cada ponto = depósito acumulado (incl. D0) até a janela ÷ FTD, agregado no período (mesmo recorte de canal/faixa/janela das tabelas).{maOn && <React.Fragment>{' '}<em style={{ color: 'var(--text-dim)' }}>Média móvel de {maDays} dias (nas duas linhas): janela deslizante ponderada (Σ mult×FTD ÷ Σ FTD) dos últimos {maDays} dias, calculada em dias e {weekly ? 'amostrada por semana (valor no último dia da semana)' : 'plotada por dia'} — suaviza o ruído. Ponto com janela INCOMPLETA não é plotado: média sobre menos dias que o rótulo promete é suavização falsa.</em></React.Fragment>}{weekly && <React.Fragment>{' '}<em style={{ color: 'var(--text-dim)' }}>Semana = bloco de 7 dias terminando na ÚLTIMA safra madura (não na semana-calendário), então o ponto mais recente cobre exatamente a janela das tabelas.</em></React.Fragment>}{mDef.mat != null && mDef.mat > 0 && <React.Fragment>{' '}<em style={{ color: 'var(--text-dim)' }}>Maturidade: só entram safras que já fecharam os {mDef.mat} dia{mDef.mat > 1 ? 's' : ''} do {mDef.id} — coorte nova entraria truncada e derrubaria a curva no fim do gráfico sem nada ter piorado.</em></React.Fragment>}{matShift && <React.Fragment>{' '}<em style={{ color: 'var(--accent-yellow)' }}>A janela selecionada é toda imatura p/ o {mDef.id}: o gráfico deslocou o período {mDef.mat} dias p/ trás (mesma duração) — confira as datas no eixo.</em></React.Fragment>}{mDef.id === 'M0' && <React.Fragment>{' '}<strong>⚠ M0 = "resto do mês"</strong>: horizonte variável, coorte recente entra truncada (sem corte fixo possível).</React.Fragment>} As duas linhas seguem a MESMA janela e a MESMA âncora (slicer único da aba).
      </div>
    </React.Fragment>
  );
}

// View genérica do Benchmark — parametrizada por houseOrder + sameday (p/ reusar na aba Same-day).
// pkey = prefixo de persistência (filtros sobrevivem a refresh/troca de aba).
function BenchmarkView({ retencaoFaixa, benchmark, houseOrder, sameday, title, subtitle, pkey, apostouHouse, withNet, defaultMode = 'qtd', multChart = false }) {
  // fromBench = Apostou vem do PRÓPRIO JSON (que tem saque/net), não do BQ (aba net Apostou vs Lottu).
  // Caso contrário, Apostou puxa o período próprio (jan–jun) via modo leve only=retfaixa do BQ.
  const fromBench = !!apostouHouse;
  const [aptFetch, setAptFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (fromBench || !benchmark || !ENDPOINT_URL) return;
    const fullFrom = benchmark.dateMin;   // = span exato das casas (diário)
    const fullTo = benchmark.dateMax;
    setAptFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${fullFrom}&to=${fullTo}&only=retfaixa${sameday ? '&sameday=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setAptFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setAptFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [benchmark, sameday, fromBench]);

  const aptRows = React.useMemo(() => {
    if (fromBench) return benchHouseRows_(benchmark, apostouHouse);
    // No sameday não cai no fallback global (que é coorte cheia) — espera o fetch.
    const src = (aptFetch.rows && aptFetch.rows.length) ? aptFetch.rows : (sameday ? [] : retencaoFaixa);
    return benchApostouRows_(src);
  }, [fromBench, benchmark, apostouHouse, aptFetch.rows, retencaoFaixa, sameday]);
  const houseRowsMap = React.useMemo(() => {
    const m = {}; houseOrder.forEach(h => { m[h] = benchHouseRows_(benchmark, h); }); return m;
  }, [benchmark]);

  const aptBounds = React.useMemo(() => dateBounds_(aptRows), [aptRows]);
  const houseMin = (benchmark && benchmark.dateMin) || null;
  const houseMax = (benchmark && benchmark.dateMax) || null;
  const canalOptions = (benchmark && benchmark.canais) || [];
  const faixaOptions = (benchmark && benchmark.faixas) || FAIXA_LIST;

  // Filtros persistidos por aba (canal/escopo/faixa/modo sobrevivem a refresh + troca de aba).
  const [canals, setCanals] = usePersistedState(`rvops:${pkey}:canals`, []);    // [] = Todos (cai no escopo)
  const [scope, setScope] = usePersistedState(`rvops:${pkey}:scope`, 'all');   // 'all' (Total Casa) | 'growth' (só mídia paga)
  const [faixa, setFaixa] = usePersistedState(`rvops:${pkey}:faixa`, 'all');
  const [mode, setMode] = usePersistedState(`rvops:${pkey}:mode`, defaultMode); // 'qtd' (% redepositou) | 'val' (% sobre D0)
  const [cash, setCash] = usePersistedState(`rvops:${pkey}:cash`, 'bruto');     // 'bruto' (retenção) | 'liquido' (caixa net) — só withNet
  const netMode = withNet && cash === 'liquido';
  // Toggle de COORTE (igual ao da aba Multiplicadores): 'cal' = M0 (depósito do FTD até o FIM do mês-calendário,
  // janela de tamanho variável) · 'c30' = D30 (janela FIXA de 30 dias corridos do FTD). O D30 da Lottu só existe
  // desde o export 'turbinado_2026' (`hasD30`); sem ele o toggle nem aparece.
  const hasD30 = !!(benchmark && benchmark.hasD30);
  const [cohortP, setCohortP] = usePersistedState(`rvops:${pkey}:cohort`, 'cal');
  const cohort = hasD30 && !netMode && cohortP === 'c30';
  // JANELA ÚNICA: um só slicer de data, aplicado IGUAL aos dois lados. Antes eram dois (Apostou / Demais
  // Casas) e dava pra comparar janelas diferentes sem perceber — a comparação só é honesta no mesmo período.
  const [from, setFrom] = React.useState(null);
  const [to, setTo] = React.useState(null);

  // Teto da janela = o MENOR dataMax dos dois lados (BQ da Apostou e Excel da Lottu param em dias diferentes):
  // acima dele um dos lados ficaria sem dado e a "mesma janela" viraria mentira.
  // Corte de MATURIDADE do modo coorte: uma safra só fecha os 30 dias se houver dado até FTD+30 → o último dia
  // de FTD utilizável é dataMax − 30, também pelo lado mais atrasado. Vira o `max` dos inputs E um clamp no
  // agregador, p/ um valor remanescente de outro modo não entrar truncado sem ninguém ver.
  const MAT30 = 30;
  const aptMax = (aptBounds && aptBounds.max) || null;
  const dataMaxBoth = (aptMax && houseMax) ? (aptMax < houseMax ? aptMax : houseMax) : (houseMax || aptMax);
  const lagSide = (aptMax && houseMax && aptMax !== houseMax) ? (aptMax < houseMax ? 'apt' : 'house') : null;   // quem tem dado mais curto (rótulo montado no render, housesLabel só existe abaixo)
  const cap = (cohort && dataMaxBoth) ? isoAddDays_(dataMaxBoth, -MAT30) : null;
  const winMax = cap || dataMaxBoth;
  const toEff = (winMax && to && to > winMax) ? winMax : to;

  // default: MTD (mês-calendário mais recente com dado dos dois lados). No modo COORTE vira o último ciclo de
  // 30 dias FECHADO (mesma ideia da Multiplicadores) — abrir em MTD ali mostraria só safra imatura e o D30
  // sairia truncado. `touched` para de re-anchorar depois que o usuário mexe na data (o dataMax da Apostou só
  // aparece quando o fetch do BQ cai, e sem isso a janela editada pulava de volta pro default nessa hora);
  // trocar de modo zera o touched, porque aí o re-anchor é justamente o que se espera.
  const touched = React.useRef(false);
  const lastCohort = React.useRef(cohort);
  React.useEffect(() => {
    if (lastCohort.current !== cohort) { lastCohort.current = cohort; touched.current = false; }
    if (!dataMaxBoth || touched.current) return;
    if (cohort) { const c = isoAddDays_(dataMaxBoth, -MAT30); setTo(c); setFrom(isoAddDays_(c, -(MAT30 - 1))); }
    else { setFrom(dataMaxBoth.slice(0, 7) + '-01'); setTo(dataMaxBoth); }
  }, [dataMaxBoth, cohort]);
  const editFrom = (v) => { touched.current = true; setFrom(v); };
  const editTo = (v) => { touched.current = true; setTo(v); };

  const aptAgg = aggBench_(aptRows, { canals, scope, faixa, from, to: toEff });
  const apt = benchMetrics_(aptAgg, mode);
  const houses = houseOrder.map(h => {
    const agg = aggBench_(houseRowsMap[h], { canals, scope, faixa, from, to: toEff });
    return {
      key: h,
      label: (benchmark && benchmark.houses && benchmark.houses[h] && benchmark.houses[h].label) || h,
      m: benchMetrics_(agg, mode), agg,
    };
  });
  // Rótulo do escopo de canal p/ os títulos das tabelas
  const canalLabel = canals.length ? (canals.length <= 2 ? canals.join(' + ') : canals.length + ' canais') : (scope === 'growth' ? 'Canais Growth' : 'todos os canais');
  // Título da 2ª tabela: 1 casa só = o nome dela; várias = "Demais Casas"
  const housesLabel = houseOrder.length === 1 ? (houses[0] && houses[0].label || 'Casa') : 'Demais Casas';

  const fmtRet = (x) => fmtPct(x, 1);   // sempre % (Valor pode passar de 100%); o toggle Qtd/Valor diz qual base
  const retHdr = 'Ret %';
  const selStyle = BENCH_SEL_STYLE;
  const lblStyle = { fontSize: '11px', color: 'var(--text-muted)' };
  // Cor de fundo das colunas de retenção (amarelinho) p/ separar do resto.
  const RET_BG = 'rgba(250,204,21,0.10)';
  const retTd = { background: RET_BG };
  const retTdL = { background: RET_BG, borderLeft: '2px solid rgba(250,204,21,0.45)' };
  // A última janela da tabela segue o toggle de coorte: M0 (resto do mês) ou D30 (30 dias corridos).
  const wLbl = cohort ? 'D30' : 'M0';
  const benchRowCells = (m) => [
    <td key="q">{fmtQty(m.qtd)}</td>,
    <td key="ftd">{fmtBRL(m.ftdMedio)}</td>,
    <td key="d0">{fmtBRL(m.d0Medio)}</td>,
    <td key="d0f">{fmtMultiple(m.multD0F)}</td>,
    <td key="d1f">{fmtMultiple(m.multD1F)}</td>,
    // D3 só existe do lado Apostou: o Excel da Lottu não exporta a janela D0+1–3 (não há ret_val_d3), então a
    // célula dela sai "—" (guarda `_pass` no benchMetrics_) em vez de um número reconstruído. Nota explica.
    <td key="d3f" title={m.multD3F == null ? 'Sem base D3 nesta fonte (o export da Lottu não traz a janela de 3 dias).' : undefined}>{fmtMultiple(m.multD3F)}</td>,
    <td key="w1f">{fmtMultiple(m.multW1F)}</td>,
    <td key="m0f">{fmtMultiple(cohort ? m.multD30F : m.multM0F)}</td>,
    <td key="r1" style={retTdL}>{fmtRet(m.retD1)}</td>,
    <td key="rw1" style={retTd}>{fmtRet(m.retW1)}</td>,
    <td key="rm0" style={retTd}>{fmtRet(cohort ? m.retD30 : m.retM0)}</td>,
  ];
  const retTh = { background: 'rgba(250,204,21,0.20)' };
  const retThL = { background: 'rgba(250,204,21,0.20)', borderLeft: '2px solid rgba(250,204,21,0.55)' };
  const head = (
    <thead><tr>
      <th>Casa</th><th>Qtd FTD</th><th>FTD $$</th><th>Dep D0 Med</th>
      <th>Mult D0/FTD</th><th>Mult D1/FTD</th><th title="(D0 + dias 1–3) ÷ FTD. Só a Apostou tem essa janela — o export da Lottu não traz D3.">Mult D3/FTD</th><th>Mult W1/FTD</th><th>{`Mult ${wLbl}/FTD`}</th>
      <th style={retThL}>{`D1 ${retHdr}`}</th><th style={retTh}>{`W1 ${retHdr}`}</th><th style={retTh}>{`${wLbl} ${retHdr}`}</th>
    </tr></thead>
  );

  // Modo LÍQUIDO (aba net): caixa da safra. Net = depósito − saque (totais da safra, não por janela).
  const div_ = (x, y) => (y ? x / y : null);
  const netRowCells = (a) => [
    <td key="q">{fmtQty(a.qtd)}</td>,
    <td key="ftd">{fmtBRL(div_(a.ftd, a.qtd))}</td>,
    <td key="dep">{fmtBRL(a.dep)}</td>,
    <td key="net">{fmtBRL(a.net)}</td>,
    <td key="netftd">{fmtBRL(div_(a.net, a.qtd))}</td>,
    <td key="multnet">{fmtMultiple(div_(a.net, a.ftd))}</td>,
    <td key="saqp" style={{ background: 'rgba(248,113,113,0.10)' }}>{fmtPct(div_(a.saq, a.dep), 1)}</td>,
  ];
  const netHead = (
    <thead><tr>
      <th>Casa</th><th>Qtd FTD</th><th>FTD $$</th><th>Depósito</th><th>Net</th><th>Net/FTD</th><th>Mult Net/FTD$</th>
      <th style={{ background: 'rgba(248,113,113,0.18)' }}>Saque %</th>
    </tr></thead>
  );
  const tableHead = netMode ? netHead : head;
  const aptCells = netMode ? netRowCells(aptAgg) : benchRowCells(apt);

  if (!benchmark) {
    return (
      <React.Fragment>
        <div className="tab-header"><div><h1>{title}</h1>
          <div className="subtitle">Carregando dados…</div></div></div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>{title}</h1>
          <div className="subtitle">{subtitle}</div>
        </div>
      </div>

      {/* `slicer` = estilo dos controles (input/select laranja) · `slicer-ruler` = régua que CONGELA abaixo da
          barra de abas ao rolar (mesma das outras abas), pra não ter que voltar ao topo pra trocar filtro. */}
      <div className="slicer slicer-ruler slicer-tight" style={{ rowGap: '8px', columnGap: '12px' }}>
        <div className="slicer-group">
          <label style={lblStyle}>Canal</label>
          <ChannelMultiSelect options={canalOptions} selected={canals} onChange={setCanals} />
          <div className="slicer-presets">
            <button className={`preset-btn ${scope === 'growth' ? 'active' : ''}`} onClick={() => setScope('growth')} title="Universo = só mídia paga (Meta, Google, TikTok, Kwai, Programática). Define o que 'Todos' agrega.">Growth</button>
            <button className={`preset-btn ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')} title="Universo = casa toda.">Total Casa</button>
          </div>
        </div>
        <div className="slicer-group">
          <label style={lblStyle}>Faixa FTD</label>
          <select value={faixa} onChange={e => setFaixa(e.target.value)} style={selStyle}>
            <option value="all">Todas</option>
            {faixaOptions.map((f, i) => <option key={i} value={f}>{fxLabel_(f)}</option>)}
          </select>
        </div>
        {withNet && (
          <div className="slicer-group">
            <label style={lblStyle}>Caixa</label>
            <div className="slicer-presets">
              <button className={`preset-btn ${cash === 'bruto' ? 'active' : ''}`} onClick={() => setCash('bruto')} title="BRUTO: curva de retenção do depósito (D0→M0), sem descontar saques.">Bruto</button>
              <button className={`preset-btn ${cash === 'liquido' ? 'active' : ''}`} onClick={() => setCash('liquido')} title="LÍQUIDO: caixa da safra = depósito − saque (net_cash). Mostra o dinheiro que ficou.">Líquido</button>
            </div>
          </div>
        )}
        {!netMode && hasD30 && (
          <div className="slicer-group">
            <label style={lblStyle}>Coorte</label>
            <div className="slicer-presets">
              <button className={`preset-btn ${!cohort ? 'active' : ''}`} onClick={() => setCohortP('cal')} title="Última janela = M0: do dia do FTD até o FIM do mês-calendário. Janela de tamanho variável (safra do dia 1 tem ~30 dias, a do dia 28 tem ~3) — é a visão histórica da aba.">Calendário</button>
              <button className={`preset-btn ${cohort ? 'active' : ''}`} onClick={() => setCohortP('c30')} title="Última janela = D30: 30 dias corridos a partir do FTD, igual dos dois lados. Só safras que já fecharam os 30 dias (as datas travam em dataMax − 30 automaticamente)."> Coorte 30d</button>
            </div>
          </div>
        )}
        {!netMode && (
          <div className="slicer-group">
            <label style={lblStyle}>Retenção</label>
            <div className="slicer-presets">
              <button className={`preset-btn ${mode === 'val' ? 'active' : ''}`} onClick={() => setMode('val')} title="Retenção por VALOR: $ depositado na janela ÷ depósito do D0 (multiplicador)">Valor</button>
              <button className={`preset-btn ${mode === 'qtd' ? 'active' : ''}`} onClick={() => setMode('qtd')} title="Retenção por QUANTIDADE: % dos FTDs que voltaram a depositar na janela">Qtd</button>
            </div>
          </div>
        )}
        <div className="slicer-group">
          <label style={lblStyle} title={`Uma janela só, aplicada igual a Apostou e ${housesLabel}.`}>Período</label>
          <input type="date" value={from || ''} min={houseMin || undefined} max={toEff || winMax || undefined} onChange={e => editFrom(e.target.value)} />
          <span className="slicer-arrow">→</span>
          <input type="date" value={toEff || ''} min={from || houseMin || undefined} max={winMax || undefined} onChange={e => editTo(e.target.value)}
            title={`Uma janela só, aplicada igual a Apostou e ${housesLabel}. Teto = ${winMax || '—'}${cap ? ' (dataMax − 30, p/ a coorte de 30d estar fechada)' : ''}.`} />
        </div>
      </div>

      <div className="support">
        <div className="support-title">Apostou · {dateRangeLabel_(from, toEff)}{cohort ? ' · coorte 30d (safras fechadas)' : ''} · {canalLabel} · {faixa === 'all' ? 'todas as faixas' : fxLabel_(faixa)}{aptFetch.loading ? ' · carregando BQ…' : ''}{aptFetch.error ? ' · erro (usando janela global)' : ''}</div>
        <div className="table-scroll"><table className="ch-table">
          {tableHead}
          <tbody>
            <tr>
              <td className="ch-name">Apostou</td>
              {aptCells}
            </tr>
          </tbody>
        </table></div>
      </div>

      <div className="support">
        <div className="support-title">{housesLabel} · {dateRangeLabel_(from, toEff)}{cohort ? ' · coorte 30d (safras fechadas)' : ''} · {canalLabel} · {faixa === 'all' ? 'todas as faixas' : fxLabel_(faixa)}</div>
        <div className="table-scroll"><table className="ch-table">
          {tableHead}
          <tbody>
            {houses.map((h) => (
              <tr key={h.key}>
                <td className="ch-name">{h.label}</td>
                {netMode ? netRowCells(h.agg) : benchRowCells(h.m)}
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="ch-note">
          {netMode ? (
            <React.Fragment>
              <strong>Modo LÍQUIDO (caixa da safra).</strong> <strong>Depósito</strong> = Σ depósito da safra · <strong>Net</strong> = depósito − saque (net_cash) = dinheiro que ficou · <strong>Net/FTD</strong> = net ÷ nº de FTDs · <strong>Mult Net/FTD$</strong> = net ÷ valor depositado no FTD · <strong style={{ background: 'rgba(248,113,113,0.25)', padding: '0 4px', borderRadius: '3px' }}>Saque %</strong> = saque ÷ depósito.
              Net/saque são <strong>totais da safra</strong> (Σ depósitos − Σ saques observados, não por janela D0/D1/W1) — por isso o modo líquido não tem a curva de retenção; troque pra <strong>Bruto</strong> p/ ver D0→M0. <strong>Apostou</strong> vem do BQ ao vivo (mesma fonte da Multiplicadores e Retenção); <strong>Lottu</strong> do Excel.
            </React.Fragment>
          ) : (
            <React.Fragment>
              <strong>Qtd FTD</strong> = nº de 1ºs depósitos · <strong>FTD $$</strong> = ticket médio do FTD (Σ FTD ÷ qtd) · <strong>Dep D0 Med</strong> = depósito médio no D0 (Σ D0 ÷ qtd).
              <strong> Mult X/FTD</strong> = depósito acumulado (incluindo o D0) até a janela ÷ valor do FTD: D0/FTD · (D0+dia 1)/FTD · (D0+dias 1–3)/FTD · (D0+dias 1–7)/FTD · {cohort ? '(D0+dias 1–30)/FTD' : '(D0+resto do mês)/FTD'}.
              <strong> O Mult D3 da {housesLabel} sai "—"</strong>: o export dela não traz a janela de 3 dias (não há <code>ret_val_d3</code>) — pra preencher, pedir a coluna no próximo export.
              <strong> D1/W1/{wLbl} Ret</strong> (colunas <span style={{ background: 'rgba(250,204,21,0.25)', padding: '0 4px', borderRadius: '3px' }}>amarelas</span>) = retenção acumulada vs D0 (D1 = dia seguinte · W1 = dias 1–7 · {cohort ? 'D30 = dias 1–30' : 'M0 = resto do mês do FTD'}).
              No modo <strong>Valor</strong> = $ depositado na janela ÷ depósito do D0 em % (exclui o D0; pode passar de 100%); no modo <strong>Qtd</strong> = % dos FTDs que voltaram a depositar.
              {fromBench ? <span> Os dois lados vêm das planilhas faixa_diaria.</span> : <span> <strong>Apostou via BigQuery ao vivo</strong> (mesma fonte da aba Multiplicadores e Retenção); {housesLabel} via Excel.</span>}
              {sameday ? <strong> Coorte SAME-DAY: só FTDs que depositaram no mesmo dia do cadastro (dos dois lados). </strong> : ''}
              {cohort ? (
                <React.Fragment>
                  {' '}<strong>Coorte 30d:</strong> a última janela é <strong>D30 = 30 dias corridos do FTD</strong>, do mesmo tamanho nos dois lados — é a comparação apples-to-apples (o M0 mistura safra de 30 dias com safra de 3).
                  A janela trava em <strong>dataMax − 30 = {cap ? benchDM_(cap) : '—'}</strong>, então só entram safras que JÁ fecharam os 30 dias.
                  <strong> D30 &gt; M0 por construção</strong> (janela maior na média) — não comparar o número de um modo com o do outro.
                </React.Fragment>
              ) : (
                <React.Fragment><strong> ⚠ Abre em MTD (mês corrente) por padrão</strong> — mês corrente ainda imaturo (M0 = "resto do mês" trunca coortes recentes){hasD30 ? '; o toggle Coorte 30d resolve isso' : ''}.</React.Fragment>
              )}
              {' '}<strong>Período único:</strong> o slicer de data vale igual para os dois lados — não dá pra desalinhar as janelas.
              {lagSide ? <span> O teto ({winMax ? benchDM_(winMax) : '—'}) segue o lado com dado mais curto (<strong>{lagSide === 'apt' ? 'Apostou' : housesLabel}</strong>, até {benchDM_(dataMaxBoth)}{cohort ? ' antes do corte de maturidade' : ''}) — acima dele um dos lados ficaria sem dado.</span> : ''}
            </React.Fragment>
          )}
        </div>
      </div>

      {multChart && (
        <div className="support">
          <div className="support-title">Evolução do multiplicador · Apostou vs {housesLabel}</div>
          <BenchMultChart aptRows={aptRows} houseRows={houseRowsMap[houseOrder[0]]} houseLabel={houses[0] && houses[0].label}
            canals={canals} scope={scope} faixa={faixa} hasD30={hasD30}
            aptFrom={from} aptTo={toEff} houseFrom={from} houseTo={toEff} />
        </div>
      )}
    </React.Fragment>
  );
}
// Aba Benchmark Lottu — Apostou (BQ ao vivo) vs Lottu (Excel). NÃO é same-day (nem de um lado nem do
// outro): a coorte é CHEIA dos dois. Apostou vem do only=retfaixa SEM &sameday=1; Lottu do benchmark_net.json
// (rebuild do 'lottubet nosameday'). Bruto = retenção/multiplicadores; Líquido = caixa da safra (Σ dep − Σ saque
// observados), saque da Apostou vem do retfaixa (depTot/saqTot).
function NetBenchTab({ benchmarkNet, retencaoFaixa }) {
  return <BenchmarkView retencaoFaixa={retencaoFaixa} benchmark={benchmarkNet}
    houseOrder={['lottu']} sameday={false} withNet={true} pkey="benchsd" defaultMode="val" multChart={true}
    title="Benchmark Lottu"
    subtitle="Apostou (BQ ao vivo · coorte cheia) vs Lottu (Excel) — ticket de FTD, depósito e caixa líquido (dep − saque) por faixa e canal · slicers Coorte (Calendário/30d) e Bruto/Líquido" />;
}

// Aba FAROL — visão consolidada: todos os indicadores em hero cards (vs M-1 e vs BP), em 4 grupos.
// Multiplicador de projeção de fechamento p/ uma janela MTD parcial: dias-do-mês ÷ dias-decorridos.
// Só projeta quando a janela começa no dia 1 e termina antes do fim do mês (mesmo mês-calendário).
// Fora disso (janelas rolantes 7/14/21/28d, mês fechado, intervalo custom) → null = sem trend.
function monthCloseMult_(range) {
  if (!range || !range.from || !range.to) return null;
  const [fy, fm, fd] = String(range.from).split('-').map(Number);
  const [ty, tm, td] = String(range.to).split('-').map(Number);
  if (fy !== ty || fm !== tm || fd !== 1) return null;     // não é MTD a partir do dia 1, no mesmo mês
  const daysInMonth = new Date(ty, tm, 0).getDate();        // tm é 1-based → new Date(y, m, 0) = último dia do mês m
  if (!(td > 0) || td >= daysInMonth) return null;          // mês já completo na janela → nada a projetar
  return daysInMonth / td;
}

// Reaproveita os cards do M (backend) + as métricas derivadas de buildFarolMetrics_ (farol).
// Trend (projeção de fechamento): volumes ADITIVOS (Investimento, FTD, DEP M0, Depósitos, GGR) via run-rate;
// Rollover via razão dos COMPONENTES projetados. Demais razões (ROAS, CAC, Tkt, retenção, %/Dep) sem trend.
// Multiplicador = ggrTrend/ggr do backend (mesma base do card "Close Trend GGR"), com fallback pra janela.
// Monta os 4 grupos de cards do Farol — cada card já com trend (projeção de fechamento) e M-1 ajustado.
// FONTE ÚNICA: a aba Farol E o export de Excel consomem daqui, pra os números nunca divergirem.
// Agrega o payload.farolSpark (semana × canal, 2 fontes) no escopo do chFilter e deriva a SÉRIE das 4 semanas
// por KPI (mesmas fórmulas dos cards). Só métricas de FLUXO — Dep M0/ROAS Dep M0/Retenção não entram (maturação).
// Retorna { __weeks:[...], invest:[4], roasFtd:[4], depTotal:[4], ... } com nulls onde a semana não tem dado.
function buildFarolSpark_(spark, chFilter) {
  if (!spark || !spark.weeks || !spark.weeks.length) return null;
  const sel = chList_(chFilter);
  const inSel = sel.length ? (ch) => sel.indexOf(ch) >= 0
    : (chFilter && chFilter.scope === 'growth') ? (ch) => isGrowthCh_(ch) : () => true;
  const weeks = spark.weeks, wIdx = {};
  weeks.forEach((w, i) => { wIdx[w] = i; });
  const P = weeks.map(() => ({ spend: 0, ftdQty: 0, ftdAmount: 0, depD0: 0, reg: 0, n: 0 }));
  const H = weeks.map(() => ({ dep: 0, qtdDep: 0, ngr: 0, turnover: 0, bonus: 0, freespin: 0, n: 0 }));
  (spark.perf || []).forEach(r => { const i = wIdx[r.week]; if (i == null || !inSel(r.channel)) return; const a = P[i];
    a.spend += r.spend || 0; a.ftdQty += r.ftdQty || 0; a.ftdAmount += r.ftdAmount || 0; a.depD0 += r.depD0 || 0; a.reg += r.reg || 0; a.n++; });
  (spark.house || []).forEach(r => { const i = wIdx[r.week]; if (i == null || !inSel(r.channel)) return; const a = H[i];
    a.dep += r.dep || 0; a.qtdDep += r.qtdDep || 0; a.ngr += r.ngr || 0; a.turnover += r.turnover || 0; a.bonus += r.bonus || 0; a.freespin += r.freespin || 0; a.n++; });
  const arr = (fn) => weeks.map((_, i) => fn(P[i], H[i]));
  return {
    __weeks: weeks,
    invest:      arr((p) => p.n ? p.spend : null),
    ftdAmount:   arr((p) => p.n ? p.ftdAmount : null),
    ftdQty:      arr((p) => p.n ? p.ftdQty : null),
    // `p.reg ? … : null` (e não `p.n ? …`): backend < v73 não manda `reg` na spark → soma 0 e a linha sairia
    // FLAT NO ZERO com cara de dado. Sem ponto, o Sparkline nem renderiza (precisa de ≥2 pontos).
    registros:   arr((p) => p.reg ? p.reg : null),
    roasFtd:     arr((p) => p.spend ? p.ftdAmount / p.spend : null),
    cac:         arr((p) => p.ftdQty ? p.spend / p.ftdQty : null),
    ticketFtd:   arr((p) => p.ftdQty ? p.ftdAmount / p.ftdQty : null),
    roasDepD0:   arr((p) => p.spend ? p.depD0 / p.spend : null),
    depTotal:    arr((p, h) => h.n ? h.dep : null),
    qtdDep:      arr((p, h) => h.n ? h.qtdDep : null),
    ggr:         arr((p, h) => h.n ? h.ngr : null),
    turnover:    arr((p, h) => h.n ? h.turnover : null),
    ggrPerDep:   arr((p, h) => h.dep ? h.ngr / h.dep : null),
    hold:        arr((p, h) => h.turnover ? h.ngr / h.turnover : null),
    rollover:    arr((p, h) => h.dep ? h.turnover / h.dep : null),
    freespinDep: arr((p, h) => h.dep ? h.freespin / h.dep : null),
    bonusDep:    arr((p, h) => h.dep ? h.bonus / h.dep : null),
  };
}

function buildFarolGroups_(MM, f, range, useYtd, sparkByKey, scenLabel) {
  // Fator de projeção de fechamento = run-rate puro (dias do mês ÷ dias decorridos).
  // ⚠️ 2026-08-05: ANTES o fator era `ggrTrend ÷ ggr`, na crença de que projetava pela "curva do GGR" em vez
  // de reta. Não projetava: o backend calcula `ggrTrend = mtd.ngr × (daysInMonth / daysElapsed)`, então a
  // razão SÓ PODE dar o próprio run-rate — zero informação a mais. E quebrava com filtro de canal/escopo:
  // `ggr.act` vira o GGR filtrado (pequeno) e `ggrTrend` continua house-level (grande), então a razão
  // explodia. Foi assim que "Depósitos R$ 1,32M" virou "TREND R$ 3302,16M" (fator 2.502× onde o run-rate
  // era 6,2×). O trend NÃO é balizado em BP nem em Forecast — é extrapolação do realizado, só isso.
  const tf = useYtd ? null : monthCloseMult_(range);
  const proj = (m) => (m && tf != null && m.act != null) ? m.act * tf : null;   // valor projetado de fechamento
  // Normal: card + projeção. YTD: tira M-1 (mês anterior) e trend — só ACT vs BP acumulado.
  const dress = (m) => { if (!m) return m; if (useYtd) return { ...m, m1: null, trend: undefined }; const t = proj(m); return t != null ? { ...m, trend: t } : m; };
  const dressPlain = (m) => (useYtd && m) ? { ...m, m1: null, trend: undefined } : m;   // cards de razão (sem trend), só tira M-1 no YTD
  // Rollover: usa o BP do cenário se veio (DB Plan_RevOps); senão FIXO 5,10x. SEM trend (não projeta razão).
  const ROLLOVER_BP = 5.10;
  const rolloverCard = MM.rollover ? { ...MM.rollover, bp: (MM.rollover.bp != null ? MM.rollover.bp : ROLLOVER_BP), trend: undefined, m1: useYtd ? null : MM.rollover.m1 } : null;
  // Hold % = House Edge (NGR/Turnover). BP do cenário (RevOps) se veio; senão FIXO 3,5%. Maior=melhor.
  const holdCard = MM.hold ? { ...MM.hold, label: 'Hold % (House Edge)', bp: (MM.hold.bp != null ? MM.hold.bp : 0.035) } : null;
  // Turnover BP: do cenário (RevOps) se veio; senão Depósito Total BP × Rollover BP (turnover = rollover × depósito).
  const depTotalBp = (MM.depTotal && MM.depTotal.bp != null) ? MM.depTotal.bp : null;
  const turnoverCard = MM.turnover ? { ...MM.turnover, bp: (MM.turnover.bp != null ? MM.turnover.bp : (depTotalBp != null ? depTotalBp * ROLLOVER_BP : null)) } : null;
  // ROAS FTD e ROAS Dep M0 — posição do M-1 = razão dos M-1 dos componentes (FTD Amount÷Invest, DEP M0÷Invest),
  // já que ambos os componentes trazem M-1. Fallback pro m1 do próprio card se algum componente não tiver M-1.
  const div_ = (a, b) => (a != null && b) ? a / b : null;
  const roasFtdM1 = div_(MM.ftdAmount && MM.ftdAmount.m1, MM.invest && MM.invest.m1);
  const roasFtdCard = dressPlain(MM.roasFtd ? { ...MM.roasFtd, m1: roasFtdM1 != null ? roasFtdM1 : (MM.roasFtd.m1 != null ? MM.roasFtd.m1 : null) } : null);
  const roasM0M1 = div_(MM.depM0Total && MM.depM0Total.m1, MM.invest && MM.invest.m1);
  const roasDepM0Card = dressPlain(f.roasDepM0 ? { ...f.roasDepM0, m1: roasM0M1 != null ? roasM0M1 : (f.roasDepM0.m1 != null ? f.roasDepM0.m1 : null) } : null);
  // Multiplicador M0 = Dep M0 ÷ FTD Amount (ao lado do ROAS Dep M0, que divide pelo investimento).
  // Mesmo tratamento do M-1: razão dos M-1 dos componentes, com fallback pro m1 do próprio card.
  const multM0M1 = div_(MM.depM0Total && MM.depM0Total.m1, MM.ftdAmount && MM.ftdAmount.m1);
  const multM0Card = dressPlain(f.multM0 ? { ...f.multM0, m1: multM0M1 != null ? multM0M1 : (f.multM0.m1 != null ? f.multM0.m1 : null) } : null);
  // ROAS GGR M0 — meta FIXA por escopo (ROAS_GGR_M0_BP), já resolvida em buildFarolMetrics_. Sem scenBp/
  // fcBp de propósito: a meta não muda por cenário, então o card diz "Orçado" mesmo em Forecast — igual
  // FreeSpins/Dep e Bonificação/Dep. Maior=melhor, então o farol acende sem inverter.
  const roasGgrM0Card = dressPlain(f.roasGgrM0);
  // Retenção agora rotula a BASE (Depósito) em cada card — deixa espaço p/ os cards de GGR virem depois na mesma
  // seção. Relabel SÓ no Farol (não toca o label global do metric → a aba Retenções segue "Retenção M0→M1").
  const relabelRet = (m, label) => (m ? { ...m, label } : m);
  // Pendura a série das 4 semanas (.spark) no card, quando há dado — só cards de FLUXO recebem chave em sparkByKey.
  // Dep M0/ROAS Dep M0/Retenção NÃO têm chave (maturação de coorte) → seguem sem linha, com o header novo.
  const SP = sparkByKey || {};
  // sparkWeeks vai junto pro rótulo/tooltip de cada ponto saber a QUAL semana pertence.
  const ws = (m, key) => { if (!m) return m; const s = SP[key]; return (s && s.some(v => v != null && isFinite(v))) ? { ...m, spark: s, sparkWeeks: SP.__weeks || null } : m; };
  // Prefixo do "BP" no card = nome do cenário ATIVO (Orçado/Conservador/Forecast) — segue o toggle lá de cima.
  // scenLabel = cenário ativo (só nos cards que o applyScenarioBp_ re-anchora); baseLabel = Orçado (meta FIXA:
  // Retenção/FreeSpins/Bonif NÃO mudam por cenário, então continuam "Orçado" mesmo em Conservador/Forecast).
  const scenL = scenLabel || SCEN_BP_LABEL;
  const bl = (m, label) => m ? { ...m, bpLabel: label } : m;
  // Rótulo POR CARD, não por tela: só quem foi de fato re-anchorado pelo cenário (scenBp, do
  // applyScenarioBp_) ou pelas razões do Forecast (fcBp, do applyFcRatios_) leva o nome do cenário.
  // O resto continua "Orçado" — é o BP base, e chamá-lo de "Forecast" seria mentira. Isso passou a
  // importar quando a janela pode ter plano de receita sem plano de aquisição (coberturas diferentes).
  const blS = (m) => bl(m, (m && (m.scenBp || m.fcBp)) ? scenL : SCEN_BP_LABEL);
  return [
    // Registros entra depois do Investimento (ordem do funil: verba → cadastro → FTD). SEM BP (o plano não
    // tem meta de registro) → farol apagado; leva Δ M-1, trend de fechamento e sparkline como os outros
    // cards de FLUXO. Card ausente (backend < v73) é filtrado no fim da função, não vira buraco.
    { title: 'Aquisição', cards: [blS(ws(dress(MM.invest), 'invest')), blS(ws(dress(MM.registros), 'registros')), blS(ws(dress(MM.ftdQty), 'ftdQty')), blS(ws(dress(MM.ftdAmount), 'ftdAmount')), blS(ws(roasFtdCard, 'roasFtd')), blS(ws(dressPlain(f.roasDepD0), 'roasDepD0')), blS(ws(dressPlain(f.cac), 'cac')), blS(ws(dressPlain(f.ticketFtd), 'ticketFtd'))] },
    { title: 'Depósito M0', cards: [blS(dress(MM.depM0Total)), blS(roasDepM0Card), blS(multM0Card)] },
    { title: 'Volume & GGR', cards: [blS(ws(dress(MM.depTotal), 'depTotal')), blS(ws(dress(turnoverCard), 'turnover')), blS(ws(dress(MM.ggr), 'ggr')), blS(ws(dressPlain(MM.ggrPerDep), 'ggrPerDep')), blS(ws(dressPlain(holdCard), 'hold')), blS(ws(rolloverCard, 'rollover')), blS(ws(dressPlain(f.freespinDep), 'freespinDep')), blS(ws(dressPlain(f.bonusDep), 'bonusDep')), blS(roasGgrM0Card)] },
    // Retenção: Depósito (view de coorte, meta fixa do plano) + GGR (ngr net, mesma fórmula/janela, SEM meta).
    // ⚠️ o Depósito M3+ usa o residual da FAROL; o GGR M3+ é ratio de coorte puro — ver tooltip/nota.
    { title: 'Retenção', cards: [
      bl(dressPlain(relabelRet(MM.retM0M1, 'Depósito M0→M1')), SCEN_BP_LABEL),
      bl(dressPlain(relabelRet(MM.retM1M2, 'Depósito M1→M2')), SCEN_BP_LABEL),
      bl(dressPlain(relabelRet(MM.retM3plus, 'Depósito M3+')), SCEN_BP_LABEL),
      dressPlain(MM.retGgrM0M1), dressPlain(MM.retGgrM1M2), dressPlain(MM.retGgrM3plus),
      dressPlain(MM.retTurnM0M1), dressPlain(MM.retTurnM1M2), dressPlain(MM.retTurnM3plus),
    ] },
    // Margem por safra em DUAS seções (GGR e Hold separados, pedido do Luis) — qualidade de monetização
    // por IDADE DE COORTE, não é retenção; janela MTD. Cada card carrega o `share` (peso da safra no GGR).
    // Só entra card com valor: bucket sem safra no período sai da tela em vez de virar um "—" mudo
    // (e sem ggrSafra nenhum as duas seções desaparecem).
    { title: 'GGR por safra', cards: [
      dressPlain(f.ggrDep_m0), dressPlain(f.ggrDep_m1), dressPlain(f.ggrDep_m2), dressPlain(f.ggrDep_m3plus),
    ].filter(c => c && c.act != null) },
    { title: 'Hold por safra', cards: [
      dressPlain(f.hold_m0), dressPlain(f.hold_m1), dressPlain(f.hold_m2), dressPlain(f.hold_m3plus),
    ].filter(c => c && c.act != null) },
    { title: 'Rollover por safra', cards: [
      dressPlain(f.roll_m0), dressPlain(f.roll_m1), dressPlain(f.roll_m2), dressPlain(f.roll_m3plus),
    ].filter(c => c && c.act != null) },
  ].map(g => ({ ...g, cards: (g.cards || []).filter(Boolean) }))   // card ausente (backend velho) não vira buraco
   .filter(g => g.cards.length);                                    // grupo sem nenhum card não renderiza título órfão
}

// Recomputa as métricas de AQUISIÇÃO do Farol com FTDs cohortados por DATA DE CADASTRO (registro), não por
// data de FTD. Afeta FTD Amount / ROAS FTD / CAC / Tkt FTD; Investimento e ROAS Dep D0 ficam iguais.
// Fonte = payload.ftdByRegister (por canal), somado no escopo do filtro de canal. BP não muda (é o plano).
function applyFtdByRegister_(MM, f, ftdByRegister, chFilter) {
  const scoped = filterChannelList_(ftdByRegister || [], chFilter);
  if (!scoped.length) return { MM, f };
  const sum = (k) => scoped.reduce((a, c) => a + (c[k] || 0), 0);
  const regA = sum('ftdAmount'), regQ = sum('ftdQty'), regAm1 = sum('ftdAmountM1'), regQm1 = sum('ftdQtyM1');
  const inv = MM.invest || {};
  const div = (a, b) => (a != null && b) ? a / b : null;
  const over = (m, act, m1) => m ? { ...m, act: act != null ? act : null, m1: m1 != null ? m1 : null } : m;
  return {
    MM: { ...MM,
      ftdAmount: over(MM.ftdAmount, regA, regAm1 || null),
      ftdQty:    over(MM.ftdQty, regQ, regQm1 || null),
      roasFtd:   over(MM.roasFtd, div(regA, inv.act), div(regAm1, inv.m1)),
    },
    f: { ...f,
      cac:       f.cac ? { ...f.cac, act: div(inv.act, regQ), m1: div(inv.m1, regQm1) } : f.cac,
      ticketFtd: f.ticketFtd ? { ...f.ticketFtd, act: div(regA, regQ), m1: div(regAm1, regQm1) } : f.ticketFtd,
    },
  };
}

// Re-anchora o BP dos cards de AQUISIÇÃO + DEP M0 do Farol para o cenário escolhido (BP/Conservador/Rolling),
// vindo do plano por canal (payload.planScenarios). Reescopa por chFilter igual ao resto (canais selecionados →
// soma; scope 'growth' → growthAgg; senão allAgg). Só mexe no .bp desses cards — o Hero recolore o farol e o %
// sozinho a partir do novo bp. Retenção/GGR/Volume ficam intactos (a aba do plano não tem meta pra eles).
const CENARIOS = [
  { id: 'bp',      label: 'Orçado',       color: '#378ADD' },
  { id: 'conserv', label: 'Conservador',  color: '#F0997B' },
  { id: 'rolling', label: 'Forecast',     color: '#9AA0A6' },
];
// Rótulo do cenário BASE (Orçado) — usado no prefixo dos cards de meta FIXA (Retenção/FreeSpins/Bonif), que
// NÃO mudam por cenário (o applyScenarioBp_ não os re-anchora), mesmo quando o toggle está em Conservador/Forecast.
const SCEN_BP_LABEL = (CENARIOS.find(c => c.id === 'bp') || CENARIOS[0]).label;
function applyScenarioBp_(M, farol, scenData, chFilter) {
  if (!scenData) return { M, farol };
  const pos = (v) => (v != null && isFinite(v) && v !== 0) ? v : null;
  // scenBp marca que ESTE card foi re-anchorado pelo cenário. O rótulo do card segue isso: sem a
  // marca, o "Orçado/Conservador/Forecast" seria mentira — o card estaria mostrando o BP base.
  // Importa desde que a janela pode cobrir meses que só têm plano de receita (DB Plan_RevOps vai de
  // abr a dez) e nenhum plano de aquisição (DB Plan_Growth Mkt só tem agosto).
  const setBp = (m, v) => m ? { ...m, bp: pos(v), scenBp: pos(v) != null } : m;
  let newM = M, newFarol = farol;
  const sel = chList_(chFilter);
  // --- Aquisição + Dep M0 (DB Plan_Growth Mkt, por canal) — reescopa por chFilter ---
  const KEYS = ['invest', 'ftd', 'ftdAmount', 'depD0', 'depM0'];
  const byCh = scenData.byChannel || {};
  let agg;
  if (sel && sel.length) {
    agg = {};
    sel.forEach(ch => { const b = byCh[ch]; if (b) KEYS.forEach(k => { agg[k] = (agg[k] || 0) + (b[k] || 0); }); });
  } else if (chFilter && chFilter.scope === 'growth') {
    agg = scenData.growthAgg || {};
  } else {
    // Total da Casa = plano growth × UPLIFT não-growth (orgânico/afiliados/social). A aba DB Plan_Growth Mkt
    // só tem canais de mídia paga, então allAgg == growthAgg — sem o uplift os dois escopos mostravam o MESMO
    // plano. O uplift (tt ÷ growth) vem da DB Plan_RevOps; é RAZÃO, não nível, porque as duas abas estão em
    // paces diferentes (ver houseUplift no backend). Investimento não leva uplift: não há mídia fora do growth.
    const up = scenData.houseUplift;
    const a = scenData.allAgg || {};
    if (up) {
      const upl = (k, r) => (a[k] || 0) * ((up[r] > 0) ? up[r] : 1);
      agg = { invest: a.invest || 0, ftd: upl('ftd', 'ftd'), ftdAmount: upl('ftdAmount', 'ftdAmount'),
              depD0: upl('depD0', 'depM0'), depM0: upl('depM0', 'depM0') };   // D0 herda o uplift do M0 (mesma população)
    } else {
      agg = a;   // backend < v70 (sem houseUplift) → comportamento antigo; o bloco isTotal lá embaixo repõe o Dep M0
    }
  }
  const inv = agg.invest || 0, ftd = agg.ftd || 0, ftdAmt = agg.ftdAmount || 0, depD0 = agg.depD0 || 0, depM0 = agg.depM0 || 0;
  if (inv > 0) {   // cenário sem plano de aquisição nesse escopo → mantém o BP atual desses cards
    newM = { ...newM,
      invest:     setBp(newM.invest,     inv),
      ftdAmount:  setBp(newM.ftdAmount,  ftdAmt),
      ftdQty:     setBp(newM.ftdQty,     ftd),
      roasFtd:    setBp(newM.roasFtd,    inv ? ftdAmt / inv : null),
      depM0Total: setBp(newM.depM0Total, depM0),
    };
    newFarol = { ...newFarol,
      cac:        setBp(newFarol.cac,        ftd ? inv / ftd : null),
      ticketFtd:  setBp(newFarol.ticketFtd,  ftd ? ftdAmt / ftd : null),
      roasDepD0:  setBp(newFarol.roasDepD0,  inv ? depD0 / inv : null),
      roasDepM0:  setBp(newFarol.roasDepM0,  inv ? depM0 / inv : null),
      multM0:     setBp(newFarol.multM0,     ftdAmt ? depM0 / ftdAmt : null),
    };
  }
  // --- Receita / Volume de depósito (DB Plan_RevOps, house-level) — SÓ Total da Casa (a aba não tem canal) ---
  const house = scenData.house;
  const isTotal = !(sel && sel.length) && !(chFilter && chFilter.scope === 'growth');
  if (house && isTotal) {
    const td = house.totalDeposit || 0, ggr = house.ggr || 0, turn = house.turnover || 0;
    if (td > 0 || ggr > 0 || turn > 0) {
      newM = { ...newM,
        depTotal:  setBp(newM.depTotal,  td),
        turnover:  setBp(newM.turnover,  turn),
        ggr:       setBp(newM.ggr,       ggr),
        ggrPerDep: setBp(newM.ggrPerDep, td ? ggr / td : null),
        hold:      setBp(newM.hold,      turn ? ggr / turn : null),
        rollover:  setBp(newM.rollover,  td ? turn / td : null),
      };
    }
    // Grupo "Depósito M0" no Total da Casa: SÓ no fallback (backend < v70, sem houseUplift). Com uplift o grupo
    // já sai certo lá em cima e sobrescrever aqui MISTURARIA PACES — Dep M0/ROAS Dep M0/Mult M0 viriam do
    // Plan_RevOps (ago fc: 3,0M/mês) enquanto Investimento/ROAS FTD/CAC seguem no Plan_Growth (3,72M/mês),
    // dois planos de mídia na mesma tela. As razões do uplift batem com o Plan_RevOps tt de qualquer forma
    // (ago fc: ROAS Dep M0 1,69 vs 1,70 · Mult M0 3,58 vs 3,57); só o nível fica no pace do Plan_Growth.
    const m0 = house.m0tt || 0, hInv = house.invest || 0, hFtdAmt = house.ftdAmountTt || 0;
    if (m0 > 0 && !scenData.houseUplift) {
      newM = { ...newM, depM0Total: setBp(newM.depM0Total, m0) };
      newFarol = { ...newFarol,
        roasDepM0: setBp(newFarol.roasDepM0, hInv ? m0 / hInv : null),
        multM0:    setBp(newFarol.multM0,    hFtdAmt ? m0 / hFtdAmt : null),
      };
    }
  }
  return { M: newM, farol: newFarol };
}

// Metas de razão do FORECAST — vêm da aba Projection_Revenue (payload.planFcRatios) e substituem o .bp de
// Turnover/Rollover/Hold/FreeSpins-Dep/Bonif-Dep. SÓ no cenário Forecast: Orçado e Conservador continuam nas
// constantes fixas (decisão do Luis 2026-08-05). Existe porque a DB Plan_RevOps discorda da Projection_Revenue
// no Turnover (ago/26: 70,49M vs 69,11M — a RevOps ainda multiplica por rollover 5,10 em vez de 5,00).
function applyFcRatios_(M, farol, fc) {
  if (!fc) return { M: M, farol: farol };
  // v > 0 de propósito: a partir de set/26 a linha FreeSpins/Dep está VAZIA na planilha e chega como 0.
  // Meta 0% deixaria o card vermelho por artefato — nesse caso mantém a constante em vez de mentir.
  // fcBp marca que a meta veio do Forecast — o rótulo do card segue isso (senão diria "Orçado" com número do FC).
  const set = (o, k, v) => (o && o[k] && v != null && v > 0) ? Object.assign({}, o, { [k]: Object.assign({}, o[k], { bp: v, fcBp: true }) }) : o;
  let MM = M, ff = farol;
  MM = set(MM, 'turnover', fc.turnover);
  MM = set(MM, 'rollover', fc.rollover);
  MM = set(MM, 'hold', fc.hold);
  ff = set(ff, 'freespinDep', fc.freespinDep);
  ff = set(ff, 'bonusDep', fc.bonusDep);
  return { M: MM, farol: ff };
}

function TabFarol({ M, farol, range, ytd, ftdByRegister, chFilter, planScenarios, farolSpark, planFcRatios, user }) {
  // YTD é preset GLOBAL de data: a janela (appliedRange) já é abril→ontem, então usa o M/farol normais.
  // Só muda a comparação: SÓ vs BP — tira M-1 (mesma janela 1 mês atrás) e a projeção de fechamento, que
  // não fazem sentido num acumulado de vários meses.
  const useYtd = !!ytd;
  // Toggle (só Aquisição): FTD por data de FTD ↔ por data de CADASTRO. Só liga se o backend mandou o dado.
  const [byReg, setByReg] = usePersistedState('rvops:farolFtdReg', false);
  const hasReg = !!(ftdByRegister && ftdByRegister.length);
  const active = byReg && hasReg;
  const src = active ? applyFtdByRegister_(M || {}, farol || {}, ftdByRegister, chFilter) : { MM: M || {}, f: farol || {} };
  // Cenário do plano (BP/Conservador/Rolling): re-anchora o BP dos cards de aquisição + Dep M0 (payload.planScenarios).
  // ⚠️ NÃO persiste (era usePersistedState): todo load/refresh volta pro padrão, então ninguém entra já
  // carregado num cenário restrito por resíduo de sessão anterior (defesa em profundidade, além do gate de
  // acesso do activeScen abaixo, que rebaixa pro firstScen permitido se o padrão não for liberado p/ o user).
  // 2026-08-05: padrão passou de 'bp' p/ 'rolling' (Forecast) a pedido do Luis — o Orçado deixou de ser
  // atualizado pelo time e virou referência histórica; o Forecast é o que reflete a operação.
  const [scen, setScen] = React.useState('rolling');
  // Cenários que ESTE usuário pode ver (allowlist "por acesso" — igual às abas). Admin vê todos; null/vazio = todos.
  // É gate de UI (esconde o cenário do switcher); o payload ainda traz os 3, mas o usuário não os seleciona.
  const isAdminU = !!(user && user.admin);
  const allowedScen = isAdminU ? null : ((user && Array.isArray(user.scen) && user.scen.length) ? user.scen : null);
  const scenAllowed = (id) => !allowedScen || allowedScen.indexOf(id) >= 0;
  const visCenarios = CENARIOS.filter(c => scenAllowed(c.id));   // só os cenários permitidos p/ este usuário
  const scenAvail = {};
  // Um cenário está disponível se tem plano de AQUISIÇÃO (DB Plan_Growth Mkt, por canal) OU de
  // RECEITA (DB Plan_RevOps, house) na janela. ⚠️ Antes o gate olhava só `allAgg.invest > 0`, e as
  // duas abas têm COBERTURA DIFERENTE: Growth Mkt só tem 2026-08; Plan_RevOps vai de abr a dez/26.
  // Resultado: qualquer janela sem agosto (ex.: 01/04→30/06) derrubava hasScen, o switcher sumia da
  // tela e NENHUM cenário era aplicado — os cards caíam no BP base, que só tem junho embutido
  // (BP_DATA) e por isso mostrava 30 dias de plano numa janela de 91, com Dep M0 e Depósitos Totais
  // no mesmo R$ 28,20M (no BP de junho depTotal == m0tt). Olhando as duas fontes, a janela passa a
  // usar o plano de receita dia a dia e o switcher volta.
  const scenHasHouse = (s) => { const h = s && s.house; return !!(h && ((h.totalDeposit || 0) > 0 || (h.ggr || 0) > 0 || (h.turnover || 0) > 0 || (h.m0tt || 0) > 0)); };
  CENARIOS.forEach(c => { const s = planScenarios && planScenarios[c.id]; scenAvail[c.id] = !!(s && ((s.allAgg && s.allAgg.invest > 0) || scenHasHouse(s))); });
  const hasScen = visCenarios.some(c => scenAvail[c.id]);   // só conta cenário permitido E com plano na janela
  const firstScen = (visCenarios.find(c => scenAvail[c.id]) || visCenarios[0] || CENARIOS[0]).id;   // default respeita o acesso
  const activeScen = (scenAllowed(scen) && scenAvail[scen]) ? scen : firstScen;   // cenário persistido só vale se permitido
  const scenOn = hasScen && !!(planScenarios && planScenarios[activeScen]);
  const ov0 = scenOn ? applyScenarioBp_(src.MM, src.f, planScenarios[activeScen], chFilter) : { M: src.MM, farol: src.f };
  // Forecast: as metas de razão vêm da Projection_Revenue, não da DB Plan_RevOps (as duas divergem no Turnover).
  const ov = (activeScen === 'rolling') ? applyFcRatios_(ov0.M, ov0.farol, planFcRatios) : ov0;
  // Série das 4 semanas fechadas por KPI (ACT — independe de cenário/BP), reescopada no chFilter. Nulls onde não há dado.
  const sparkByKey = React.useMemo(() => buildFarolSpark_(farolSpark, chFilter), [farolSpark, chFilter]);
  const scenMeta = CENARIOS.find(c => c.id === activeScen) || CENARIOS[0];
  // Prefixo do "BP" nos cards = nome do cenário ATIVO (segue o toggle). Sem cenário aplicado (scenOn=false) → Orçado (base).
  const scenLabel = scenOn ? scenMeta.label : SCEN_BP_LABEL;
  // Cobertura do plano na janela (backend v68+ manda planDays/winDays/emptyMonths no house). As linhas
  // do DB Plan_RevOps existem de abr a dez, mas Orçado e Conservador vêm ZERADOS em abr/mai — numa
  // janela 01/04→30/06 o Farol comparava 91 dias de realizado contra 30 de plano e mostrava Dep M0 em
  // 61% vermelho como se fosse performance. Degrada em silêncio em backend antigo (campos ausentes).
  const scenHouse = (scenOn && planScenarios && planScenarios[activeScen] && planScenarios[activeScen].house) || null;
  const planGap = (scenHouse && scenHouse.winDays > 0 && scenHouse.planDays != null && scenHouse.planDays < scenHouse.winDays) ? scenHouse : null;
  const mesCurto_ = (mk) => { const MM_ = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; return (MM_[+String(mk).slice(5, 7) - 1] || mk) + '/' + String(mk).slice(2, 4); };
  // Algum outro cenário cobre a janela inteira? Se sim, aponta — é a saída prática pro usuário.
  const scenCheio = planGap ? visCenarios.find(c => { if (c.id === activeScen || !scenAvail[c.id]) return false; const h = planScenarios[c.id] && planScenarios[c.id].house; return !!(h && h.winDays > 0 && h.planDays >= h.winDays); }) : null;
  const groups = buildFarolGroups_(ov.M, ov.farol, range, useYtd, sparkByKey, scenLabel);
  const rangeLbl = (range && range.from) ? `${fmtBR_(range.from)} → ${fmtBR_(range.to)}` : '';
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Farol</h1>
          <div className="subtitle">
            {useYtd
              ? <>YTD · acumulado desde abril · {rangeLbl} · variação vs BP</>
              : <>Visão consolidada — todos os indicadores em cards, variação vs M-1 e vs BP</>}
          </div>
          {/* 2026-08-05: removido o aviso laranja de cenário. Ele só aparecia quando o cenário ativo não era
              o Orçado; com o Forecast virando padrão passou a ficar permanente na tela. O prefixo de cada
              card já diz o cenário ("Forecast R$ …"), então o bloco era redundante. */}
          {planGap && (
            <div className="subtitle" style={{ color: 'var(--accent-yellow)', marginTop: 6, maxWidth: 760 }}>
              ⚠️ O plano <strong>{scenMeta.label}</strong> cobre <strong>{planGap.planDays} de {planGap.winDays} dias</strong> desta janela
              {planGap.emptyMonths && planGap.emptyMonths.length > 0 && <> — não existe plano em <strong>{planGap.emptyMonths.map(mesCurto_).join(', ')}</strong></>}.
              {' '}O realizado conta a janela toda, então o <strong>% vs plano está subestimado</strong> — o buraco é de plano, não de operação.
              {scenCheio && <> O cenário <strong>{scenCheio.label}</strong> cobre a janela inteira.</>}
            </div>
          )}
          {active && (
            <div className="subtitle" style={{ color: 'var(--accent-yellow)', marginTop: 6, maxWidth: 720 }}>
              Aquisição normalizada por <strong>data de cadastro</strong>: FTD Amount, ROAS FTD, CAC e Ticket contam FTDs de quem <em>registrou</em> na janela (não de quem deu FTD). ⚠️ o mês corrente é uma coorte <strong>maturando</strong> — quem registrou e ainda não deu FTD não conta, então o CAC começa alto e cai conforme matura (~30–45d).
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {hasScen && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginRight: 2 }}>cenário</span>
              {visCenarios.map(c => (
                <button
                  key={c.id}
                  className={`preset-btn ${activeScen === c.id ? 'active' : ''}`}
                  onClick={() => setScen(c.id)}
                  disabled={!scenAvail[c.id]}
                  title={scenAvail[c.id]
                    ? `Compara aquisição + Dep M0 vs plano ${c.label}`
                    : `Sem plano ${c.label} nesta janela`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <button
            className={`preset-btn ${active ? 'active' : ''}`}
            onClick={() => setByReg(v => !v)}
            disabled={!hasReg}
            title={hasReg
              ? 'Aquisição: alterna FTD por data de FTD ↔ por data de cadastro (registro). Afeta FTD Amount, ROAS FTD, CAC e Ticket.'
              : 'Requer o backend v34 (deploy pendente do clasp) — ainda não há dado de FTD por cadastro.'}
          >
            FTD por cadastro{!hasReg ? ' (pendente)' : ''}
          </button>
        </div>
      </div>
      {groups.map((g, i) => (
        <div className="support" key={i}>
          <div className="support-title">{g.title}</div>
          <div className="hero-grid">
            {g.cards.map((m, j) => (m ? <Hero key={j} metric={m} variant="farol" /> : null))}
          </div>
        </div>
      ))}
    </React.Fragment>
  );
}

// Aba MONTHLY CLOSE — fechamento do mês no formato do FAROL: ACT (BigQuery, consistente com o resto
// do cockpit) vs BP, linha a linha. Depósitos por safra (M+1/M+2/M3+) vêm de payload.monthlyClose;
// o resto reusa M (hero metrics) + farolMetrics (CAC/ROAS Dep). % vs BP = atingimento (custo inverte).
// Monta as linhas ACT vs BP do Monthly Close. FONTE ÚNICA: aba Monthly Close + export de Excel.
function buildMonthlyCloseRows_(M, farol, monthlyClose) {
  const MM = M || {}, f = farol || {}, mc = monthlyClose || {};
  const mca = mc.act || {}, mcb = mc.bp || {};
  const A = (m) => (m && m.act != null) ? m.act : null;
  const B = (m) => (m && m.bp != null) ? m.bp : null;
  const div = (a, b) => (a != null && b) ? a / b : null;
  return [
    { sec: 'Aquisição' },
    { label: 'Investimento', act: A(MM.invest), bp: B(MM.invest), fmt: 'brl' },
    { label: 'ROAS FTD', act: A(MM.roasFtd), bp: B(MM.roasFtd), fmt: 'multiple' },
    { label: 'FTD Amount', act: A(MM.ftdAmount), bp: B(MM.ftdAmount), fmt: 'brl' },
    { label: '#FTD', act: A(MM.ftdQty), bp: B(MM.ftdQty), fmt: 'qty' },
    { label: 'Ticket Médio FTD', act: div(A(MM.ftdAmount), A(MM.ftdQty)), bp: div(B(MM.ftdAmount), B(MM.ftdQty)), fmt: 'brl' },
    { label: 'CAC', act: A(f.cac), bp: B(f.cac), fmt: 'brl', lower: true },
    { sec: 'Depósito M0' },
    { label: 'ROAS Dep M0', act: A(f.roasDepM0), bp: B(f.roasDepM0), fmt: 'multiple' },
    { label: 'Multiplicador Dep M0/FTD', act: div(A(MM.depM0Total), A(MM.ftdAmount)), bp: div(B(MM.depM0Total), B(MM.ftdAmount)), fmt: 'multiple' },
    { label: 'DEP M0 Growth', act: A(MM.depM0Growth), bp: B(MM.depM0Growth), fmt: 'brl' },
    { label: 'DEP M0 Not Growth', act: mca.m0NotGrowth != null ? mca.m0NotGrowth : null, bp: null, fmt: 'brl' },
    { label: 'DEP M0 tt', act: A(MM.depM0Total), bp: B(MM.depM0Total), fmt: 'brl' },
    { sec: 'Depósitos por safra' },
    { label: 'M+1', act: mca.m1 != null ? mca.m1 : null, bp: mcb.m1 != null ? mcb.m1 : null, fmt: 'brl' },
    { label: 'M+2', act: mca.m2 != null ? mca.m2 : null, bp: mcb.m2 != null ? mcb.m2 : null, fmt: 'brl' },
    { label: 'M3+', act: mca.m3plus != null ? mca.m3plus : null, bp: mcb.m3plus != null ? mcb.m3plus : null, fmt: 'brl' },
    { label: 'Total Deposit', act: A(MM.depTotal), bp: B(MM.depTotal), fmt: 'brl' },
    { sec: 'Casa' },
    { label: 'Turnover', act: A(MM.turnover), bp: B(MM.turnover), fmt: 'brl' },
    { label: 'Rollover', act: A(MM.rollover), bp: B(MM.rollover), fmt: 'multiple' },
    { label: 'Hold %', act: A(MM.hold), bp: B(MM.hold), fmt: 'pct' },
    { label: 'GGR', act: A(MM.ggr), bp: B(MM.ggr), fmt: 'brl' },
    { label: 'GGR / Depósito', act: A(MM.ggrPerDep), bp: B(MM.ggrPerDep), fmt: 'pct' },
  ];
}
// % vs BP do Monthly Close = atingimento (custo/lower inverte). Compartilhado aba + export.
function monthlyClosePct_(r) {
  return (r.bp && r.act != null && r.bp !== 0) ? (r.lower ? r.bp / r.act : r.act / r.bp) : null;
}

// Grupos do Farol PARA O EXPORT — parte da tela (buildFarolGroups_) e INJETA detalhe que só o Excel tem:
//  • Aquisição: FTD Amount e #FTD split Growth / Not Growth (+ Total); Investimento é growth-only (relabel).
//  • Depósito M0: DEP M0 split Growth / Not Growth (+ Total).
//  • Retenção: valor ABSOLUTO da coorte retida em R$ (M+1/M+2/M3+, de monthlyClose) sob cada % de retenção.
// Growth = allowlist isGrowthCh_, no MESMO escopo do resto da planilha (respeita o filtro de canal via chFilter).
// Splits usam os canais atribuídos (Actual); BP só nas linhas Total (o plano não separa orgânico). A tela NÃO muda.
function buildFarolExportGroups_(MM, f, monthlyClose, channels, chFilter, range, useYtd) {
  const groups = buildFarolGroups_(MM, f, range, useYtd);
  const G = {}; groups.forEach(g => { G[g.title] = {}; (g.cards || []).forEach(c => { if (c) G[g.title][c.label] = c; }); });
  // buildFarolGroups_ agora PODE omitir um grupo inteiro (todos os cards null) — garante o bucket
  // pra os lookups G['...']['...'] abaixo não estourarem em backend antigo/mock.
  ['Aquisição', 'Depósito M0', 'Volume & GGR', 'Retenção', 'GGR por safra', 'Hold por safra', 'Rollover por safra'].forEach(t => { if (!G[t]) G[t] = {}; });
  const relabel = (m, label) => m ? { ...m, label } : null;

  // Canais no escopo atual — mesma regra do filterByChannel do App (seleção explícita > growth-scope > todos).
  const sel = chList_(chFilter);
  const scoped = (channels || []).filter(c => sel.length ? sel.indexOf(c.channel) >= 0
    : (chFilter && chFilter.scope === 'growth') ? isGrowthCh_(c.channel) : true);
  const sum = (arr, k) => arr.length ? arr.reduce((a, c) => a + (c[k] || 0), 0) : null;
  const gCh = scoped.filter(c => isGrowthCh_(c.channel));
  const ngCh = scoped.filter(c => !isGrowthCh_(c.channel));
  const split = (label, fmt, act, bp) => ({ label, fmt, act: act == null ? null : act, bp: (bp != null && bp !== 0) ? bp : null, m1: null, lowerBetter: false });

  // DEP M0 growth/não-growth (de MM; não-growth = total − growth).
  const dm0T = MM.depM0Total || {}, dm0G = MM.depM0Growth || {};
  const sub = (a, b) => (a != null && b != null) ? a - b : null;
  const dm0NG = { label: 'DEP M0 — Not Growth', fmt: 'brl', act: sub(dm0T.act, dm0G.act), bp: sub(dm0T.bp, dm0G.bp), m1: sub(dm0T.m1, dm0G.m1) };

  // Coortes retidas absolutas (house-level, de monthlyClose — não segue o filtro de canal, igual à aba Monthly Close).
  const mca = (monthlyClose && monthlyClose.act) || {}, mcb = (monthlyClose && monthlyClose.bp) || {};
  const coh = (label, actv, bpv) => ({ label, fmt: 'brl', act: actv != null ? actv : null, bp: bpv != null ? bpv : null, m1: null });
  const ftdQtyTot = { label: '#FTD — Total', fmt: 'qty',
    act: (MM.ftdQty && MM.ftdQty.act != null) ? MM.ftdQty.act : sum(scoped, 'ftdQty'),
    bp: (MM.ftdQty && MM.ftdQty.bp != null) ? MM.ftdQty.bp : null,
    m1: (MM.ftdQty && MM.ftdQty.m1 != null) ? MM.ftdQty.m1 : null };

  return [
    { title: 'Aquisição', cards: [
      relabel(G['Aquisição']['Investimento'], 'Investimento (Growth)'),
      split('FTD Amount — Growth', 'brl', sum(gCh, 'ftdAmount'), null),
      split('FTD Amount — Not Growth', 'brl', sum(ngCh, 'ftdAmount'), null),
      relabel(G['Aquisição']['FTD Amount'], 'FTD Amount — Total'),
      split('#FTD — Growth', 'qty', sum(gCh, 'ftdQty'), null),
      split('#FTD — Not Growth', 'qty', sum(ngCh, 'ftdQty'), null),
      ftdQtyTot,
      G['Aquisição']['ROAS FTD'], G['Aquisição']['ROAS Dep D0'], G['Aquisição']['CAC'], G['Aquisição']['Tkt Médio FTD'],
    ] },
    { title: 'Depósito M0', cards: [
      relabel(MM.depM0Growth, 'DEP M0 — Growth'),
      dm0NG,
      relabel(G['Depósito M0']['DEP M0 Total'], 'DEP M0 — Total'),
      G['Depósito M0']['ROAS Dep M0'],
    ] },
    { title: 'Volume & GGR', cards: (groups.find(g => g.title === 'Volume & GGR') || {}).cards || [] },
    { title: 'Retenção', cards: [
      G['Retenção']['Depósito M0→M1'], coh('↳ Retido M+1 (R$)', mca.m1, mcb.m1),
      G['Retenção']['Depósito M1→M2'], coh('↳ Retido M+2 (R$)', mca.m2, mcb.m2),
      G['Retenção']['Depósito M3+'],   coh('↳ Retido M3+ (R$)', mca.m3plus, mcb.m3plus),
      G['Retenção']['GGR M0→M1'], G['Retenção']['GGR M1→M2'], G['Retenção']['GGR M3+'],
      G['Retenção']['Turnover M0→M1'], G['Retenção']['Turnover M1→M2'], G['Retenção']['Turnover M3+'],
    ] },
    // GGR/Hold por safra: saem iguais à tela (sem splits/coortes absolutas).
    { title: 'GGR por safra', cards: (groups.find(g => g.title === 'GGR por safra') || {}).cards || [] },
    { title: 'Hold por safra', cards: (groups.find(g => g.title === 'Hold por safra') || {}).cards || [] },
    { title: 'Rollover por safra', cards: (groups.find(g => g.title === 'Rollover por safra') || {}).cards || [] },
  ].map(g => ({ ...g, cards: (g.cards || []).filter(Boolean) })).filter(g => g.cards.length);
}

// Exporta Farol + Monthly Close num .xlsx (2 abas). Farol = a tela + splits Growth/Not-Growth e coortes
// absolutas (buildFarolExportGroups_); Monthly Close reusa buildMonthlyCloseRows_ (1:1 com a aba).
// Valores crus + número formatado por tipo (R$, %, multiplicador, qtd) via cell.z.
const MONTH_ABBR_ = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Carrega o SheetJS SOB DEMANDA (só quando exporta) em vez de em todo carregamento de página — tira ~1MB
// do caminho crítico. Resolve na hora se já estiver carregado (inclui o harness headless de QA, que já
// injeta o XLSX real no global). Idempotente: reusa a mesma Promise se um 2º clique vier durante o load.
let _xlsxPromise = null;
function ensureXLSX_() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => { _xlsxPromise = null; reject(new Error('Falha ao carregar a biblioteca de Excel (SheetJS).')); };
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

// Export MÊS A MÊS do PERÍODO escolhido no popover de extração (não mais YTD fixo). Quebra [from, to]
// nos meses-calendário que ele cobre (o 1º e o último mês são recortados no from/to), busca cada mês no
// backend, deriva as métricas com a MESMA fonte do App (derivePayloadMetrics_) e monta Farol + Monthly
// Close em formato LONGO com a coluna "Mês/Ano". Respeita o escopo de canal (chFilter); a data vem do
// popover, não do slicer do dashboard. Reusa buildFarolExportGroups_ + buildMonthlyCloseRows_ por mês.
// onProgress(feito, total) p/ o botão mostrar o andamento. Fetches em POOL (concorrência limitada) —
// bem mais rápido que sequencial quando há vários meses; janelas menores = menos meses = menos consultas.
async function exportFarolRange_({ from, to, chFilter, escopo, onProgress }) {
  try { await ensureXLSX_(); } catch (e) { alert((e && e.message) || 'Falha ao carregar a biblioteca de Excel.'); return; }
  if (!ENDPOINT_URL) { alert('Sem endpoint (modo mock) — o export precisa do backend.'); return; }
  const numFmt = (fmt) => fmt === 'brl' ? 'R$ #,##0.00'
    : fmt === 'pct' ? '0.0%' : fmt === 'multiple' ? '0.00"x"' : fmt === 'qty' ? '#,##0' : '#,##0.00';
  const PCT = '0.0%';
  const attain = (m) => (!m || m.act == null || m.bp == null || m.bp === 0) ? null : (m.lowerBetter ? m.bp / m.act : m.act / m.bp);
  const applyFmts = (ws, fmts) => Object.keys(fmts).forEach(k => {
    const [r, c] = k.split(',').map(Number);
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = fmts[k]; }
  });

  // Meses-calendário que o período [from, to] cobre; o 1º mês começa no `from`, o último termina no `to`.
  const startISO = from, endISO = to;
  const [sy, sm] = startISO.split('-').map(Number);
  const [ey, em] = endISO.split('-').map(Number);
  const months = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();          // m 1-based → último dia do mês m
    let mFrom = `${y}-${mm}-01`, mTo = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
    if (mFrom < startISO) mFrom = startISO;               // 1º mês: recorta no início do período
    if (mTo > endISO) mTo = endISO;                       // último mês: recorta no fim do período
    months.push({ y, m, from: mFrom, to: mTo, label: `${MONTH_ABBR_[m - 1]}/${y}` });
    m++; if (m > 12) { m = 1; y++; }
  }

  // Busca UM mês → { mo, dispM, farol, monthlyClose, channels, safra } ou { mo, error }. Deriva via fonte
  // única. Só LANÇA em sessão expirada (p/ abortar o pool inteiro); demais erros viram bloco com error.
  const auth = authParam_();
  let done = 0;
  if (onProgress) onProgress(0, months.length);
  const fetchMonth = async (mo) => {
    try {
      const r = await fetch(`${ENDPOINT_URL}?${auth}&from=${mo.from}&to=${mo.to}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = await r.json();
      if (p.error === 'unauthorized') { const e = new Error('unauthorized'); e.unauth = true; throw e; }
      if (p.error) throw new Error(p.error);
      const { dispM, farol } = derivePayloadMetrics_({
        M: p.metrics, componentsByChannel: p.componentsByChannel, retentionChannels: p.retentionChannels, ggrRetentionChannels: p.ggrRetentionChannels, turnRetentionChannels: p.turnRetentionChannels,
        depM0Channels: p.depM0Channels, bp: p.bp, ggrSafra: p.ggrSafra, channels: p.channels, ggrChannels: p.ggrChannels,
      }, chFilter, true);
      // GGR e Turnover por SAFRA (idade de coorte) — mesma lógica dos depósitos: soma o bucket ggrSafra
      // no escopo do canal. turnover só existe no payload a partir do backend v34 (senão fica em branco).
      const bucketSum = (bucket, key) => {
        const arr = filterChannelList_((p.ggrSafra && p.ggrSafra[bucket]) || [], chFilter);
        if (!arr.length || !arr.some(c => c[key] != null)) return null;
        return arr.reduce((a, c) => a + (c[key] || 0), 0);
      };
      const safra = {
        ggr:      { m0: bucketSum('m0', 'ggr'),      m1: bucketSum('m1', 'ggr'),      m2: bucketSum('m2', 'ggr'),      m3plus: bucketSum('m3plus', 'ggr') },
        turnover: { m0: bucketSum('m0', 'turnover'), m1: bucketSum('m1', 'turnover'), m2: bucketSum('m2', 'turnover'), m3plus: bucketSum('m3plus', 'turnover') },
      };
      return { mo, dispM, farol, monthlyClose: p.monthlyClose || null, channels: p.channels || [], safra };
    } catch (e) {
      if (e && e.unauth) throw e;
      return { mo, error: String(e.message || e) };
    } finally {
      done++; if (onProgress) onProgress(done, months.length);
    }
  };

  // Pool com concorrência limitada (não estoura o limite de execuções simultâneas do Apps Script). blocks
  // é preenchido POR ÍNDICE → mantém a ordem cronológica mesmo com as respostas chegando fora de ordem.
  const CONCURRENCY = 4;
  const blocks = new Array(months.length);
  let next = 0;
  const worker = async () => {
    while (next < months.length) {
      const i = next++;
      blocks[i] = await fetchMonth(months[i]);   // lança só em unauth
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, months.length) }, worker));
  } catch (e) {
    if (e && e.unauth) { alert('Sessão expirada — faça login de novo no cockpit e tente outra vez.'); return; }
    throw e;
  }
  const ok = blocks.filter(b => b && !b.error);
  if (!ok.length) { alert('Nenhum mês retornou dado. Verifique o login no cockpit e tente de novo.'); return; }
  const failed = blocks.filter(b => b && b.error).map(b => b.mo.label);
  const escLbl = escopo || 'Total Casa';
  const periodo = `${fmtBR_(startISO)} a ${fmtBR_(endISO)}`;

  // ---------- Aba 1: Farol YTD (formato longo, coluna Mês/Ano entre Grupo e Métrica) ----------
  const fAoa = [
    ['RevOps Cockpit — Farol (mês a mês)'],
    [`Período: ${periodo}`],
    [`Escopo: ${escLbl}`],
    [`Fonte: BigQuery (live)${failed.length ? ' · meses sem dado: ' + failed.join(', ') : ''}`],
    [],
    ['Grupo', 'Mês/Ano', 'Métrica', 'Actual', 'BP', '% vs BP', 'M-1', 'Proj. Fechamento'],
  ];
  const fFmts = {};
  ok.forEach(b => {
    buildFarolExportGroups_(b.dispM, b.farol, b.monthlyClose, b.channels, chFilter, { from: b.mo.from, to: b.mo.to }, false).forEach(g => {
      (g.cards || []).forEach(mm2 => {
        if (!mm2) return;
        const r = fAoa.length;
        fAoa.push([g.title, b.mo.label, mm2.label,
          mm2.act != null ? mm2.act : null, mm2.bp != null ? mm2.bp : null, attain(mm2),
          mm2.m1 != null ? mm2.m1 : null, mm2.trend != null ? mm2.trend : null]);
        if (mm2.fmt) [3, 4, 6, 7].forEach(c => { fFmts[`${r},${c}`] = numFmt(mm2.fmt); });
        fFmts[`${r},5`] = PCT;
      });
    });
  });

  // ---------- Aba 2: Monthly Close YTD (formato longo, coluna Mês/Ano) ----------
  const mAoa = [
    ['RevOps Cockpit — Monthly Close (mês a mês)'],
    [`Período: ${periodo}`],
    [`Escopo: ${escLbl} (house-level segue o backend)`],
    ['Fonte: BigQuery (live)'],
    [],
    ['Seção', 'Mês/Ano', 'Métrica', 'ACT', 'BP', '% vs BP'],
  ];
  const mFmts = {};
  ok.forEach(b => {
    let sec = '';
    buildMonthlyCloseRows_(b.dispM, b.farol, b.monthlyClose).forEach(row => {
      if (row.sec) { sec = row.sec; return; }
      const r = mAoa.length;
      mAoa.push([sec, b.mo.label, row.label,
        row.act != null ? row.act : null, row.bp != null ? row.bp : null, monthlyClosePct_(row)]);
      if (row.fmt) { mFmts[`${r},3`] = numFmt(row.fmt); mFmts[`${r},4`] = numFmt(row.fmt); }
      mFmts[`${r},5`] = PCT;
    });
    // GGR e Turnover por SAFRA (idade de coorte M0/M+1/M+2/M3+) — sem BP (o plano não separa por safra).
    const safraRows = (title, obj) => {
      if (!obj) return;
      [['M0', 'm0'], ['M+1', 'm1'], ['M+2', 'm2'], ['M3+', 'm3plus']].forEach(([lbl, k]) => {
        const r = mAoa.length;
        mAoa.push([title, b.mo.label, lbl, obj[k] != null ? obj[k] : null, null, null]);
        mFmts[`${r},3`] = numFmt('brl');
      });
    };
    if (b.safra) { safraRows('GGR por safra', b.safra.ggr); safraRows('Turnover por safra', b.safra.turnover); }
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(fAoa);
  ws1['!cols'] = [{ wch: 13 }, { wch: 10 }, { wch: 24 }, { wch: 15 }, { wch: 15 }, { wch: 9 }, { wch: 15 }, { wch: 16 }];
  applyFmts(ws1, fFmts);
  XLSX.utils.book_append_sheet(wb, ws1, 'Farol');
  const ws2 = XLSX.utils.aoa_to_sheet(mAoa);
  ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 15 }, { wch: 15 }, { wch: 9 }];
  applyFmts(ws2, mFmts);
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Close');

  XLSX.writeFile(wb, `cockpit_farol_${startISO.replace(/-/g, '')}_${endISO.replace(/-/g, '')}.xlsx`);
}

function TabMonthlyClose({ M, farol, monthlyClose, range, isLive, ytd }) {
  // YTD é preset GLOBAL de data: a janela (appliedRange) já é abril→ontem, então usa o M/farol/monthlyClose
  // normais — a tabela ACT vs BP fica igual, só muda o rótulo/período p/ YTD.
  const useYtd = !!ytd;
  const rows = buildMonthlyCloseRows_(M, farol, monthlyClose);
  const pctBp = monthlyClosePct_;
  const pctCls = (p) => p == null ? '' : (p >= 0.95 ? 'ch-roas-pos' : p >= 0.85 ? '' : 'ch-roas-neg');
  const rangeLbl = (range && range.from) ? `${fmtBR_(range.from)} → ${fmtBR_(range.to)}` : '';
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Monthly Close</h1>
          <div className="subtitle">
            {useYtd
              ? <>YTD · acumulado desde abril · ACT (BigQuery) vs BP · {rangeLbl}{!isLive ? ' · dados mock' : ''}</>
              : <>Fechamento do mês · ACT (BigQuery) vs BP · {rangeLbl}{!isLive ? ' · dados mock' : ''}</>}
          </div>
        </div>
      </div>
      <div className="support">
        <div className="table-scroll"><table className="ch-table">
          <thead><tr><th>Métrica</th><th>ACT</th><th>BP</th><th>% vs BP</th></tr></thead>
          <tbody>
            {rows.map((r, i) => r.sec ? (
              <tr key={i}><td colSpan="4" style={{ fontWeight: 700, color: 'var(--accent-orange)', background: 'rgba(249,115,22,0.06)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>{r.sec}</td></tr>
            ) : (
              <tr key={i}>
                <td className="ch-name">{r.label}</td>
                <td>{fmtVal(r.act, r.fmt)}</td>
                <td>{r.bp != null ? fmtVal(r.bp, r.fmt) : '—'}</td>
                <td className={pctCls(pctBp(r))}>{pctBp(r) != null ? fmtPct(pctBp(r), 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="ch-note">
          <strong>ACT</strong> = realizado (BigQuery, mesma fonte/definição das outras abas — <strong>Investimento</strong> = spend de aquisição, <strong>#FTD</strong> = todos os canais). <strong>BP</strong> = plano prorrateado pela janela. <strong>M+1/M+2/M3+</strong> = depósito da safra por idade de coorte (M+1 = coorte de 1 mês atrás, etc.); soma com M0 = Total Deposit. BP de M+1/M+2/M3+ e Turnover só aparece onde o plano tem o valor. Segue o slicer de data/canal do topo.
        </div>
      </div>
    </React.Fragment>
  );
}
// ============================================================
// ABA ATIVAÇÃO D0 — sinais precoces da coorte de FTD (visão semanal, seg–dom).
// Seção D0: % que apostou no D0, turnover D0, aposta média/mediana D0, rollover D0 (turnover D0 ÷ dep D0).
// Seção janela 4D (dias 0–3): nº de apostas, dias que apostou ÷ 4, dias com atividade ÷ 4 (proxy de online —
// não há dado de login/sessão no player_metrics). Somas/contagens vêm do payload compartilhado `retencaoFaixa`
// (mesma coorte da aba Multiplicadores e Retenção, filtrada por canal client-side); a MEDIANA não compõe de
// linhas diárias → vem de `only=ativacao` pré-computada por (semana × escopo). "Apostou" = turnover > 0
// (não há split real×bônus na aposta — bônus é ~1% do turnover, então é bom proxy de "apostou saldo real").
// Chave de escopo p/ a mediana: canal específico (1 sel) · __growth__ (Canais Growth) · __total__ (Total Casa);
// combinação de 2+ canais não tem mediana pré-computada → "—".
function ativScopeKey_(chFilter) {
  const list = chList_(chFilter);
  if (list.length === 1) return list[0];
  if (list.length > 1) return null;
  return (chFilter && chFilter.scope === 'growth') ? '__growth__' : '__total__';
}
function TabAtivacao({ retencaoFaixa, chFilter, meta }) {
  const winFrom = meta && meta.from, winTo = meta && meta.to;
  // Filtros DA ABA (canal já é o slicer global): faixa de FTD e grupo de risco — iguais aos da aba
  // Multiplicadores e Retenção. Faixa filtra client-side (já vem no payload). Grupo exige a base &byGrupo=1.
  const [faixaSel, setFaixaSel] = React.useState([]);   // multi; [] = todas
  const [grupoSel, setGrupoSel] = React.useState([]);   // multi; [] = todos
  const grupoActive = grupoSel.length > 0;
  const faixaAll = faixaSel.length === 0;
  const faixaLabelTxt = faixaAll ? 'todas as faixas' : (faixaSel.length <= 2 ? faixaSel.map(fxLabel_).join(' + ') : faixaSel.length + ' faixas');
  const grupoLabelTxt = !grupoActive ? 'todos os grupos' : (grupoSel.length <= 2 ? grupoSel.map(grupoLabel_).join(' + ') : grupoSel.length + ' grupos');
  const grupoOptions = GRUPO_LIST;
  // JANELA cumulativa 0..N (seletor da aba). O backend manda TODAS as janelas (ativacaoAgg/Med/Online);
  // o toggle é CLIENT-SIDE (instantâneo). N=0 = só o dia do FTD; N=30 = dias 0..30 acumulados.
  const ATIV_WINS_F = [0, 1, 7, 14, 30];
  const [win, setWinRaw] = usePersistedState('rvops:ativWin', 0);
  const winN = ATIV_WINS_F.indexOf(win) >= 0 ? win : 0;
  const setWin = (v) => setWinRaw(ATIV_WINS_F.indexOf(v) >= 0 ? v : 0);
  // EIXO da tabela ("Ver por"): o que cada LINHA representa. Semana e Canal saem do MESMO payload week×canal
  // (client-side, sem re-fetch). Mês/Dia/Grupo/Faixa exigem reagrupar no servidor (a mediana não compõe) →
  // re-buscam com &axis=. (≠ da Janela D0..D30, que é sempre client-side.)
  const AXES = [
    { k: 'mes',    label: 'Mês' },
    { k: 'semana', label: 'Semana' },
    { k: 'dia',    label: 'Dia' },
    { k: 'canal',  label: 'Canal' },
    { k: 'grupo',  label: 'Grupo' },
    { k: 'faixa',  label: 'Faixa' },
  ];
  const AXIS_KEYS = AXES.map(a => a.k);
  const [axis, setAxisRaw] = usePersistedState('rvops:ativAxis', 'semana');
  const axisK = AXIS_KEYS.indexOf(axis) >= 0 ? axis : 'semana';
  const setAxis = (v) => setAxisRaw(AXIS_KEYS.indexOf(v) >= 0 ? v : 'semana');
  const axisNeedsFetch = (axisK === 'mes' || axisK === 'dia' || axisK === 'grupo' || axisK === 'faixa');   // grão que o backend reagrupa
  const axisQ = axisNeedsFetch ? `&axis=${axisK}` : '';
  // Fetch do only=ativacao: agg (somas por bucket×canal), med (medianas/quartis por bucket×escopo) e online —
  // TODOS com as 5 janelas. Re-busca quando faixa/grupo OU o eixo (mes/dia/grupo/faixa) mudam; janela não re-busca.
  const faixaQ = faixaSel.map(f => `&faixa=${encodeURIComponent(f)}`).join('');
  const grupoQ = grupoActive ? grupoSel.map(g => `&grupo=${encodeURIComponent(g)}`).join('') : '';
  const [med, setMed] = React.useState({ rows: null, online: null, agg: null, axisEcho: '', loading: false, error: null });
  React.useEffect(() => {
    if (!winFrom || !winTo || !ENDPOINT_URL) return;
    setMed(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${winFrom}&to=${winTo}&only=ativacao${faixaQ}${grupoQ}${axisQ}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setMed({ rows: j.ativacaoMed || [], online: j.ativacaoOnline || [], agg: j.ativacaoAgg || [], axisEcho: (j.meta && j.meta.axis) || '', loading: false, error: null }); })
      .catch(e => setMed({ rows: null, online: null, agg: null, axisEcho: '', loading: false, error: String(e.message || e) }));
  }, [winFrom, winTo, faixaQ, grupoQ, axisQ]);
  // Guarda: só renderiza quando o payload em mãos é do grão certo. Semana e Canal usam o payload DEFAULT
  // (axisEcho ''); mês/dia/grupo/faixa usam o payload com o mesmo &axis=. Enquanto o fetch do novo eixo não
  // chega (ou um deploy ainda propaga), a tabela mostra "carregando" em vez de dados no grão errado.
  const axisReady = axisNeedsFetch ? (med.axisEcho === axisK) : (med.axisEcho === '');
  // src = linhas do ativacaoAgg mapeadas p/ a JANELA selecionada, no formato que a agregação já espera
  // (canal/week + campos da janela). faixa/grupo já vêm filtrados do servidor → sem filtro client-side.
  const src = React.useMemo(() => (med.agg || []).map(r => ({
    canal: r.canal, date: r.week, week: r.week, qtdFtds: r.ftds,
    betD0Cnt: r['bettors_' + winN], turnD0: r['turn_' + winN], depD0: r['dep_' + winN],
    bonusD0: r['bonus_' + winN], betCnt4d: r['betcnt_' + winN], betDays4d: r['betdays_' + winN],
  })), [med.agg, winN]);
  // Mapa de medianas/quartis/contagens por escopo e JANELA: medMap[week||'__all__'][key] = { n, p25_N, med_N, p75_N, p90_N, medbet_N, nbet_N, nbet2d_N }.
  const medMap = React.useMemo(() => {
    const m = {};
    (med.rows || []).forEach(r => { const wk = r.week || '__all__'; (m[wk] || (m[wk] = {}))[r.key] = r; });
    return m;
  }, [med.rows]);
  // Dias online (GA4) por semana × canal → onlineMap[week][canal] = { ftds, onlineDays }. Somas compõem
  // client-side (canal no cliente; faixa/grupo já vêm filtrados via os params do fetch).
  const onlineMap = React.useMemo(() => {
    const m = {};
    (med.online || []).forEach(r => { (m[r.week] || (m[r.week] = {}))[r.canal] = r; });
    return m;
  }, [med.online]);
  // GA4 confiável de jun/26 pra frente (começou ~mai). Janela toda em jun+ = hero online válido; senão "—".
  const GA4_WEEK_MIN = '2026-06-01';
  const ga4Full = !!(winFrom && winFrom >= GA4_WEEK_MIN);   // janela inteira coberta → hero online
  const ga4Any = !!(winTo && winTo >= GA4_WEEK_MIN);        // algum trecho coberto → mostra colunas semanais
  const scopeKey = ativScopeKey_(chFilter);
  const chLabel = chLabel_(chFilter);
  // Agrega por SEMANA (seg), no recorte de canal (slicer global) + faixa + grupo (filtros da aba).
  const selCh = chSelector_(chFilter);
  // Bônus (saldo real) no D0 só existe a partir do backend v40 (campo bonusD0 no retencaoFaixa). Sem ele,
  // a "dependência de bônus" fica "—" (não 0% — seria enganoso mostrar zero quando o dado ainda não veio).
  const hasBonus = React.useMemo(() => (src || []).some(r => r.bonusD0 != null), [src]);
  const { weeks, totals } = React.useMemo(() => {
    const wm = {};
    const zero = () => ({ qtd: 0, turnD0: 0, betD0: 0, depD0: 0, bonusD0: 0, bet4d: 0, betDays: 0, oDays: 0, oFtds: 0 });
    const tot = zero();
    // Chave da LINHA conforme o eixo: canal→o canal · semana→2ª-feira (re-bucketiza no cliente, idempotente) ·
    // mês/dia/grupo/faixa→o bucket que o backend já agregou (r.week carrega o valor do bucket do &axis=).
    const rowKeyOf = (canal, bucket) => axisK === 'canal' ? (canal || '—') : (axisK === 'semana' ? weekStartISO_(String(bucket)) : String(bucket));
    const addSrc = (o, r) => { o.qtd += r.qtdFtds || 0; o.turnD0 += r.turnD0 || 0; o.betD0 += r.betD0Cnt || 0; o.depD0 += r.depD0 || 0; o.bonusD0 += r.bonusD0 || 0; o.bet4d += r.betCnt4d || 0; o.betDays += r.betDays4d || 0; };
    (src || []).forEach(r => {
      if (!selCh(r.canal)) return;   // canal é client-side; faixa/grupo já filtrados no servidor
      const k = rowKeyOf(r.canal, r.week);
      const b = wm[k] || (wm[k] = zero());
      addSrc(b, r); addSrc(tot, r);
    });
    // Dias online (GA4): mesmo grão do eixo (o backend bucketiza o online por &axis=); no eixo Canal soma por canal.
    Object.keys(onlineMap).forEach(bucket => {
      Object.keys(onlineMap[bucket]).forEach(canal => {
        if (!selCh(canal)) return;
        const o = onlineMap[bucket][canal];
        const k = rowKeyOf(canal, bucket);
        const b = wm[k] || (wm[k] = zero());
        const od = o['onlineDays_' + winN] || 0, of = o.ftds || 0;
        b.oDays += od; b.oFtds += of; tot.oDays += od; tot.oFtds += of;
      });
    });
    const denom = winN + 4;   // dias-apostou/online usam janela [0, N+3] (regra Luis) → denominador N+4
    const isTimeAxis = (axisK === 'semana' || axisK === 'mes' || axisK === 'dia');
    // GA4: eixos de TEMPO gateiam por data do bucket (esconde pré-jun/26); eixos de DIMENSÃO (canal/grupo/faixa)
    // não têm data por linha → gateiam pela janela toda (ga4Full: online só se a janela inteira é jun/26+).
    const gaOk = (key, isTot) => (isTot || !isTimeAxis) ? ga4Full : (String(key) >= GA4_WEEK_MIN);
    const derive = (b, key, isTot) => {
      // Mediana: eixo Canal → mediana da janela toda POR canal (medMap['__all__'][canal]); demais eixos → escopo do
      // slicer no bucket da linha; linha Total → escopo do slicer na janela toda ('__all__').
      const mrow = isTot
        ? ((scopeKey && medMap['__all__']) ? medMap['__all__'][scopeKey] : null)
        : (axisK === 'canal'
            ? ((medMap['__all__'] || {})[key] || null)
            : ((scopeKey && medMap[key] && medMap[key][scopeKey]) ? medMap[key][scopeKey] : null));
      return {
        week: key, qtd: b.qtd, turnD0: b.turnD0, bonusD0: b.bonusD0,
        pctBet: b.qtd ? b.betD0 / b.qtd : null,
        meanBet: b.qtd ? b.turnD0 / b.qtd : null,
        medBet: mrow ? mrow['med_' + winN] : null,
        rollMed: (mrow && mrow['medDep_' + winN]) ? mrow['med_' + winN] / mrow['medDep_' + winN] : null,   // rollover mediano = aposta mediana ÷ depósito mediano
        rollover: b.depD0 ? b.turnD0 / b.depD0 : null,
        bonusDep: (hasBonus && b.depD0) ? b.bonusD0 / b.depD0 : null,
        vezes: b.qtd ? b.bet4d / b.qtd : null,
        vezesMed: mrow ? mrow['medbet_' + winN] : null,
        betDaysR: b.qtd ? b.betDays / (denom * b.qtd) : null,
        onlineR: (gaOk(key, isTot) && b.oFtds) ? b.oDays / (denom * b.oFtds) : null,
      };
    };
    let ks = Object.keys(wm);
    if (axisK === 'canal') ks.sort((a, b) => (wm[b].qtd || 0) - (wm[a].qtd || 0));   // canal por volume (desc)
    else ks.sort();   // tempo (ISO) / grupo ('0'..'sem grupo') / faixa ('01.'..'05.') ordenam bem lexicograficamente
    return { weeks: ks.map(k => derive(wm[k], k, false)), totals: derive(tot, '__all__', true) };
  }, [src, selCh, medMap, onlineMap, scopeKey, ga4Full, hasBonus, winN, axisK]);

  const T = totals;
  const winLbl = winN === 0 ? 'D0' : `D0–D${winN}`;   // rótulo da janela cumulativa
  // Rótulo de cada LINHA conforme o eixo (a chave `r.week` carrega o valor do bucket).
  const rowLabel = (k) => {
    if (axisK === 'canal') return String(k);
    if (axisK === 'grupo') return grupoLabel_(k);
    if (axisK === 'faixa') return fxLabel_(k);
    if (axisK === 'mes')   return monthLabelPt_(k);   // 'YYYY-MM-01' → 'Julho/2026'
    if (axisK === 'dia')   return fmtBR_(k);          // 'YYYY-MM-DD' → 'DD/MM/YYYY'
    return weekLabel_(k);                             // semana → 'DD/MM–DD/MM'
  };
  const axisNoun = ({ semana: 'safra', mes: 'mês', dia: 'dia', canal: 'canal', grupo: 'grupo de risco', faixa: 'faixa de FTD' })[axisK] || 'safra';
  const axisCol  = ({ semana: 'Safra', mes: 'Mês', dia: 'Dia', canal: 'Canal', grupo: 'Grupo', faixa: 'Faixa' })[axisK] || 'Safra';
  const rowNote  = axisK === 'semana' ? 'Cada linha = uma semana de safra (2ª–dom).'
    : axisK === 'mes'   ? 'Cada linha = um mês de safra (pela data do FTD).'
    : axisK === 'dia'   ? 'Cada linha = um dia de safra (data do FTD) — as últimas datas ainda maturam nas janelas maiores.'
    : axisK === 'canal' ? 'Cada linha = um canal de aquisição (janela toda; ordenado por volume de FTD).'
    : axisK === 'grupo' ? 'Cada linha = um grupo de risco (janela toda).'
    :                     'Cada linha = uma faixa de valor do FTD (janela toda).';
  const rng = (key) => { const v = weeks.map(x => x[key]).filter(x => x != null && !isNaN(x)); return v.length ? { min: Math.min(...v), max: Math.max(...v) } : { min: 0, max: 1 }; };
  const rPct = rng('pctBet'), rRoll = rng('rollover'), rRollMed = rng('rollMed');
  const heat = (v, r) => ({ background: heatBg_(v, r.min, r.max) });
  const filtSuffix = `${winLbl} · ${chLabel}${faixaAll ? '' : ' · ' + faixaLabelTxt}${grupoActive ? ' · ' + grupoLabelTxt : ''}`;
  const srcLoad = med.loading ? ' · carregando…' : (med.error ? ' · erro' : '');
  const cells = (r) => [
    <td key="q">{fmtQty(r.qtd)}</td>,
    <td key="pb" style={heat(r.pctBet, rPct)}>{fmtPct(r.pctBet, 1)}</td>,
    <td key="am">{fmtBRL(r.meanBet)}</td>,
    <td key="md">{fmtBRL(r.medBet)}</td>,
    <td key="ro" style={heat(r.rollover, rRoll)}>{fmtMultiple(r.rollover)}</td>,
    <td key="rm" style={heat(r.rollMed, rRollMed)}>{fmtMultiple(r.rollMed)}</td>,
    <td key="bd">{fmtPct(r.betDaysR, 1)}</td>,
    <td key="on">{fmtPct(r.onlineR, 1)}</td>,
  ];
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Ativação D0</h1>
          <div className="subtitle">Sinais precoces da coorte de FTD — o que o novo jogador faz na janela após o 1º depósito (D0 → D30, cumulativa e selecionável). Escolha o eixo em "Ver por" (mês/semana/dia/canal/grupo/faixa). Segue o slicer de canal · {chLabel}</div>
        </div>
      </div>
      <div className="slicer-group slicer-ruler">
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Janela</label>
        <div className="slicer-presets">
          {ATIV_WINS_F.map(n => (
            <button key={n} className={`preset-btn ${winN === n ? 'active' : ''}`} onClick={() => setWin(n)} title={n === 0 ? 'Só o dia do FTD (D0)' : `Dias 0 a ${n} acumulados`}>{n === 0 ? 'D0' : 'D' + n}</button>
          ))}
        </div>
        <span className="slicer-divider" style={{ margin: '0 4px' }} />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ver por</label>
        <div className="slicer-presets">
          {AXES.map(a => (
            <button key={a.k} className={`preset-btn ${axisK === a.k ? 'active' : ''}`} onClick={() => setAxis(a.k)} title={`Uma linha por ${({ semana: 'semana de safra', mes: 'mês', dia: 'dia', canal: 'canal', grupo: 'grupo de risco', faixa: 'faixa de FTD' })[a.k]}`}>{a.label}</button>
          ))}
        </div>
        <span className="slicer-divider" style={{ margin: '0 4px' }} />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Faixa FTD</label>
        <ChannelMultiSelect options={FAIXA_LIST} selected={faixaSel} onChange={setFaixaSel} labelOf={fxLabel_} allLabel="Todas" countNoun="faixas" />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Grupo de risco</label>
        <ChannelMultiSelect options={grupoOptions} selected={grupoSel} onChange={setGrupoSel} labelOf={grupoLabel_} allLabel="Todos" countNoun="grupos" />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Canal: use os slicers do topo{srcLoad}</span>
      </div>
      <div className="support">
        <div className="support-title">Ativação por {axisNoun} · {filtSuffix}</div>
        <div className="ch-note" style={{ marginTop: '-4px', marginBottom: '10px' }}>Apostas com saldo real (valor apostado &gt; 0, exclui freespin). D0 = dia do FTD. {rowNote} Medianas (Aposta Med / Rollover Med) recalculadas no grão do eixo.{srcLoad}</div>
        <div className="table-scroll tall"><table className="ch-table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>{axisCol}</th>
                <th title="Qtd de FTDs na linha">Qtd FTD</th>
                <th title="% dos FTDs que apostaram saldo real (valor apostado > 0) na janela selecionada">% Apostou</th>
                <th title="Valor apostado ÷ Qtd FTD">Aposta Méd.</th>
                <th title="Mediana do valor apostado na janela por jogador (por escopo, no grão do eixo)">Aposta Med.</th>
                <th title="Valor apostado ÷ Depósito da janela (agregado da casa)">Rollover</th>
                <th title="Aposta mediana ÷ Depósito mediano — rollover do jogador típico (robusto a whale)">Rollover Med</th>
                <th title="Dias distintos apostando na janela 0–(N+3) ÷ (N+4), média. Em D0 = 4 dias (0–3) ÷ 4 (métrica de engajamento, sempre olha ≥4 dias).">Dias Apostou %</th>
                <th title="% de dias distintos ONLINE (login/sessão no GA4) na janela 0–(N+3) ÷ (N+4), média — NÃO é % de jogadores que logaram. Em D0 = 4 dias (0–3) ÷ 4. Cobre ~99% das contas FTD; confiável de jun/26.">Dias Online %</th>
              </tr>
            </thead>
            <tbody>
              {axisReady
                ? weeks.map((r, i) => (<tr key={i}><td className="ch-name">{rowLabel(r.week)}</td>{cells(r)}</tr>))
                : (<tr><td className="ch-name" colSpan={9} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '18px' }}>{med.error ? 'Erro ao carregar.' : 'Carregando eixo…'}</td></tr>)}
            </tbody>
            <tfoot>
              {axisReady && <tr><td>Total</td>{cells(T)}</tr>}
            </tfoot>
          </table></div>
      </div>
    </React.Fragment>
  );
}

// ============================================================
// ABA DAILY CASHFLOW — o PnL do BP (`BP Update_Apostou_RF.xlsx`, aba PnL) rodado no grão DIÁRIO,
// com os actuals vindos do BigQuery. Mesma sequência de linhas e a mesma lógica de premissa:
//   • ACTUAL (BQ)   → GGR Bruto (ggr_total), FreeSpins (valor_wins_freespin), GGR (ngr_total),
//                     Incentivos e Bonificações (valor_bonus_saldo_real_dia) e Tráfego (spend, mesmo
//                     ajuste do Farol: imposto Meta ×1,1383 + CPA proxy da Programática).
//                     → a BONIFICAÇÃO é o % REALIZADO do dia, não o −31,6% fixo da coluna B do arquivo.
//   • % DO GGR      → Repasse Social 13% · Impostos 10,5% · Custos Variáveis 43,24% (col B15 do arquivo).
//                     ⚠️ No regime CAIXA a base é o GGR do MÊS ANTERIOR (pró-rata pelos dias do mês
//                     corrente): incidem sobre a receita de um mês, mas só são pagos no seguinte.
//   • PRÓ-RATA      → Custos Fixos, Despesas, Resultado Financeiro, Depreciação, Influencer e Creator:
//                     valor MENSAL ÷ dias do mês daquele dia. Somado na janela = pró-rata do MTD
//                     (é a regra "Pro-Rata" escrita na própria aba PnL, linha 48 do arquivo).
//   • DESLIGADO     → Créditos de PIS/COFINS (era +10% do investimento no arquivo) e IRPJ/CSL.
// ⚠️ DOIS REGIMES (toggle na barra, ver CF_REGIMES) — mesmas fontes e premissas, muda QUANDO o dinheiro
//    é reconhecido: `pnl` = COMPETÊNCIA (Meta do próprio mês dentro do Tráfego, % sobre o GGR do próprio
//    mês, COM Depreciação; bate com o Farol e com a aba PnL do arquivo) · `caixa` = quando o dinheiro SAI
//    (investimento por FATURA, Repasse/Impostos/Custo Variável sobre o GGR do MÊS ANTERIOR, e SEM
//    Depreciação — lançamento contábil não é desembolso). Os dois vão até Resultado Líquido.
//    O `caixa` reproduz a linha 37 do arquivo (`FCL Operacional Estimado`), que é a linha de caixa do BP —
//    e NÃO a linha 34 (Resultado Líquido do PnL). Diferenças que sobram contra ela são só premissas já
//    conhecidas (alíquota 10,5% × 10,3%, bonificação realizada × 31,6% fixo, créditos desligados).
//    O que está descrito daqui pra baixo sobre fatura vale SÓ no regime `caixa`.
//   • INVESTIMENTO POR FATURA → Regra do Luis (07/08/2026), que é a da linha 37 do arquivo: o mês paga o
//                     que VENCEU, não o que gastou. Em julho saem a fatura de Google/TikTok/ADSPLAY/
//                     Programática de JUNHO e a fatura da Meta de MAIO (a Meta tem prazo maior — "35 dias"
//                     na linha dela no arquivo, o que atravessa mais um fechamento). Ambas em PARCELA
//                     ÚNICA no dia `CF_ASSUM.metaPayDay`. ⚠️ NÃO usar pró-rata aqui: fatura é evento, não
//                     diária — com pró-rata a janela YTD (abr→05/08) reconhecia só 5/31 da fatura e o
//                     Tráfego saía R$ 1,5 M menor do que deveria. O que foi GASTO no mês aparece nas duas
//                     linhas memo do rodapé (não-Meta e Meta), fora de todo subtotal. Vale SÓ AQUI: Farol e
//                     demais abas seguem competência, com o spend do próprio mês dentro.
// ESCOPO = CASA INTEIRA: NÃO segue o slicer de canal (o PnL é da empresa; ratear custo fixo/despesa/
// depreciação por canal não tem regra definida). Sinal = o do arquivo: custo negativo.
// ============================================================
const CF_ASSUM = {
  // % sobre o GGR (linha 9 do PnL). Repasse e Imposto foram TRAVADOS pelo Luis (13% / 10,5%);
  // o custo variável segue a premissa da coluna B15 do arquivo (junho realizado ÷ GGR).
  pctRepasse:  0.13,
  pctImpostos: 0.105,
  pctCustoVar: 0.43242091501568786,
  pctCreditos: 0,      // "no credits for now" — no arquivo era +10% do Investimento Total (B13 × linha 19)
  pctIrpj:     0,      // IRPJ/CSL zerado no arquivo (B33 = 0)
  // Valores MENSAIS cheios (col G/H da aba PnL) — entram pró-rata por dia.
  mensal: {
    custosFixos:  599331.38,   // G17/H17
    despesas:     377195.86,   // G28/H28
    resultadoFin:   3000.00,   // H30 — "Manter fixo 3k" (nota B29 do arquivo)
    depreciacao:  194444.44,   // G31/H31
    influencer:    84000.00,   // G25/H25 — INFLUENCER/PATROCINIO (contrato, não tem no BQ)
    creator:       23500.00,   // G26/H26 — CREATOR (contrato, não tem no BQ)
  },
  // Dia do mês em que as FATURAS de investimento saem do caixa (não-Meta de M−1 e Meta de M−2).
  // Lançamento em PARCELA ÚNICA (não pró-rata): fatura é evento, não diária. Se o mês tiver menos
  // dias que isso, cai no último dia.
  // ⚠️ Trocar aqui se o débito real for outro dia — é a única constante que governa a data. Hoje é
  // uma data só pra todos os fornecedores; se algum vencer em dia diferente, vira mapa por canal.
  metaPayDay: 1,
};

// Dias do mês a que o dia ISO pertence — base do pró-rata (fev=28/29, abr=30, jul=31…).
function cfDaysInMonth_(iso) {
  const [y, m] = String(iso).split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
// R$ cheio, sem abreviar — numa tabela de PnL a ordem de grandeza tem que ser lida direto.
function cfBRL(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + 'R$ ' + Math.round(Math.abs(n)).toLocaleString('pt-BR');
}

// Linhas do PnL, na ordem do arquivo. `src` governa o rótulo de origem e o estilo:
// act = realizado do BQ · pct = % do GGR · fix = valor fixo pró-rata · calc = subtotal · off = desligado.
// `only` = a linha só existe num dos regimes (ver CF_REGIMES): as duas linhas da Meta defasada são
// exclusivas do CAIXA; a Depreciação é exclusiva do PnL (não é saída de caixa, é lançamento contábil).
const CF_LINES = [
  { k: 'ggrBruto',    label: 'GGR Bruto',                     src: 'act' },
  { k: 'freespin',    label: 'FreeSpins',                     src: 'act' },
  { k: 'ggr',         label: 'GGR Líquido',                   src: 'act',  strong: true },
  { k: 'bonif',       label: 'Incentivos e Bonificações',     src: 'act' },
  // No CAIXA estes três saem no mês SEGUINTE → o percentual incide sobre o GGR do mês anterior.
  // O rótulo e o tag mudam junto, senão o leitor tenta bater o valor contra o GGR da tela e não fecha.
  { k: 'repasse',     label: 'Repasse Social — Entidades',    src: 'pct', labelCaixa: 'Repasse Social — Entidades (mês anterior)', srcCaixa: 'pctPrev' },
  { k: 'imposto',     label: 'Impostos',                      src: 'pct', labelCaixa: 'Impostos (mês anterior)',                  srcCaixa: 'pctPrev' },
  { k: 'credito',     label: 'Créditos de PIS/COFINS',        src: 'off' },
  { k: 'ngr',         label: 'NGR',                           src: 'calc', strong: true },
  { k: 'custoVar',    label: 'Custos Variáveis',              src: 'pct', labelCaixa: 'Custos Variáveis (mês anterior)',           srcCaixa: 'pctPrev' },
  { k: 'mc',          label: 'Margem de Contribuição',        src: 'calc', strong: true },
  { k: 'custosFixos', label: 'Custos Fixos',                  src: 'fix' },
  { k: 'lbSemMkt',    label: 'Lucro Bruto s/ Marketing',      src: 'calc', strong: true },
  { k: 'investTotal', label: 'Investimento Total',            src: 'calc', strong: true },
  // No PnL o Tráfego é o spend cheio do mês (Meta inclusa) — não tem o que separar, daí o rótulo curto.
  // No caixa é a FATURA do mês anterior (sem Meta, que tem prazo maior e vem na linha seguinte).
  { k: 'trafego',     label: 'Tráfego', labelCaixa: 'Tráfego — fatura do mês anterior (sem Meta)', src: 'act', sub: true },
  { k: 'metaPago',    label: 'Meta — fatura de 2 meses atrás', src: 'act',  sub: true, only: 'caixa' },
  { k: 'influencer',  label: 'Influencer / Patrocínio',       src: 'fix',  sub: true },
  { k: 'creator',     label: 'Creator',                       src: 'fix',  sub: true },
  { k: 'lbComMkt',    label: 'Lucro Bruto c/ Marketing',      src: 'calc', strong: true },
  { k: 'despesas',    label: 'Despesas',                      src: 'fix' },
  { k: 'ebitda',      label: 'EBITDA',                        src: 'calc', strong: true },
  { k: 'resFin',      label: 'Resultado Financeiro',          src: 'fix' },
  { k: 'depre',       label: 'Depreciações e Amortizações',   src: 'fix',  only: 'pnl' },
  { k: 'lai',         label: 'Lucro Antes de Impostos',       src: 'calc', strong: true },
  { k: 'irpj',        label: 'IRPJ/CSL',                      src: 'off' },
  { k: 'resLiq',      label: 'Resultado Líquido',             src: 'calc', strong: true },
  // MEMO — fora de todo subtotal acima. Fica no rodapé da tabela pra não sumir da vista.
  // MEMO — o gasto FEITO neste mês, que só vira caixa lá na frente. Fica visível pra ninguém achar
  // que o investimento do mês sumiu, e pra dar o tamanho do que vai vencer.
  { k: 'trafegoDefer', label: 'Tráfego não-Meta gasto no mês (sai no mês seguinte)', src: 'memo', only: 'caixa' },
  { k: 'metaDefer',   label: 'Meta gasta no mês (sai daqui a 2 meses)', src: 'memo', only: 'caixa' },
];

// ============================================================
// REGIME — as duas leituras da mesma linha de baixo. Mesmas premissas, mesmas fontes; muda QUANDO
// o dinheiro é reconhecido e, por consequência, quais linhas existem.
//   • pnl   = COMPETÊNCIA. O gasto conta no mês em que foi FEITO, então a Meta do próprio mês entra
//             direto no Tráfego e não há fatura defasada nem linha memo. Depreciação ENTRA (é PnL).
//             É o que bate com o Farol e com a aba PnL do arquivo.
//   • caixa = quando o dinheiro SAI. A Meta do mês vira fatura paga no mês seguinte (parcela única,
//             ver CF_ASSUM.metaPayDay) e a Depreciação SAI — não é desembolso, é lançamento contábil.
// Os dois vão até Resultado Líquido: o que muda é o caminho, não onde termina.
// ============================================================
const CF_REGIMES = [
  { k: 'pnl',   label: 'PnL (competência)', tip: 'Gasto no mês em que foi feito — Meta do próprio mês dentro do Tráfego, com Depreciação. É a leitura que bate com o Farol e com a aba PnL do arquivo.' },
  { k: 'caixa', label: 'Caixa',             tip: 'Quando o dinheiro sai — Meta paga no mês seguinte (fatura em parcela única) e sem Depreciação, que não é desembolso.' },
];
// BLOCOS RECOLHÍVEIS — num PnL as linhas que compõem um subtotal vêm ACIMA dele, então cada
// subtotal fecha (e manda em) o bloco que está logo acima. Recolher = esconder o detalhe e deixar
// só a linha grande. Regra: TODO subtotal `calc` é recolhível, inclusive os aninhados
// (Investimento Total dentro de Lucro c/ Mkt; LAI dentro de Resultado Líquido) — recolher o pai
// leva os filhos junto (ver cfHiddenBy_). Recolher tudo = a leitura de PnL em 7 linhas.
const CF_GROUPS = [
  { k: 'ggr',         of: ['ggrBruto', 'freespin'] },
  { k: 'ngr',         of: ['bonif', 'repasse', 'imposto', 'credito'] },
  { k: 'mc',          of: ['custoVar'] },
  { k: 'lbSemMkt',    of: ['custosFixos'] },
  { k: 'investTotal', of: ['trafego', 'metaPago', 'influencer', 'creator'] },
  { k: 'lbComMkt',    of: ['investTotal'] },
  { k: 'ebitda',      of: ['despesas'] },
  { k: 'lai',         of: ['resFin', 'depre'] },
  { k: 'resLiq',      of: ['lai', 'irpj'] },
];
// linha → subtotal que a esconde, e subtotal → quantas linhas ele engole (contando as aninhadas)
const CF_OWNER = {};
CF_GROUPS.forEach(g => g.of.forEach(k => { CF_OWNER[k] = g.k; }));
const CF_GROUP_KEYS = CF_GROUPS.map(g => g.k);
// Quantas linhas cada subtotal engole — contado sobre o conjunto de linhas do REGIME em uso, senão
// o badge "+N" prometeria linhas que aquele regime nem tem (ex.: Depreciação no Caixa).
function cfGroupSizes_(lines) {
  const out = {};
  CF_GROUP_KEYS.forEach(k => { out[k] = 0; });
  lines.forEach(l => { for (let o = CF_OWNER[l.k]; o; o = CF_OWNER[o]) out[o]++; });
  return out;
}
// Está escondida se QUALQUER ancestral estiver recolhido (Lucro c/ Mkt recolhido some com Tráfego).
function cfHiddenBy_(k, isOn) {
  for (let o = CF_OWNER[k]; o; o = CF_OWNER[o]) if (isOn(o)) return true;
  return false;
}

const CF_SRC_LBL = { act: 'BQ', pct: '% GGR', pctPrev: '% GGR M-1', fix: 'pró-rata', calc: '=', off: 'off', memo: 'memo' };
const CF_SRC_TIP = {
  act:  'Realizado — vem do BigQuery',
  pct:  'Premissa: percentual sobre o GGR',
  pctPrev: 'Premissa: percentual sobre o GGR do mês ANTERIOR — no caixa, repasse, imposto e custo variável do mês são pagos no mês seguinte',
  fix:  'Valor mensal fixo do BP, dividido pelos dias do mês (pró-rata)',
  calc: 'Subtotal calculado',
  off:  'Desligado nesta versão (fica em zero)',
  memo: 'Memória de cálculo — NÃO entra em nenhum subtotal desta aba',
};

// Fecha os subtotais a partir das linhas-componente. Vive fora do cfCalcDay_ porque a PROJEÇÃO de
// fechamento usa exatamente as mesmas identidades: ela projeta as PARTES e recalcula os subtotais
// daqui, em vez de escalar um subtotal (que faria as linhas não fecharem entre si).
function cfRollup_(o) {
  o.ngr         = o.ggr + o.bonif + o.repasse + o.imposto + o.credito;
  o.mc          = o.ngr + o.custoVar;
  o.lbSemMkt    = o.mc + o.custosFixos;
  o.investTotal = o.trafego + o.metaPago + o.influencer + o.creator;
  o.lbComMkt    = o.lbSemMkt + o.investTotal;
  o.ebitda      = o.lbComMkt + o.despesas;
  o.lai         = o.ebitda + o.resFin + o.depre;
  o.resLiq      = o.lai + o.irpj;
  return o;
}

// PROJEÇÃO DE FECHAMENTO — o que o mês deve fechar, dado o que já entrou.
// Só faz sentido numa janela que é UM mês começando no dia 1: projetar "fechamento" de um recorte
// 05→10/07 não quer dizer nada. Fora disso devolve null e a coluna mostra "—".
// Regra POR TIPO de linha (é o ponto todo — escalar tudo por dia daria número errado):
//   • fluxo diário (GGR, FreeSpins, bonificação, spend) e pró-rata (custos fixos, despesas, e no
//     caixa os % sobre o GGR do mês anterior) → realizado + média dos dias COMPLETOS × dias que faltam.
//     O último dia entra no realizado mas fica FORA da média: costuma vir parcial do BQ e puxaria a
//     projeção pra baixo (é o mesmo aviso que a aba já dá no rodapé).
//   • FATURA (Tráfego e Meta no caixa) → o valor da fatura, que já é conhecido INTEIRO desde o dia 1.
//     Não escala: é evento, não fluxo. Escalando, o Tráfego projetado sairia ~4× maior.
//   • subtotais → recalculados das partes projetadas, via cfRollup_.
// `tot` = realizado da janela · `days` = dias já calculados · `fat` = faturas do mês (só caixa).
function cfProject_(days, tot, dataMaxDate, caixa, fat) {
  if (!days.length) return null;
  const meses = {};
  days.forEach(x => { meses[x.d.slice(0, 7)] = 1; });
  if (Object.keys(meses).length !== 1) return null;          // janela cruza meses
  if (Number(days[0].d.slice(8, 10)) !== 1) return null;     // não começa no dia 1
  const dim = cfDaysInMonth_(days[0].d);
  const ultimo = Number(days[days.length - 1].d.slice(8, 10));
  const restantes = dim - ultimo;
  // O último dia da série costuma estar incompleto — tira ele da MÉDIA (mas não do realizado).
  const parcial = !!dataMaxDate && days[days.length - 1].d === dataMaxDate && days.length > 1;
  const usados = days.slice(0, days.length - (parcial ? 1 : 0));
  const o = {};
  CF_LINES.forEach(l => {
    if (l.src === 'calc') return;                            // subtotal: sai do cfRollup_ abaixo
    if (caixa && (l.k === 'trafego' || l.k === 'metaPago')) return;   // fatura: tratada fora do laço
    const soma = usados.reduce((a, x) => a + (x.v[l.k] || 0), 0);
    o[l.k] = (tot[l.k] || 0) + (soma / usados.length) * restantes;
  });
  if (caixa) {
    o.trafego  = -((fat && fat.outros) || 0);
    o.metaPago = -((fat && fat.meta) || 0);
  }
  cfRollup_(o);
  return { v: o, dim: dim, decorridos: ultimo, restantes: restantes, baseDias: usados.length, parcial: parcial };
}

// Um dia do PnL. `r` = linha crua do backend (only=cashflow); o resto é premissa.
// `investPrev` = mapa { 'YYYY-MM': { outros, meta } } — as FATURAS que vencem naquele mês.
function cfCalcDay_(r, investPrev, regime, ggrPrev) {
  const A = CF_ASSUM;
  const caixa = regime !== 'pnl';          // default histórico da aba = caixa
  const dim = cfDaysInMonth_(r.d);
  const ym = String(r.d).slice(0, 7);
  // Faturas que vencem NESTE mês: não-Meta de M−1 e Meta de M−2.
  const fat = (investPrev && investPrev[ym]) || { outros: 0, meta: 0 };
  // Todas as faturas saem no MESMO dia (parcela única, não pró-rata — fatura é evento de caixa).
  const ehDiaFatura = Number(String(r.d).slice(8, 10)) === Math.min(A.metaPayDay, dim);
  const px = (v) => -(v / dim);            // valor mensal fixo → parcela do dia, com sinal de custo
  const ggr = r.ggr || 0;
  // BASE dos percentuais. Competência: o GGR do próprio dia. Caixa: o GGR do mês ANTERIOR, rateado
  // pelos dias do mês corrente — repasse, imposto e custo variável sobre a receita de um mês só saem
  // do caixa no mês seguinte (regra do Luis 07/08/2026, e é o que a linha 37 do BP faz).
  // Pró-rata e não parcela única (como a Meta): não é UMA fatura, são recolhimentos e taxas que se
  // espalham pelo mês — e assim uma janela parcial mostra a fração decorrida em vez de tudo ou nada.
  const ggrPrevMes = (ggrPrev && ggrPrev[ym]) || 0;
  const base = caixa ? (ggrPrevMes / dim) : ggr;
  const o = {
    ggrBruto:  r.ggrBruto || 0,
    freespin:  -(r.freespin || 0),
    ggr:       ggr,
    bonif:     -(r.bonus || 0),
    repasse:   -base * A.pctRepasse,
    imposto:   -base * A.pctImpostos,
    credito:   base * A.pctCreditos,
    custoVar:  -base * A.pctCustoVar,
    custosFixos: px(A.mensal.custosFixos),
    // CAIXA: o mês paga a FATURA de Google/TikTok/ADSPLAY/Programática do MÊS ANTERIOR…
    // COMPETÊNCIA (pnl): o spend cheio do próprio mês, Meta inclusa — é o mesmo número do Farol.
    // As faturas entram em PARCELA ÚNICA no dia de pagamento; NÃO pró-rata, porque fatura é evento
    // de caixa — com pró-rata uma janela terminada no meio do mês reconhecia só a fração decorrida
    // e o YTD perdia quase um mês inteiro de investimento.
    trafego:   caixa ? (ehDiaFatura ? -(fat.outros || 0) : 0) : -(r.spend || 0),
    // …e a fatura da META de DOIS meses atrás (prazo maior: "35 dias" na linha dela no arquivo,
    // o que atravessa mais um fechamento). No PnL não existe fatura: já está no Tráfego acima.
    metaPago:  (caixa && ehDiaFatura) ? -(fat.meta || 0) : 0,
    // MEMO (só no caixa): o que foi GASTO neste mês e ainda não virou caixa. Fora de todo subtotal.
    trafegoDefer: caixa ? -((r.spend || 0) - (r.spendMeta || 0)) : 0,
    metaDefer: caixa ? -(r.spendMeta || 0) : 0,
    influencer: px(A.mensal.influencer),
    creator:   px(A.mensal.creator),
    despesas:  px(A.mensal.despesas),
    resFin:    px(A.mensal.resultadoFin),
    // Depreciação é lançamento contábil, não desembolso → existe no PnL, não existe no caixa.
    depre:     caixa ? 0 : px(A.mensal.depreciacao),
    irpj:      0,
    dep:       r.dep || 0,               // depósitos do dia — não entra no PnL, serve de contexto
  };
  cfRollup_(o);
  return o;
}

function TabDailyCashflow({ range, meta }) {
  const [rows, setRows] = React.useState(null);
  const [investPrev, setInvestPrev] = React.useState(null);   // { 'YYYY-MM': { outros: não-Meta de M-1, meta: Meta de M-2 } }
  const [ggrPrev, setGgrPrev] = React.useState(null);     // { 'YYYY-MM': GGR do mês anterior } — base dos % no caixa
  const [loading, setLoading] = React.useState(!!ENDPOINT_URL);
  const [error, setError] = React.useState(null);
  const [view, setView] = usePersistedState('rvops:cfView', 'mtd');   // 'mtd' | 'diario'
  // Regime de reconhecimento: 'pnl' (competência) | 'caixa'. Default caixa — é como a aba nasceu.
  const [regime, setRegime] = usePersistedState('rvops:cfRegime', 'caixa');
  // Subtotais recolhidos (array de chaves, persistido). Vazio = tudo aberto, que é o default.
  const [collapsed, setCollapsed] = usePersistedState('rvops:cfCollapsed', []);

  React.useEffect(() => {
    if (!ENDPOINT_URL || !range) { setLoading(false); return; }
    let live = true; setLoading(true); setError(null);
    fetch(`${ENDPOINT_URL}?${authParam_()}&only=cashflow&from=${range.from}&to=${range.to}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (!live) return; if (j.error) throw new Error(j.error); setRows(j.cashflowDaily || []); setInvestPrev(j.cashflowInvestPrev || {}); setGgrPrev(j.cashflowGgrPrev || {}); setLoading(false); })
      .catch(e => { if (live) { setError(String(e.message || e)); setLoading(false); } });
    return () => { live = false; };
  }, [range && range.from, range && range.to]);

  if (!ENDPOINT_URL) return (<div className="tab-header"><div><h1>Daily Cashflow</h1><div className="subtitle">Disponível só no modo live (BigQuery).</div></div></div>);

  const src = rows || [];
  const isCaixa = regime === 'caixa';
  const days = src.map(r => ({ d: r.d, v: cfCalcDay_(r, investPrev, regime, ggrPrev) }));
  // Linhas que EXISTEM neste regime (as demais nem são somadas — no regime errado valem 0 mesmo).
  const regLines = CF_LINES.filter(l => !l.only || l.only === regime);
  // MTD = soma dos dias. Os fixos entram já pró-rateados por dia → a soma É o pró-rata da janela.
  const tot = {};
  CF_LINES.forEach(l => { tot[l.k] = 0; });
  tot.dep = 0;
  days.forEach(({ v }) => { CF_LINES.forEach(l => { tot[l.k] += v[l.k] || 0; }); tot.dep += v.dep || 0; });

  const pctGgr = (v) => (tot.ggr > 0 ? v / tot.ggr : null);
  // Quantos meses a janela toca — se >1, o pró-rata usa dias-do-mês diferentes por trecho (fica dito na nota).
  const monthsTouched = Array.from(new Set(days.map(x => x.d.slice(0, 7))));
  // Faturas de investimento que vencem em cada mês tocado. Dois avisos diferentes:
  //  • fatZero  = não há o que pagar (o mês de ORIGEM não teve spend) — ok, mas vale dizer.
  //  • fatFora  = a janela toca o mês mas NÃO inclui o dia do pagamento → a fatura INTEIRA fica de
  //    fora (ex.: janela 02→05/08 com pagamento no dia 1º). Sem o aviso o caixa parece bom sem motivo.
  const mesLbl = (m) => m.slice(5, 7) + '/' + m.slice(2, 4);
  const diasPorMes = {};
  days.forEach(x => { (diasPorMes[x.d.slice(0, 7)] = diasPorMes[x.d.slice(0, 7)] || []).push(Number(x.d.slice(8, 10))); });
  const fatDe = (m) => { const f = (investPrev && investPrev[m]) || {}; return (f.outros || 0) + (f.meta || 0); };
  const fatTot = -(tot.trafego + tot.metaPago) || 0;
  const fatZero = isCaixa ? monthsTouched.filter(m => !(fatDe(m) > 0)).map(mesLbl) : [];
  const fatFora = isCaixa ? monthsTouched.filter(m => {
    if (!(fatDe(m) > 0)) return false;
    const dim = cfDaysInMonth_(m + '-01');
    return (diasPorMes[m] || []).indexOf(Math.min(CF_ASSUM.metaPayDay, dim)) < 0;
  }).map(m => `${mesLbl(m)} (${cfBRL(fatDe(m))})`) : [];
  // Mesma armadilha da Meta, mas do outro lado: se o mês ANTERIOR não tem GGR na base (janela no
  // primeiro mês da série), repasse/imposto/custo variável saem ZERO no caixa e o resultado parece
  // ótimo sem motivo. Aviso explícito — silêncio aqui induz erro de leitura.
  const ggrPrevZero = isCaixa ? monthsTouched.filter(m => !((ggrPrev && ggrPrev[m]) > 0)).map(mesLbl) : [];
  // Projeção de fechamento do mês (coluna "Estimado fechamento"). Segue o regime em uso.
  const proj = cfProject_(days, tot, meta && meta.dataMaxDate, isCaixa,
    isCaixa ? (investPrev && investPrev[monthsTouched[0]]) : null);
  const dim0 = days.length ? cfDaysInMonth_(days[0].d) : null;
  const proRataPct = (monthsTouched.length === 1 && dim0) ? days.length / dim0 : null;

  const rowCls = (l) => `cf-row cf-${l.src}` + (l.strong ? ' cf-strong' : '') + (l.sub ? ' cf-sub' : '');
  const valCls = (v) => (v == null || isNaN(v)) ? '' : (v < 0 ? 'cf-neg' : (v > 0 ? 'cf-pos' : ''));
  const srcOf = (l) => (isCaixa && l.srcCaixa) ? l.srcCaixa : l.src;
  const srcTag = (l) => <span className="cf-tag" title={CF_SRC_TIP[srcOf(l)]}>{CF_SRC_LBL[srcOf(l)]}</span>;
  const dayLbl = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

  // Recolher/expandir. Os TOTAIS acima já foram somados sobre CF_LINES inteiro — esconder linha
  // é só apresentação, nenhum subtotal muda de valor.
  const isOn = (k) => collapsed.indexOf(k) >= 0;
  const toggle = (k) => setCollapsed(c => (c.indexOf(k) >= 0 ? c.filter(x => x !== k) : c.concat([k])));
  const allOn = CF_GROUP_KEYS.every(isOn);
  const gSize = cfGroupSizes_(regLines);
  const visLines = regLines.filter(l => !cfHiddenBy_(l.k, isOn));
  const lblOf = (l) => (isCaixa ? l.labelCaixa : l.labelPnl) || l.label;
  const cfLabel = (l) => {
    const n = gSize[l.k];
    if (!n) return lblOf(l);          // 0 = o regime não tem nenhuma linha sob esse subtotal
    const on = isOn(l.k);
    return (
      <button type="button" className="cf-toggle" onClick={() => toggle(l.k)}
        title={on ? `Expandir as ${n} linhas que compõem ${lblOf(l)}` : `Recolher as ${n} linhas que compõem ${lblOf(l)}`}>
        <span className={'cf-chev' + (on ? ' is-on' : '')}>▾</span>
        {lblOf(l)}
        {on && <span className="cf-count">+{n}</span>}
      </button>
    );
  };

  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Daily Cashflow</h1>
          <div className="subtitle">PnL do BP no grão diário — GGR, bonificação e investimento realizados do BigQuery; percentuais e fixos pela premissa do arquivo. Casa inteira (não segue o filtro de canal).</div>
        </div>
      </div>
      <div className="support">
        <div className="support-title">
          {isCaixa ? 'Caixa' : 'PnL (competência)'} · {view === 'mtd' ? 'MTD acumulado' : 'Diário'} · {fmtBR_(range.from)} → {fmtBR_(range.to)}
          {proRataPct != null && <> · fixos a <strong>{fmtPct(proRataPct, 0)}</strong> do mês ({days.length}/{dim0} dias)</>}
          {proj && proj.restantes > 0 && <> · estimativa sobre <strong>{proj.restantes}</strong> dia(s) que faltam</>}
          {proj && proj.restantes === 0 && <> · <strong>mês fechado</strong> — a estimativa é o próprio realizado</>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, margin: '2px 0 14px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Regime</span>
          <div className="slicer-presets">
            {CF_REGIMES.map(rg => (
              <button key={rg.k} className={`preset-btn ${regime === rg.k ? 'active' : ''}`}
                onClick={() => setRegime(rg.k)} title={rg.tip}>{rg.label}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>Visão</span>
          <div className="slicer-presets">
            <button className={`preset-btn ${view === 'mtd' ? 'active' : ''}`} onClick={() => setView('mtd')} title="Acumulado da janela, com os valores fixos pró-rateados pelos dias decorridos">MTD (pró-rata)</button>
            <button className={`preset-btn ${view === 'diario' ? 'active' : ''}`} onClick={() => setView('diario')} title="Uma coluna por dia — os fixos entram como mensal ÷ dias do mês">Diário</button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>Detalhe</span>
          <div className="slicer-presets">
            <button className="preset-btn" onClick={() => setCollapsed(allOn ? [] : CF_GROUP_KEYS.slice())}
              title={allOn ? 'Abrir todos os subtotais' : 'Deixar só as linhas grandes do PnL — clique no subtotal para abrir de novo'}>
              {allOn ? 'Expandir tudo' : 'Recolher tudo'}
            </button>
          </div>
        </div>
        {loading && <div className="ch-note">Carregando do BigQuery…</div>}
        {error && <div className="ch-note" style={{ color: 'var(--accent-red, #ef4444)' }}>Erro: {error}</div>}
        {!loading && !error && !days.length && <div className="ch-note">Sem dado na janela selecionada.</div>}

        {!loading && !error && !!days.length && view === 'mtd' && (
          <div className="table-scroll"><table className="ch-table cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Linha</th>
                <th style={{ textAlign: 'left', width: 90 }}>Fonte</th>
                <th>Valor</th>
                <th title="Participação da linha no GGR do período — mesma leitura da coluna B da aba PnL">% do GGR</th>
                <th title={proj
                  ? `Onde o mês deve fechar: o realizado até aqui + a média dos ${proj.baseDias} dia(s) completo(s) aplicada aos ${proj.restantes} dia(s) que faltam. Faturas e valores fixos do mês não escalam — já entram inteiros. Subtotais são recalculados das partes.`
                  : 'Só é calculado quando a janela é um mês inteiro começando no dia 1º'}>Estimado fechamento</th>
              </tr>
            </thead>
            <tbody>
              {visLines.map(l => (
                <tr key={l.k} className={rowCls(l)}>
                  <td style={{ textAlign: 'left' }}>{cfLabel(l)}</td>
                  <td style={{ textAlign: 'left' }}>{srcTag(l)}</td>
                  <td className={valCls(tot[l.k])}>{cfBRL(tot[l.k])}</td>
                  <td className="cf-dim">{l.k === 'ggr' ? '100%' : fmtPct(pctGgr(tot[l.k]), 1)}</td>
                  <td className={proj ? valCls(proj.v[l.k]) : 'cf-dim'}>{proj ? cfBRL(proj.v[l.k]) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Linha de fechamento. Antes era um colSpan={3} com só o % — o número caía embaixo de
                  "Média/dia", com "Valor" e "% do GGR" vazios, e lia como linha quebrada/sem soma.
                  Agora cada célula fica na SUA coluna, igual às demais: é o mesmo total da linha
                  Resultado Líquido, repetido no pé como fecha um PnL. */}
              <tr>
                {/* No caixa a linha de fechamento não é margem, é o FCL — mesmo nome da linha 37 do BP,
                    que é a linha de caixa do arquivo. Mesmo número do Resultado Líquido, repetido no pé. */}
                <td style={{ textAlign: 'left' }}>{isCaixa ? 'Fluxo de Caixa Livre' : 'Margem Líquida'}</td>
                <td />
                <td className={valCls(tot.resLiq)}>{cfBRL(tot.resLiq)}</td>
                <td>{fmtPct(pctGgr(tot.resLiq), 1)}</td>
                <td className={proj ? valCls(proj.v.resLiq) : ''}>{proj ? cfBRL(proj.v.resLiq) : '—'}</td>
              </tr>
            </tfoot>
          </table></div>
        )}

        {!loading && !error && !!days.length && view === 'diario' && (
          <div className="table-scroll tall"><table className="ch-table cf-table cf-daily">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Linha</th>
                {days.map(x => <th key={x.d} title={fmtBR_(x.d)}>{dayLbl(x.d)}</th>)}
                <th className="cf-total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              {visLines.map(l => (
                <tr key={l.k} className={rowCls(l)}>
                  <td style={{ textAlign: 'left' }}>{cfLabel(l)} {srcTag(l)}</td>
                  {days.map(x => <td key={x.d} className={valCls(x.v[l.k])}>{cfBRL(x.v[l.k])}</td>)}
                  <td className={'cf-total-col ' + valCls(tot[l.k])}>{cfBRL(tot[l.k])}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {/* Rodapé enxuto: fica à vista só o que muda a leitura do número na janela escolhida
            (alertas condicionais + até quando o dado foi carregado). O textão de premissas saiu da
            vista a pedido do Luis (06/08) e virou um "Premissas e método" recolhido — apagar de vez
            tiraria do cockpit a definição de cada linha (o que é realizado, o que é premissa, por que
            a Meta é defasada), que é justamente o que evita discussão sobre o número. */}
        <div className="ch-note">
          {/* Os dois avisos da Meta só fazem sentido no caixa — no PnL não existe fatura defasada. */}
          {fatFora.length > 0 && <div><strong>⚠️ Faturas fora da janela:</strong> o período toca {fatFora.join(', ')} mas não inclui o dia {CF_ASSUM.metaPayDay} desse(s) mês(es) — as faturas de investimento <strong>não</strong> estão no total. Amplie a janela para o início do mês para vê-las.</div>}
          {fatZero.length > 0 && <div><strong>Atenção:</strong> não há fatura de investimento a vencer em {fatZero.join(', ')} — os meses de origem não têm spend na base.</div>}
          {ggrPrevZero.length > 0 && <div><strong>⚠️ Sem GGR do mês anterior</strong> a {ggrPrevZero.join(', ')} — Repasse Social, Impostos e Custos Variáveis saem <strong>zerados</strong> nesse(s) mês(es), o que deixa o resultado melhor do que é. Amplie a janela ou leia no regime PnL.</div>}
          {monthsTouched.length > 1 && <div><strong>Atenção:</strong> a janela cruza {monthsTouched.length} meses — cada dia é pró-rateado pelos dias do <em>seu</em> mês, então o total dos fixos não é múltiplo redondo de um mês só.</div>}
          {!proj && !!days.length && view === 'mtd' && <div><strong>Estimado fechamento:</strong> só é calculado quando a janela é <strong>um mês inteiro começando no dia 1º</strong> — projetar "fechamento" de um recorte no meio do mês não quer dizer nada. Use o preset MTD ou Mês passado.</div>}
          {proj && proj.parcial && <div><strong>Estimado fechamento:</strong> a média usa os <strong>{proj.baseDias} dia(s) completo(s)</strong> — o dia {fmtBR_(meta.dataMaxDate)} entra no realizado mas fica fora da média, porque costuma vir parcial do BQ e puxaria a projeção pra baixo.</div>}
          {meta && meta.dataMaxDate && <div>Dado carregado no BQ até {fmtBR_(meta.dataMaxDate)} — o último dia da série costuma estar incompleto.</div>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Premissas e método</summary>
            <div style={{ marginTop: 6 }}>
          <strong>Do BigQuery (realizado):</strong> GGR Bruto = <code>ggr_total</code> · FreeSpins = <code>valor_wins_freespin</code> · GGR = <code>ngr_total</code> (identidade validada: GGR = GGR Bruto − FreeSpins) · Bonificações = <code>valor_bonus_saldo_real_dia</code> — ou seja, o <strong>% de bonificação é o realizado do dia</strong>, não o −31,6% fixo da coluna B do arquivo. <strong>Tráfego</strong> = spend da performance com os mesmos ajustes do Farol (imposto de fechamento da Meta ×1,1383 e CPA manual de R$ 90 × FTD na Programática, que não tem spend rastreado).
          <br /><strong>Os dois regimes:</strong> a mesma linha de baixo lida de duas formas — mesmas fontes e mesmas premissas, muda só <em>quando</em> o dinheiro é reconhecido. Ambos vão até Resultado Líquido.
          {isCaixa ? (
            <React.Fragment>
              <br /><strong>Caixa (em uso) — investimento por FATURA:</strong> o mês não paga o que gastou; paga o que venceu. Em cada mês saem a <strong>fatura de Google, TikTok, ADSPLAY e Programática do mês anterior</strong> e a <strong>fatura da Meta de dois meses atrás</strong> (a Meta tem prazo maior — "35 dias" na linha dela no arquivo, o que atravessa mais um fechamento){fatTot > 0 && <> — {cfBRL(fatTot)} na janela</>}. Ex.: em <em>julho</em> sai Google/TikTok/demais de <em>junho</em> e Meta de <em>maio</em>. As faturas entram em <strong>parcela única no dia {CF_ASSUM.metaPayDay}</strong>, não pró-rata — fatura é evento de caixa, e o pró-rata fazia uma janela terminada no meio do mês reconhecer só a fração decorrida (numa janela YTD sumia com quase um mês inteiro de investimento). O que foi <em>gasto</em> neste mês aparece nas duas linhas <em>memo</em> do rodapé, fora de Investimento Total, EBITDA e Resultado Líquido. A <strong>Depreciação ({cfBRL(CF_ASSUM.mensal.depreciacao)}/mês) fica de fora</strong> — é lançamento contábil, não desembolso.
              <br /><strong>Repasse, Impostos e Custos Variáveis também saem no mês seguinte:</strong> incidem sobre a receita de um mês mas só são recolhidos/pagos no mês posterior, então aqui os percentuais são aplicados sobre o <strong>GGR do mês anterior</strong> (por isso o tag <em>% GGR M-1</em> e o "(mês anterior)" no rótulo — <strong>não tente bater esses valores contra o GGR desta tela</strong>, a base é outra). Diferente da Meta, entram <strong>pró-rata</strong>: não é uma fatura só, são recolhimentos e taxas espalhados pelo mês. É o que a linha 37 (<em>FCL Operacional Estimado</em>) do BP faz.
            </React.Fragment>
          ) : (
            <React.Fragment>
              <br /><strong>PnL / competência (em uso):</strong> o gasto conta no mês em que foi <strong>feito</strong>, então a <strong>Meta do próprio mês entra direto no Tráfego</strong> — não há fatura defasada nem linha memo, e o Investimento Total é o mesmo do <strong>Farol</strong> e das demais abas. A <strong>Depreciação ({cfBRL(CF_ASSUM.mensal.depreciacao)}/mês) entra</strong>, como na aba PnL do arquivo. É a visão para comparar com o BP; para saber o que efetivamente sai do banco, troque para <strong>Caixa</strong>.
            </React.Fragment>
          )}
          <br /><strong>Premissas (% do GGR{isCaixa ? ' do mês anterior' : ''}):</strong> Repasse Social {fmtPct(CF_ASSUM.pctRepasse, 0)} · Impostos {fmtPct(CF_ASSUM.pctImpostos, 1)} · Custos Variáveis {fmtPct(CF_ASSUM.pctCustoVar, 1)} (coluna B15 do arquivo). <strong>Créditos de PIS/COFINS e IRPJ/CSL estão em zero</strong> nesta versão.
          <br /><strong>Pró-rata:</strong> Custos Fixos ({cfBRL(CF_ASSUM.mensal.custosFixos)}/mês), Despesas ({cfBRL(CF_ASSUM.mensal.despesas)}), Resultado Financeiro ({cfBRL(CF_ASSUM.mensal.resultadoFin)}){!isCaixa && <>, Depreciação ({cfBRL(CF_ASSUM.mensal.depreciacao)})</>}, Influencer ({cfBRL(CF_ASSUM.mensal.influencer)}) e Creator ({cfBRL(CF_ASSUM.mensal.creator)}) entram como <strong>mensal ÷ dias do mês</strong> em cada dia; o MTD é a soma disso — é a regra "Pro-Rata" escrita na própria aba PnL do arquivo. Influencer e Creator não existem no BQ (são contrato), por isso ficam fixos dentro do Investimento Total.
          <br /><strong>Estimado fechamento:</strong> onde o mês deve fechar no regime em uso. Cada linha projeta do jeito dela: o que <em>corre por dia</em> (GGR, FreeSpins, bonificação, spend) e o que é pró-rata (custos fixos, despesas, e no caixa os % sobre o GGR do mês anterior) recebem <strong>realizado + média dos dias completos × dias que faltam</strong>; as <strong>faturas do caixa não escalam</strong> (Tráfego e Meta já entram inteiras no dia do pagamento — escalá-las por dia daria um Tráfego ~4× maior); e os <strong>subtotais são recalculados</strong> das partes projetadas, nunca escalados, senão não fechariam entre si. Vale só para janela de um mês inteiro a partir do dia 1º.
          <br /><strong>Escopo:</strong> casa inteira — esta aba <strong>ignora o filtro de canal</strong> do topo (o PnL é da empresa; ratear custo fixo, despesa e depreciação por canal não tem regra definida). Sinal segue o arquivo: custo é negativo.
            </div>
          </details>
        </div>
      </div>
    </React.Fragment>
  );
}

// ============================================================
// MÉTRICAS DO DIA A DIA — a escada do estudo "Ponte BP × Métricas de Retenção" ao vivo.
//   Realizado = agregado do período (soma as bases, depois divide — não é média de %).
//   (As colunas T+1 (P75) / T+2 (P90) — percentis da distribuição das safras diárias, "degraus
//     internos" — foram REMOVIDAS da tabela em 06/08/2026 a pedido do Luis. O helper mddPct_ ficou,
//     é o único ponto a religar se voltarem.)
//   Planejado = nível exigido pela curva calibrada na Lottu (constante do estudo, não sai do nosso dado).
//     Só existe p/ Geral/Google/Meta — outros recortes mostram "—". A curva do estudo (metaCurva.cum)
//     é diária e vai até o dia 90, então dá pra estender a escada sem derivar nada.
//
// ⚠️ MATURAÇÃO: cada métrica só usa safras que já fecharam a janela dela (D30 precisa de 30 dias).
// Sem isso as safras novas entram com numerador incompleto e afundam D7/D14/D30/S1. A coluna "safras"
// mostra quantos dias sobraram por linha — se vier baixa, a base é frágil. Quando NENHUMA safra da
// janela maturou, a linha cai no fallback de coorte (MDD_COORTE_DIAS) em vez de ficar vazia.
// ============================================================
// Curva-meta do estudo (Lottu-calibrada), por escopo. null = sem meta declarada.
// ⚠️ pStd/pTtd/pQtd ficaram órfãs quando as taxas de passagem saíram da tabela (06/08) — mantidas
// aqui de propósito, é o que permite religar as 3 linhas sem recalcular nada.
// FONTE: `Metas de Retenção Rev Ops.html` → `DATA.metaCurva.<escopo>`. A curva `cum` é indexada por DIA
// e vai até o dia 90 (cum[0] = 1 → é multiplicador sobre o D0, a mesma régua da tabela); `jogDia[1]` e
// `rsSem[1]` saem dos outros dois nós. Reconferido contra o arquivo em 06/08/2026: m1/m3/m7, jogD1,
// rsD1 e rsS1 batem EXATO nos 3 escopos.
// ⚠️ Duas mudanças nessa reconferência: (a) entrou **m30** = cum[30] — o estudo NÃO para no D14, era
// engano meu; (b) o **m14 de Google e Meta subiu 3,5%** (3,1264→3,2351 e 2,5162→2,6049), o arquivo
// atual traz outro número. Geral não se moveu em nada.
const MDD_BP = {
  Geral:  { jogD1: 0.1111, rsD1: 0.2976, m1: 1.2976, m3: 1.6804, m7: 2.2307, m14: 2.9155, m30: 4.0646, rsS1: 0.6256, jogS1: 0.2806,
            pStd: 0.2642, pTtd: 0.4700, pQtd: 0.6289 },
  Google: { jogD1: 0.1566, rsD1: 0.3672, m1: 1.3672, m3: 1.8204, m7: 2.4569, m14: 3.2351, m30: 4.5219, rsS1: 0.6119, jogS1: 0.3863,
            pStd: 0.3664, pTtd: 0.5656, pQtd: 0.7588 },
  Meta:   { jogD1: 0.0943, rsD1: 0.2603, m1: 1.2603, m3: 1.5571, m7: 2.0197, m14: 2.6049, m30: 3.6286, rsS1: 0.5432, jogS1: 0.2385,
            pStd: 0.2343, pTtd: 0.4121, pQtd: 0.5460 },
};
// ------------------------------------------------------------
// A MESMA escada, com o multiplicador SOBRE O FTD — `DATA.comp.canais.<escopo>.cumFTD` (base declarada
// no próprio arquivo: `comp.base = "M0/FTD"`), também indexada por dia, 0..90. cumFTD[0] é o alvo de
// D0/FTD, então a escada aqui já começa acima de 1.
// ⚠️ NÃO é a curva sobre D0 reescalada: a razão cumFTD[i]/cum[i] cai de 1,46 (D1) para 1,20 (D30) no
// Geral — são duas calibragens distintas do estudo. Por isso duas tabelas, e não um fator.
// Só os multiplicadores mudam de base; retenção/passagem/semanal são razões que não têm D0 no
// denominador, então herdam MDD_BP.
const MDD_BP_FTD_MULT = {
  Geral:  { m1: 1.8901, m3: 2.3302, m7: 2.9323, m14: 3.6590, m30: 4.8742 },
  Google: { m1: 2.6401, m3: 3.4072, m7: 4.3960, m14: 5.4943, m30: 7.2639 },
  Meta:   { m1: 1.8956, m3: 2.2817, m7: 2.8407, m14: 3.5360, m30: 4.7543 },
};
const MDD_BP_FTD = {};
Object.keys(MDD_BP).forEach(k => { MDD_BP_FTD[k] = Object.assign({}, MDD_BP[k], MDD_BP_FTD_MULT[k]); });
// As 3 TAXAS DE PASSAGEM (FTD→STD, STD→TTD, TTD→QTD) saíram da tabela em 06/08/2026 a pedido do Luis
// ("não vamos mais olhar"), junto com a derivação † que dava meta pra elas. As constantes pStd/pTtd/
// pQtd continuam no MDD_BP acima e o backend segue mandando cntStd/cntTtd/cntQtd4 — pra religar,
// basta devolver as 3 linhas em MDD_ROWS. O racional da derivação está no histórico do git (commit
// "Metricas do dia a dia: meta BP derivada para as 3 taxas de passagem").
const MDD_DERIV = { jogS1: 1 };   // chaves de bp que levam o marcador † de "meta ajustada de régua"
// Fator estimado→exato da retenção SEMANAL de jogadores (ver comentário na linha jogS1 de MDD_ROWS).
// Medido no BQ sobre as safras de julho/26: exato 0,12233 ÷ estimado do estudo 0,21131.
const MDD_JOGSEM_K = 0.12233 / 0.21131;
[MDD_BP, MDD_BP_FTD].forEach(T => Object.keys(T).forEach(k => { T[k] = Object.assign({}, T[k], { jogS1: T[k].jogS1 * MDD_JOGSEM_K }); }));
// mat = dias que a safra precisa ter completado p/ a métrica ser legível.
const MDD_ROWS = [
  { key: 'jogD1', label: 'Retenção de jogadores D1/D0',        mat: 1,  fmt: 'pct',      of: a => a.qtd  ? a.cd1 / a.qtd : null,         bp: 'jogD1' },
  { key: 'rsD1',  label: 'Retenção de depósito R$ D1/D0',      mat: 1,  fmt: 'pct',      of: a => a.d0   ? a.vd1 / a.d0 : null,          bp: 'rsD1' },
  // ⚠️ Os multiplicadores exigem d0 > 0 E o incremento da janela > 0. Uma safra real SEMPRE tem algum
  // depósito depois do D0 — um multiplicador exatamente 1,00x não é "não cresceu", é BASE AUSENTE
  // (payload sem o campo). Sem esta guarda a tela mostrava "1,00x · +0,00x" com cara de dado bom.
  // `mult: true` = a linha muda de BASE com o toggle (sobre D0 ↔ sobre FTD). O NUMERADOR é sempre
  // D0 + depósitos da janela; só o denominador troca. `den` chega do componente já resolvido.
  { key: 'm1',    label: 'Multiplicador D1',                   mat: 1,  fmt: 'multiple', mult: true, of: (a, den) => (a.d0 && den && a.vd1) ? (a.d0 + a.vd1) / den : null, bp: 'm1' },
  { key: 'm3',    label: 'Multiplicador D3',                   mat: 3,  fmt: 'multiple', mult: true, of: (a, den) => (a.d0 && den && a.vd3) ? (a.d0 + a.vd3) / den : null, bp: 'm3' },
  { key: 'm7',    label: 'Multiplicador D7',                   mat: 7,  fmt: 'multiple', mult: true, of: (a, den) => (a.d0 && den && a.vw1) ? (a.d0 + a.vw1) / den : null, bp: 'm7' },
  { key: 'm14',   label: 'Multiplicador D14',                  mat: 14, fmt: 'multiple', mult: true, of: (a, den) => (a.d0 && den && a.vw2) ? (a.d0 + a.vw2) / den : null, bp: 'm14' },
  // D30 = depósitos dos dias 1..30 da safra (val_d30 do backend), mesma régua dos demais: sobre o D0.
  { key: 'm30',   label: 'Multiplicador D30',                  mat: 30, fmt: 'multiple', mult: true, of: (a, den) => (a.d0 && den && a.vd30) ? (a.d0 + a.vd30) / den : null, bp: 'm30' },
  { key: 'rsS1',  label: 'Retenção de depósito R$ S1/S0 (semanal)', mat: 13, fmt: 'pct', of: a => a.vs0  ? a.vs1 / a.vs0 : null,         bp: 'rsS1', needs: "sem" },
  // Meta RECALIBRADA (marcada com †, decisão do Luis 06/08). A curva semanal de JOGADORES do estudo é
  // ESTIMADA — jogadores únicos na semana inferidos das taxas diárias assumindo independência entre
  // dias —, e isso INFLA: quem depositou terça e quinta é contado duas vezes. Medido: para as safras de
  // julho/26 o estudo estima 21,13% e a contagem EXATA (mesma definição do backend: ≥1 depósito na
  // semana ISO seguinte) dá 12,23% no BQ → fator 0,5789. A meta do cockpit é a do estudo × esse fator,
  // senão a tela cobraria 28,1% de uma métrica medida noutra régua e mostraria 44% de atingimento onde
  // dois terços do buraco é definição. O fator é medido no Geral e aplicado aos 3 escopos (o viés é de
  // definição, não de canal). A linha de R$ não precisa disso: soma de reais não duplica (26,5% medido
  // vs 26,9% do estudo).
  { key: 'jogS1', label: 'Retenção de jogadores S1/S0 (semanal)',   mat: 13, fmt: 'pct', of: a => a.qtd  ? a.cs1 / a.qtd : null,         bp: 'jogS1', needs: "sem" },
];
// Resolve o escopo do slicer de canal p/ uma chave de MDD_BP. ⚠️ NÃO dá pra usar chLabel_ direto: ele
// devolve 'Total Casa'/'Canais Growth' e a curva do estudo se chama 'Geral' — o mismatch fazia a coluna
// Meta BP sair "—" justamente no escopo padrão (bug pego na tela em 2026-08-05).
// Sem canal selecionado (Total Casa ou Growth) = a curva Geral do estudo. Um canal só: Google/Meta têm
// curva própria; qualquer outro (TikTok, Kwai, Programática…) não tem meta declarada → null.
// Faixa/grupo NÃO entram: o estudo não calibrou curva por faixa nem por grupo de risco.
function mddBpScope_(chFilter, base) {
  const T = (base === 'ftd') ? MDD_BP_FTD : MDD_BP;
  const sel = chList_(chFilter);
  if (sel.length === 0) return T.Geral;
  if (sel.length === 1) return T[sel[0]] || null;
  return null;
}
// Percentil linear-interpolado sobre os valores diários ordenados (mesma régua do estudo: safras
// diárias sem ponderar por volume — é distribuição de dias, não de reais).
function mddPct_(vals, p) {
  const v = vals.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo);
}
// Uma linha por DIA de safra (soma canais/faixas/grupos dentro do recorte). Fora do componente porque
// roda em DUAS bases: as safras da janela escolhida e a cauda anterior (fallback de coorte).
function mddByDay_(rows, selCh, selFx, selGr) {
  const m = {};
  rows.forEach(r => {
    if (!selCh(r.canal) || !selFx(r.faixa) || !selGr(r.grupo)) return;
    const k = String(r.date);
    // ⚠️ Toda métrica nova precisa da sua base AQUI. O Multiplicador D30 entrou em MDD_ROWS lendo
    // `a.vd30` sem que vd30 fosse somado nesta função — resultado: undefined, `of()` devolvia null e a
    // linha ficava "—" como se fosse falta de maturação. O dado sempre esteve no payload.
    if (!m[k]) m[k] = { date: k, qtd: 0, ftd: 0, d0: 0, cd1: 0, vd1: 0, vd3: 0, vw1: 0, vw2: 0, vd30: 0, vs0: 0, vs1: 0, cs1: 0, cstd: 0, cttd: 0, cqtd4: 0, _pass: 0 };
    const a = m[k];
    a.qtd += r.qtd || 0; a.ftd += r.ftd || 0; a.d0 += r.d0 || 0; a.cd1 += r.cd1 || 0; a.vd1 += r.vd1 || 0;
    a.vd3 += r.vd3 || 0; a.vw1 += r.vw1 || 0; a.vw2 += r.vw2 || 0; a.vd30 += r.vd30 || 0;
    a.vs0 += r.vs0 || 0; a.vs1 += r.vs1 || 0; a.cs1 += r.cs1 || 0;
    a.cstd += r.cstd || 0; a.cttd += r.cttd || 0; a.cqtd4 += r.cqtd4 || 0; a._pass += r._pass || 0;
  });
  return Object.values(m).sort((a, b) => a.date < b.date ? -1 : 1);
}
// Fallback de coorte: dias corridos terminando na última safra madura, NUNCA amarrado ao tamanho da
// janela do slicer (assim o número não muda de base toda vez que alguém mexe no período). O span é a
// MÉDIA MÓVEL DA PRÓPRIA JANELA DA MÉTRICA — D7 lê 7 dias de safra, D14 lê 14, D30 lê 30 —, com este
// piso para as linhas de maturação curta não lerem 1 único dia.
const MDD_COORTE_MIN = 7;
// Quantos dias antes da janela buscar. Pior caso = a métrica mais longa: 30 dias de maturação + 30 de
// span. Sem folga suficiente o D30 acharia meia dúzia de safras em vez da média móvel inteira.
const MDD_LOOKBACK = 30 + 30;

function TabMetricasDia({ retencaoFaixa, chFilter, meta, retFaixaLive }) {
  const [faixaSel, setFaixaSel] = React.useState([]);   // multi-select de faixa de FTD; [] = todas
  const [grupoSel, setGrupoSel] = React.useState([]);   // multi-select de grupo de risco; [] = todos
  // Base do multiplicador: 'd0' (default, régua do estudo, D0 = 1,00x) ou 'ftd' (sobre o 1º depósito,
  // igual ao toggle da aba Multiplicadores). Troca o denominador do realizado E a tabela de Planejado.
  const [multBase, setMultBase] = usePersistedState('rvops:mddMultBase', 'd0');
  const dataMax = meta && meta.dataMaxDate;
  const grupoActive = grupoSel.length > 0;
  // A base `retencaoFaixa` do payload NÃO traz grupo de risco — precisa do fetch com &byGrupo=1 (mesma
  // mecânica da aba Multiplicadores e Retenção). Só busca quando o filtro de grupo está ligado.
  const winFrom = meta && meta.from, winTo = meta && meta.to;
  const [grFetch, setGrFetch] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!grupoActive || !ENDPOINT_URL || !winFrom || !winTo) return;
    setGrFetch(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${winFrom}&to=${winTo}&only=retfaixa&byGrupo=1`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (j.error) throw new Error(j.error); setGrFetch({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => setGrFetch({ rows: null, loading: false, error: String(e.message || e) }));
  }, [grupoActive, winFrom, winTo]);
  // Opções do multiselect de grupo: os grupos REAIS quando já carregou, senão o default.
  const grupoOptions = (grFetch.rows && grFetch.rows.length)
    ? Array.from(new Set(grFetch.rows.map(r => r.grupo != null ? String(r.grupo) : 'sem grupo'))).sort()
    : GRUPO_LIST;
  const srcRows = grupoActive ? (grFetch.rows || []) : (retencaoFaixa || []);
  const rows = benchApostouRows_(srcRows);
  const selCh = chSelector_(chFilter);
  const selFx = (fx) => faixaSel.length === 0 || faixaSel.includes(fx);
  const selGr = (g) => !grupoActive || grupoSel.indexOf(g || 'sem grupo') >= 0;
  const byDay = React.useMemo(() => mddByDay_(rows, selCh, selFx, selGr),
    [srcRows, chFilter && chFilter.scope, JSON.stringify(chFilter && chFilter.canals),
     JSON.stringify(faixaSel), JSON.stringify(grupoSel)]);
  // Cauda ANTERIOR à janela — só serve de fallback de coorte quando nenhuma safra da janela fechou a
  // maturação da linha (pedido do Luis 06/08: "pega a última safra que maturou nesse dado"). Nunca
  // entra no agregado da janela; é uma base separada, e a tabela marca a linha que caiu nela.
  const tailFrom = winFrom ? isoAddDays_(winFrom, -MDD_LOOKBACK) : null;
  const tailTo   = winFrom ? isoAddDays_(winFrom, -1) : null;
  const [tail, setTail] = React.useState({ rows: null, loading: false, error: null });
  React.useEffect(() => {
    if (!ENDPOINT_URL || !tailFrom || !tailTo) return;
    let live = true;
    setTail(s => ({ ...s, loading: true, error: null }));
    fetch(`${ENDPOINT_URL}?${authParam_()}&from=${tailFrom}&to=${tailTo}&only=retfaixa${grupoActive ? '&byGrupo=1' : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (!live) return; if (j.error) throw new Error(j.error); setTail({ rows: j.retencaoFaixa || [], loading: false, error: null }); })
      .catch(e => { if (live) setTail({ rows: null, loading: false, error: String(e.message || e) }); });
    return () => { live = false; };
  }, [tailFrom, tailTo, grupoActive]);
  const byDayTail = React.useMemo(() => mddByDay_(benchApostouRows_(tail.rows || []), selCh, selFx, selGr),
    [tail.rows, chFilter && chFilter.scope, JSON.stringify(chFilter && chFilter.canals),
     JSON.stringify(faixaSel), JSON.stringify(grupoSel)]);
  const bpScope = mddBpScope_(chFilter, multBase);
  const out = MDD_ROWS.map(row => {
    // Só safras que já fecharam a janela da métrica (maturação).
    const cut = dataMax ? isoAddDays_(dataMax, -row.mat) : null;
    const naJanela = byDay.filter(d => !cut || d.date <= cut);
    // FALLBACK DE COORTE: se NENHUMA safra da janela maturou, cai nas safras maduras mais recentes do
    // dado (a cauda anterior à janela). O SPAN é MÉDIA MÓVEL DA PRÓPRIA JANELA DA MÉTRICA (regra do
    // Luis 06/08): D7 lê 7 dias de safra, D14 lê 14, D30 lê 30. Com span fixo de 7 o D30 caía em cima
    // de uma única semana e herdava a volatilidade dela — no teste, o D7 vinha de 24–30/07 (a semana
    // mais forte, 1,94x) e o D30 de 01–07/07 (que inclui a mais fraca, 1,41x no D7), e a escada dava a
    // impressão de que a cauda tinha desabado quando era só ruído de semana. Com span = janela, cada
    // linha é uma média móvel do próprio horizonte e a comparação entre elas volta a significar algo.
    // Piso de 7 dias: linhas de maturação curta (D1/D3) quase nunca caem aqui, mas se caírem 1 dia de
    // safra seria ruído puro.
    const span = Math.max(row.mat, MDD_COORTE_MIN);
    let days = naJanela, coorte = null;
    if (!naJanela.length && byDayTail.length) {
      const maduras = byDayTail.filter(d => !cut || d.date <= cut);
      if (maduras.length) {
        days = maduras.slice(-span);
        coorte = { de: days[0].date, ate: days[days.length - 1].date };
      }
    }
    const tot = days.reduce((acc, d) => { for (const k in d) if (k !== 'date') acc[k] = (acc[k] || 0) + d[k]; return acc; }, {});
    // Passagem depende do backend v58+; S1/S0 do v60+. Sem base → linha inteira "—" (não 0).
    const missing = (row.needs === 'pass' && !(tot._pass > 0)) || (row.needs === 'sem' && !(tot.vs0 > 0) && !(tot.cs1 > 0));
    // Denominador dos multiplicadores: D0 (default) ou FTD$, conforme o toggle. As demais linhas
    // ignoram — são razões que não têm D0 no denominador.
    const den = (multBase === 'ftd') ? tot.ftd : tot.d0;
    const real = missing ? null : row.of(tot, den);
    const dist = missing ? [] : days.filter(d => d.qtd > 0).map(row.of);
    // As colunas T+1 (P75) e T+2 (P90) — percentis da distribuição das safras diárias — saíram da
    // tabela a pedido do Luis (06/08). A distribuição (`dist`) continua sendo montada porque é ela
    // que separa safra com base > 0; se um dia os degraus voltarem, é só reinserir mddPct_ aqui.
    // Por que a linha está vazia: sem safra madura (`imatura`) é MUITO diferente de "não tem dado".
    // A tela mostrava só "—" nos dois casos e a pergunta voltava ("pq tem uns q ainda faltam a
    // info?"). `faltamDias` = quantos dias a safra mais nova ainda precisa envelhecer p/ a primeira
    // entrar na conta; se nem isso dá pra saber (janela toda velha demais), fica só o motivo.
    // Só sobra "—" quando nem a cauda tem safra madura (janela muito antiga, ou dado ainda não chegou).
    const imatura = !missing && days.length === 0 && byDay.length > 0;
    // isoDiffDays_(a, b) = b − a. Idade da safra MAIS VELHA da janela = dataMax − primeiro dia.
    const faltamDias = (imatura && dataMax) ? Math.max(1, row.mat - isoDiffDays_(byDay[0].date, dataMax)) : null;
    return {
      ...row, n: days.length, real, imatura, faltamDias, coorte,
      bpVal: (row.bp && bpScope) ? bpScope[row.bp] : null,
    };
  });
  const val = (v, fmt) => v == null ? '—' : (fmt === 'pct' ? fmtPct(v, 1) : fmtMultiple(v));
  const chLbl = chLabel_(chFilter);
  const faixaLbl = faixaSel.length === 0 ? 'todas as faixas' : (faixaSel.length <= 2 ? faixaSel.map(fxLabel_).join(' + ') : faixaSel.length + ' faixas');
  const grupoLbl = !grupoActive ? 'todos os grupos' : (grupoSel.length <= 2 ? grupoSel.map(grupoLabel_).join(' + ') : grupoSel.length + ' grupos');
  return (
    <React.Fragment>
      <div className="tab-header">
        <div>
          <h1>Métricas do dia a dia</h1>
          <div className="subtitle">A escada que sustenta a curva de depósito do BP — realizado do período e o nível que a curva-meta exige</div>
        </div>
      </div>
      {!retFaixaLive && (
        <div style={{
          background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.45)', borderLeft: '4px solid #ef4444',
          borderRadius: '8px', padding: '12px 16px', margin: '0 0 14px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text)',
        }}>
          <strong style={{ color: '#f87171' }}>⚠ Dados de demonstração — não são os seus números.</strong>{' '}
          A base de safras (<code>retencaoFaixa</code>) não chegou do BigQuery nesta carga, então a tabela abaixo está
          preenchida com o <strong>mock</strong> embutido no app (11 safras fictícias de jun/26, sem os campos de
          coorte semanal — por isso D3, D14, D30 e S1/S0 aparecem “—”).
          {' '}<strong>Recarregue a página</strong>; se persistir, o backend está lento (cold start do Apps Script) ou a
          query de safras falhou.
        </div>
      )}
      <div className="slicer-group slicer-ruler">
        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Faixa FTD</label>
        <ChannelMultiSelect options={FAIXA_LIST} selected={faixaSel} onChange={setFaixaSel} labelOf={fxLabel_} allLabel="Todas" countNoun="faixas" />
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>Grupo de risco</label>
        <ChannelMultiSelect options={grupoOptions} selected={grupoSel} onChange={setGrupoSel} labelOf={grupoLabel_} allLabel="Todos" countNoun="grupos" />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '10px' }}>Multiplicador</span>
        <div className="slicer-presets" style={{ marginLeft: 6 }}>
          <button className={`preset-btn ${multBase === 'ftd' ? 'active' : ''}`} onClick={() => setMultBase('ftd')}
                  title="Multiplicador sobre o FTD$ (valor do 1º depósito). O D0 já entra acima de 1.">sobre FTD</button>
          <button className={`preset-btn ${multBase === 'd0' ? 'active' : ''}`} onClick={() => setMultBase('d0')}
                  title="Multiplicador sobre o depósito do D0 (D0 = 1,00x) — a régua do estudo.">sobre D0</button>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '10px' }}>
          Canal: <strong style={{ color: 'var(--text)' }}>{chLbl}</strong> — use o slicer <em>Canal</em> do topo
        </span>
      </div>
      <div className="support">
        <div className="support-title">Escada de retenção precoce · {chLbl} · {faixaLbl} · {grupoLbl} · mult {multBase === 'ftd' ? 'sobre FTD' : 'sobre D0'} · safras do período{dataMax ? ' (até ' + dataMax.slice(8, 10) + '/' + dataMax.slice(5, 7) + ')' : ''}{grFetch.loading ? ' · carregando grupos…' : ''}{grFetch.error ? ' · erro ao carregar grupos' : ''}
          {/* Sem isto, uma falha no fetch da cauda derruba o fallback de coorte em silêncio e as linhas
              de maturação longa (D14, D30, S1/S0) voltam a aparecer vazias "sem motivo". */}
          {tail.loading ? ' · carregando safras maduras…' : ''}
          {tail.error ? <span style={{ color: 'var(--accent-red)' }}> · falhou buscar as safras maduras ({tail.error}) — linhas de D14/D30/S1 podem ficar vazias</span> : ''}</div>
        <div className="table-scroll"><table className="ch-table">
          <thead>
            <tr>
              <th>Métrica do dia a dia</th>
              <th title="Agregado do período: soma as bases e divide (não é média das % diárias). Só safras já maduras p/ a janela da métrica.">Realizado</th>
              <th title="Nível exigido pela curva calibrada na Lottu (constante do estudo, não deriva do nosso dado). Só Geral/Google/Meta.">Planejado</th>
            </tr>
          </thead>
          <tbody>
            {out.map(r => (
              <tr key={r.key}>
                <td className="ch-name">{r.label}</td>
                {/* A marca amarela "coorte dd/mm–dd/mm" saiu a pedido do Luis (06/08). A informação
                    continua no title da célula: sem ela ninguém sabe que a linha lê um período
                    diferente das demais. */}
                <td style={{ fontWeight: 600 }}
                    title={r.coorte
                      ? `Leitura de COORTE: nenhuma safra da janela selecionada fechou os ${r.mat} dia(s) de maturação desta métrica. Este número é a MÉDIA MÓVEL de ${r.n} dias de safra (o próprio horizonte da métrica), de ${fmtBR_(r.coorte.de)} a ${fmtBR_(r.coorte.ate)} — fora da janela do topo.`
                      : (r.n > 0 ? `${r.n} safra(s) da janela entraram na conta (as que já fecharam os ${r.mat} dia(s) de maturação desta métrica).` : undefined)}>
                  {val(r.real, r.fmt)}
                  {r.imatura && (
                    <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)', marginLeft: 6 }}
                          title={`Esta métrica precisa de ${r.mat} dia(s) de maturação: uma safra só entra na conta depois de fechar a janela dela. Nenhuma safra da janela selecionada chegou lá (dado vai até ${dataMax ? fmtBR_(dataMax) : '—'}). Contar as safras novas afundaria a métrica com numerador incompleto. Amplie a janela para trás para ver esta linha.`}>
                      matura em {r.faltamDias != null ? r.faltamDias + 'd' : r.mat + 'd'}
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: 700, color: r.bpVal != null ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
                  {r.bp == null ? <span style={{ fontWeight: 400, fontStyle: 'italic' }}>indicativo</span> : (
                    <React.Fragment>
                      {val(r.bpVal, r.fmt)}
                      {r.bpVal != null && MDD_DERIV[r.bp] && (
                        <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: 3 }}
                              title="Meta AJUSTADA DE RÉGUA: a curva semanal de jogadores do estudo é ESTIMADA (jogadores únicos inferidos das taxas diárias assumindo independência entre dias), e isso infla — quem depositou terça e quinta conta duas vezes. Nas safras de julho/26 o estudo estima 21,13% onde a contagem exata dá 12,23%. A meta aqui é a do estudo × 0,579 para ficar na mesma régua do realizado; sem isso a tela cobraria 28,1% de um número medido de outro jeito.">†</span>
                      )}
                    </React.Fragment>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="ch-note">
          <strong>Realizado</strong> = agregado do período (soma as bases, depois divide — não é média das % diárias).
          {' '}<strong>Meta BP</strong> é o nível exigido pela
          curva calibrada na Lottu; é constante do estudo, <strong>não deriva do nosso dado</strong>, e só existe p/ Geral,
          Google e Meta — em qualquer outro canal, ou com 2+ canais selecionados, fica “—”.
          {' '}<strong>⚠️ A Meta BP não muda com Faixa nem com Grupo</strong>: o estudo calibrou a curva no nível do canal,
          não por faixa de FTD nem por grupo de risco. Ao filtrar, o Realizado segue o recorte, mas a meta continua
          sendo a do canal inteiro — use como referência de direção, não como alvo daquele segmento.
          {' '}<strong>Base do multiplicador:</strong> o toggle <em>sobre D0 / sobre FTD</em> troca o denominador do
          realizado <strong>e a curva do Planejado junto</strong> — o estudo traz as duas escadas calibradas
          separadamente (sobre D0 a razão começa em 1,00x; sobre FTD o próprio D0 já entra acima de 1). Não é uma
          reescala: no Geral, a razão entre as duas curvas cai de 1,46 no D1 para 1,20 no D30. Só as linhas de
          multiplicador mudam; retenção e semanal não têm D0 no denominador.
          {' '}<strong>Retenção de jogadores S1/S0 traz meta ajustada de régua (†)</strong>: a curva semanal de
          jogadores do estudo é estimada e infla ~1,7× vs a contagem exata — a meta entra corrigida pelo fator medido
          (0,579), senão o atingimento seria definição, não performance.
          {' '}<strong>Maturação:</strong> cada linha só usa safras que já fecharam a janela dela — D30 exige 30 dias,
          D14 exige 14, S1/S0 exige 13. Ou seja, <strong>cada linha lê um nº diferente de safras</strong>: passe o mouse
          no valor pra ver quantas entraram e de que período.
          {' '}<strong>Fallback de coorte (média móvel do próprio horizonte):</strong> se NENHUMA safra da janela
          escolhida fechou a maturação da linha, ela não fica vazia — passa a ler safras maduras de fora da janela,
          num span igual à janela da métrica: <strong>D7 lê 7 dias de safra, D14 lê 14, D30 lê 30</strong> (busca até
          {' '}{MDD_LOOKBACK} dias antes do início da janela). O span acompanhar o horizonte é o que faz a escada
          significar algo: com span fixo de 7 dias o D30 caía em cima de uma semana só e herdava a volatilidade dela —
          num teste o D7 vinha da semana mais forte do período (1,94x) e o D30 da mais fraca (1,41x no D7), dando a
          impressão de que a cauda tinha desabado quando era ruído de semana. <strong>É leitura de coorte, não da
          janela</strong>: passe o mouse no valor pra ver o período exato; o recorte de canal/faixa/grupo é o mesmo dos
          dois lados.
          {' '}Multiplicadores aqui são <strong>sobre o depósito do D0</strong> (D0 = 1,00x), não sobre o FTD$ — é a base do estudo.
          {' '}<strong>S0/S1 são semanas de calendário</strong> (seg–dom): S0 = depósito na semana do FTD, S1 = na semana
          seguinte — mesma lógica do M0/M+1, um nível acima. Não é janela de 7 dias corridos.
          {' '}A linha de <strong>jogadores S1/S0 fica sem Meta BP de propósito</strong>: a curva semanal de jogadores do
          estudo é <em>estimada</em> (infere jogadores únicos das taxas diárias assumindo independência entre dias), o que
          infla o nível — a mesma coorte medida de forma exata dá bem menos. Comparar a contagem exata daqui com aquela
          meta mostraria um gap de definição, não de performance. A linha de R$ não tem esse problema.
          {out.some(r => r.real == null) ? ' · alguma linha sem base: payload anterior ao v60, recarregue com Atualizar.' : ''}
        </div>
      </div>
    </React.Fragment>
  );
}

const TABS = [
  { id: 'farol', label: 'Farol', component: TabFarol },
  { id: 'monthlyclose', label: 'Monthly Close', component: TabMonthlyClose },
  { id: 'caccalc', label: 'CAC Calculator', component: TabCacCalculator },
  { id: 'retfaixa', label: 'Multiplicadores e Retenção', component: TabRetencaoFaixa },
  { id: 'metricasdia', label: 'Métricas do dia a dia', component: TabMetricasDia },
  { id: 'ativacao', label: 'Ativação D0', component: TabAtivacao },
  { id: 'cashflow', label: 'Daily Cashflow', component: TabDailyCashflow },
  { id: 'ggr', label: 'GGR', component: TabGgr },
  { id: 'sameday', label: 'Benchmark Lottu', component: NetBenchTab },
];

// ============================================================
// DATE HELPERS — presets + parsing
// ============================================================
// YYYY-MM-DD a partir dos componentes LOCAIS (sem passar por UTC, que jogaria
// a data 1 dia pra trás em fusos UTC+). Sempre reflete o calendário de quem abre.
function toLocalISO_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayISO_() {
  // "Até" = ontem: último dia com dado completo no BQ (recarrega ~1x/dia).
  const t = new Date();
  return toLocalISO_(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1));
}
function firstOfMonthISO_(d = new Date()) {
  return toLocalISO_(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastMonthRangeISO_() {
  const t = new Date();
  const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const end = new Date(t.getFullYear(), t.getMonth(), 0);
  return { from: toLocalISO_(start), to: toLocalISO_(end) };
}
// Mês-calendário ANTERIOR ao mês da data `iso` (âncora = fim da janela do slicer):
// jun→mai, mai→abr, jan→dez/ano-1. Fallback p/ o último mês fechado de hoje se sem âncora.
function prevMonthRangeOf_(iso) {
  if (!iso) return lastMonthRangeISO_();
  const [y, m] = String(iso).split('-').map(Number);   // m = 1..12 (mês da janela)
  const start = new Date(y, m - 2, 1);                  // 1º dia do mês anterior
  const end = new Date(y, m - 1, 0);                    // dia 0 do mês da janela = último dia do anterior
  return { from: toLocalISO_(start), to: toLocalISO_(end) };
}
function daysAgoISO_(n) {
  const t = new Date();
  return toLocalISO_(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n));
}
function fmtBR_(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
const MESES_PT_ = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function monthLabelPt_(iso) {
  if (!iso) return '—';
  const [y, m] = String(iso).split('-').map(Number);
  return `${MESES_PT_[(m - 1 + 12) % 12]}/${y}`;
}

// ============================================================
// MOCK HERO FILTERING — no live o backend filtra de verdade;
// no mock derivamos os heroes das tabelas mock pro preview reagir igual.
// ============================================================
function sumBy_(list, f) { return (list || []).reduce((a, c) => a + (f(c) || 0), 0); }

function deriveMockM_(M, filter) {
  const selCh = chList_(filter);
  if (!selCh.length && filter.scope !== 'growth') return M;
  const inSel = selCh.length ? (c) => selCh.includes(c.channel) : (c) => isGrowthCh_(c.channel);
  const pick = (list) => list.filter(inSel);

  const ch = pick(MOCK_CHANNELS, c => c.spend != null);
  const gg = pick(MOCK_GGR_CHANNELS, c => c.spend != null);
  const dp = pick(MOCK_DEPM0_CHANNELS, c => c.invest != null);
  const rt = pick(MOCK_RETENTION_CHANNELS, null);
  const rm = pick(MOCK_ROLLOVER_MATRIX.rows, null);

  const ftd = sumBy_(ch, c => c.ftdAmount);
  const spend = sumBy_(ch, c => c.spend);
  const ggr = sumBy_(gg, c => c.ggr);
  const depM0 = sumBy_(dp, c => c.depM0);
  const depM0Growth = sumBy_(dp.filter(c => c.invest != null), c => c.depM0);
  const ggrShare = sumBy_(MOCK_GGR_CHANNELS, c => c.ggr) > 0 ? ggr / sumBy_(MOCK_GGR_CHANNELS, c => c.ggr) : 1;
  const depShare = sumBy_(MOCK_DEPM0_CHANNELS, c => c.depM0) > 0 ? depM0 / sumBy_(MOCK_DEPM0_CHANNELS, c => c.depM0) : 1;

  const W = sumBy_(rt, c => c.m0Total);
  const wavg = (key) => (W > 0 ? sumBy_(rt, c => (c[key] || 0) * (c.m0Total || 0)) / W : null);
  const RW = sumBy_(rm, r => r.weight);
  const rollover = RW > 0 ? sumBy_(rm, r => (r.total || 0) * (r.weight || 0)) / RW : null;

  // set: novo act, escala m1 na mesma proporção (mantém o delta coerente no mock)
  const set = (m, v) => {
    const f = (m.act != null && m.act !== 0 && v != null) ? v / m.act : null;
    return { ...m, act: v, m1: (f != null && m.m1 != null) ? m.m1 * f : m.m1 };
  };
  const scale = (m, f) => set(m, m.act != null ? m.act * f : null);

  return {
    ...M,
    ftdAmount: set(M.ftdAmount, ftd || null),
    roasFtd: set(M.roasFtd, spend > 0 ? ftd / spend : null),
    invest: set(M.invest, spend > 0 ? spend : null),
    ggr: set(M.ggr, ggr || null),
    ggrTrend: scale(M.ggrTrend, ggrShare),
    depTotal: scale(M.depTotal, depShare),
    depM0Total: set(M.depM0Total, depM0 || null),
    depM0Growth: set(M.depM0Growth, depM0Growth || null),
    retM0M1: set(M.retM0M1, wavg('m0m1')),
    retM1M2: set(M.retM1M2, wavg('m1m2')),
    retM3plus: set(M.retM3plus, wavg('m3plus')),
    turnover: scale(M.turnover, ggrShare),
    rollover: set(M.rollover, rollover),
  };
}

// Live: deriva os hero cards do canal/scope a partir dos componentes por canal (exato, mesma fonte do backend).
function deriveLiveM_(M, filter, comp, retCh, depCh, bp, ggrRetCh, turnRetCh) {
  const selList = chList_(filter);
  if ((!selList.length && filter.scope !== 'growth') || !comp) return M; // Total da Casa: backend já setou BP
  const inSel = selList.length ? (ch) => selList.includes(ch) : (ch) => isGrowthCh_(ch);
  const sel = Object.keys(comp).filter(inSel);
  const sum = (bk, key) => sel.reduce((a, ch) => {
    const c = comp[ch] && comp[ch][bk]; return a + ((c && c[key]) || 0);
  }, 0);
  const ngr = sum('mtd','ngr'), dep = sum('mtd','depositos'), turn = sum('mtd','turnover'),
        spend = sum('mtd','spend'), ftdAmt = sum('mtd','ftdAmount');
  const lNgr = sum('lm','ngr'), lDep = sum('lm','depositos'), lTurn = sum('lm','turnover'),
        lSpend = sum('lm','spend'), lFtdAmt = sum('lm','ftdAmount');
  const div = (a, b) => (b > 0 ? a / b : null);
  const trendF = (M.ggr && M.ggr.act && M.ggrTrend && M.ggrTrend.act != null) ? M.ggrTrend.act / M.ggr.act : null;

  // Retenção (nd exato) e DEP M0 vêm das tabelas por canal — mesma fonte dos cards.
  const rsel = (retCh || []).filter(c => inSel(c.channel));
  const nd = (n, d) => { let N = 0, D = 0; rsel.forEach(c => { if (c.nd) { N += c.nd[n] || 0; D += c.nd[d] || 0; } }); return D > 0 ? N / D : null; };
  // Retenção de GGR: mesmo padrão — soma N e D das linhas do canal (nunca média de %).
  const grsel = (ggrRetCh || []).filter(c => inSel(c.channel));
  const gnd = (n, d) => { if (!grsel.length) return undefined; let N = 0, D = 0; grsel.forEach(c => { if (c.nd) { N += c.nd[n] || 0; D += c.nd[d] || 0; } }); return D > 0 ? N / D : null; };
  const trsel = (turnRetCh || []).filter(c => inSel(c.channel));
  const tnd = (n, d) => { if (!trsel.length) return undefined; let N = 0, D = 0; trsel.forEach(c => { if (c.nd) { N += c.nd[n] || 0; D += c.nd[d] || 0; } }); return D > 0 ? N / D : null; };
  const dsel = (depCh || []).filter(c => inSel(c.channel));
  const depM0Total = dsel.reduce((a, c) => a + (c.depM0 || 0), 0);
  const depM0Growth = dsel.filter(c => isGrowthCh_(c.channel)).reduce((a, c) => a + (c.depM0 || 0), 0);

  // Soma que DISTINGUE "canal sem registro" de "backend sem a coluna": devolve undefined se nenhum canal do
  // escopo trouxe `reg`, pra o card cair no gmk e preservar o valor house-level em vez de zerar em silêncio.
  const optSum = (bk, key) => { let s = 0, any = false;
    sel.forEach(ch => { const c = comp[ch] && comp[ch][bk]; if (c && c[key] != null) { s += c[key]; any = true; } });
    return any ? s : undefined; };
  const regAct = optSum('mtd', 'reg'), regM1 = optSum('lm', 'reg');
  const mk = (m, act, m1) => ({ ...m, act: (act == null ? null : act), m1: (m1 === undefined ? null : m1) });
  // idem, mas degrada: sem o card no payload OU sem a base por canal (undefined), devolve o que veio.
  const gmk = (m, act) => (!m || act === undefined) ? m : mk(m, act, null);
  const out = {
    ...M,
    ftdAmount:   mk(M.ftdAmount, ftdAmt || null, lFtdAmt || null),
    // #FTD: passou a ser CARD (antes só alimentava CAC/Ticket via buildFarolMetrics_), então precisa do
    // reescopo aqui — sem isso o card mostraria a contagem da CASA com canal filtrado.
    ftdQty:      mk(M.ftdQty, sum('mtd','ftdQty') || null, sum('lm','ftdQty') || null),
    roasFtd:     mk(M.roasFtd, div(ftdAmt, spend), div(lFtdAmt, lSpend)),
    invest:      mk(M.invest, spend || null, lSpend || null),
    // Registros: backend antigo (sem `reg` por canal) → preserva o card como veio, igual retGgr*/retTurn*.
    registros:   (!M.registros || regAct === undefined) ? M.registros
                 : mk(M.registros, regAct || null, regM1 || null),
    ggr:         mk(M.ggr, ngr || null, lNgr || null),
    ggrPerDep:   mk(M.ggrPerDep, div(ngr, dep), div(lNgr, lDep)),
    depTotal:    mk(M.depTotal, dep || null, lDep || null),
    qtdDep:      mk(M.qtdDep, sum('mtd','qtdDep') || null, sum('lm','qtdDep') || null),
    turnover:    mk(M.turnover, turn || null, lTurn || null),
    hold:        mk(M.hold, div(ngr, turn), div(lNgr, lTurn)),
    rollover:    mk(M.rollover, div(turn, dep), div(lTurn, lDep)),
    ggrTrend:    mk(M.ggrTrend, (trendF != null && ngr) ? ngr * trendF : null, null),
    retM0M1:     mk(M.retM0M1, nd('n1','d1'), null),
    retM1M2:     mk(M.retM1M2, nd('n2','d2'), null),
    retM3plus:   mk(M.retM3plus, nd('n3','d3'), null),
    // Backend antigo (sem retGgr*/ggrRetentionChannels): preserva o card como veio — não inventa card vazio.
    retGgrM0M1:   gmk(M.retGgrM0M1,   gnd('n1','d1')),
    retGgrM1M2:   gmk(M.retGgrM1M2,   gnd('n2','d2')),
    retGgrM3plus: gmk(M.retGgrM3plus, gnd('n3','d3')),
    retTurnM0M1:   gmk(M.retTurnM0M1,   tnd('n1','d1')),
    retTurnM1M2:   gmk(M.retTurnM1M2,   tnd('n2','d2')),
    retTurnM3plus: gmk(M.retTurnM3plus, tnd('n3','d3')),
    depM0Total:  mk(M.depM0Total, depM0Total || null, null),
    depM0Growth: mk(M.depM0Growth, depM0Growth || null, null),
  };
  return applyBpLive_(out, filter, bp);
}

// Farol — métricas DERIVADAS p/ a aba consolidada (não estão no M do backend): CAC, Tkt FTD, ROAS Dep
// D0/M0, FreeSpins/Dep, Bonif/Dep. Calcula no escopo do filtro (igual aos outros cards). M-1 de CAC/Tkt
// vem de componentsByChannel (ftdQty mtd+lm, só live; mock cai p/ channels e fica sem Δ). M-1 de ROAS Dep
// D0 e FreeSpins/Bonif = dep_d0/freespin/bonus do mês anterior POR CANAL (depD0Lm/freespinLm/bonusLm do
// backend) ÷ invest/depTotal do M-1 → some no mock (sem *Lm) e no YTD.
// BP: CAC/Tkt/ROAS Dep D0/M0 saem do plano per-canal (bp.byChannel); FreeSpins/Bonif não têm meta → farol off.
// Meta do ROAS GGR M0 — FIXA e por ESCOPO (definida pelo Luis, 2026-08-07). Não vem do plano: a DB
// Plan_RevOps tem meta de GGR/Dep só no blend da casa (todas as safras), e ancorar um numerador de M0
// numa margem de blend seria aproximação disfarçada de BP. Constante, na mesma linha de FreeSpins/Dep
// e Bonificação/Dep — por isso o card diz "Orçado" em qualquer cenário.
// Total da Casa (0,25) > Growth (0,15) porque o numerador do Total soma o GGR de orgânico/afiliados em
// cima do MESMO denominador (só existe mídia paga) — é ROAS blended, e é esse o ponto do slicer.
// Sanidade: 0,25 bate com ROAS Dep M0 do plano × GGR/Dep do plano (1,70 × 15,0% = 25,5%, ago/26 fc) e
// com os 23,72% que a aba Multiplicadores já usa como meta editável.
const ROAS_GGR_M0_BP = { all: 0.25, growth: 0.15 };
// Qualquer recorte (canal específico ou escopo Growth) usa a meta de growth: 0,25 só faz sentido pra casa
// inteira, onde o GGR não-growth entra no numerador.
const ROAS_GGR_M0_META = (filter) => (chList_(filter).length || (filter && filter.scope === 'growth'))
  ? ROAS_GGR_M0_BP.growth : ROAS_GGR_M0_BP.all;

function buildFarolMetrics_(M, comp, channels, ggrChannels, bp, filter, ggrSafra) {
  const sel = chList_(filter);
  const inSel = sel.length ? (ch) => sel.includes(ch)
    : (filter && filter.scope === 'growth') ? (ch) => isGrowthCh_(ch) : () => true;
  const sumComp = (bk, key) => {
    if (!comp) return null; let s = 0, any = false;
    Object.keys(comp).forEach(ch => { const v = comp[ch] && comp[ch][bk] && comp[ch][bk][key];
      if (inSel(ch) && v != null) { s += v; any = true; } });
    return any ? s : null;
  };
  const chFtdQty = (channels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.ftdQty || 0), 0) || null;
  const fqM = sumComp('mtd', 'ftdQty');
  const ftdQtyM = fqM != null ? fqM : chFtdQty;   // live: componentes (mtd) · mock: channels
  const ftdQtyL = sumComp('lm', 'ftdQty');         // M-1 só no live
  // 2026-08-05: caiu o filtro `c.spend != null` daqui. Ele prendia o Dep D0 aos canais PAGOS mesmo em
  // "Total Casa", então o slicer não mexia no ROAS Dep D0 — 0,47x nos dois escopos — enquanto a sparkline
  // (buildFarolSpark_) respeitava o escopo e mostrava 0,75x. Card e bolinha discordavam por isso, não por
  // divergência de fonte: cohort_ftd_base e performance_daily batem no centavo quando restritas aos mesmos
  // canais. Agora o numerador segue o slicer e o denominador segue sendo só mídia paga (investimento
  // orgânico não existe) — em Growth dá ROAS direto, em Total Casa dá ROAS blended, que é o ponto do slicer.
  const depD0M = (channels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.depD0 || 0), 0) || null;
  // M-1 (mesma janela, mês anterior) de Dep D0 por canal — backend expõe depD0Lm em channels (CACHE v28+).
  const depD0Lm = (channels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.depD0Lm || 0), 0) || null;
  const fs = (ggrChannels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.freespin || 0), 0) || null;
  const bn = (ggrChannels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.bonus || 0), 0) || null;
  // M-1 (mesma janela, mês anterior) de freespin/bonus por canal — backend expõe freespinLm/bonusLm em ggrChannels (CACHE v27+).
  const fsLm = (ggrChannels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.freespinLm || 0), 0) || null;
  const bnLm = (ggrChannels || []).filter(c => inSel(c.channel)).reduce((a, c) => a + (c.bonusLm || 0), 0) || null;
  const byCh = (bp && bp.byChannel) || {};
  const B = {};
  Object.keys(byCh).forEach(ch => { if (inSel(ch)) ['invest','ftdAmount','depD0','depM0','ftd'].forEach(k => { if (byCh[ch][k] != null) B[k] = (B[k] || 0) + byCh[ch][k]; }); });
  const div = (a, b) => (a != null && b) ? a / b : null;
  const mk = (label, fmt, act, bpv, m1, lowerBetter) => ({ label, fmt, act: act == null ? null : act, m1: m1 == null ? null : m1,
    bp: (bpv != null && isFinite(bpv) && bpv !== 0) ? bpv : null,
    pctBp: (bpv && act != null) ? act / bpv : null,
    lowerBetter: !!lowerBetter });
  const inv = M.invest || {}, fa = M.ftdAmount || {}, dt = M.depTotal || {}, dm0 = M.depM0Total || {};
  // BP do ROAS Dep M0 = razão do MÊS INTEIRO do plano (bp.month), NÃO prorateada pela janela: o m0tt
  // diário do plano é front-loaded (runway da coorte), então somar poucos dias contra invest flat INFLA
  // a razão (jul 1-5 = 2,35 vs mês inteiro = 1,9). Total Casa = m0tt/invest; Growth/canal = Dep M0 Growth(colZ)/invest(colN).
  // MARGEM POR SAFRA (idade de coorte) — GGR/Dep e Hold de cada bucket do payload.ggrSafra, somados no
  // escopo do filtro de canal (Σ/Σ, nunca média de %). M-1 = mesma janela do mês anterior, que o backend
  // já manda por bucket (ggrM1/depM1/turnoverM1). Sem BP: o plano tem meta de GGR/Dep e Hold só no nível
  // da CASA (blend), não por idade de coorte — comparar safra contra a meta do blend seria enganoso.
  // Janela = MTD (igual ao resto do Farol); a seção Retenção ao lado é mês-calendário, por isso é grupo
  // separado. Sem ggrSafra no payload → todos os cards ficam null e o grupo some inteiro.
  // `share` = peso da safra no GGR do período (Σ GGR da safra ÷ Σ GGR de TODAS as safras no escopo).
  // Denominador = soma dos 4 buckets, não o M.ggr da casa: assim as 4 safras somam exatamente 100%
  // (o ggrSafra só cobre contas com FTD e trava o bucket em 3, então diverge ~3% do GGR total).
  // Vai nos DOIS cards da safra de propósito: o share é o PESO do número que você está lendo —
  // um hold de 3,8% numa safra que é 2% do GGR não vale o mesmo que numa que é 40%.
  // REGRA: a participação segue o NUMERADOR da métrica do card. GGR/Dep e Hold têm GGR em cima →
  // composição do GGR. Rollover tem turnover em cima → composição do TURNOVER. Assim o share sempre
  // responde "quanto deste numerador vem desta safra", em vez de misturar duas grandezas no mesmo card.
  const SAFRA_BK = [['m0', 'M0'], ['m1', 'M1'], ['m2', 'M2'], ['m3plus', 'M3+']];
  const bkArr = {}; let ggrAll = 0, ggrAllL = 0, turnAll = 0, turnAllL = 0;
  SAFRA_BK.forEach(([bk]) => {
    const arr = filterChannelList_((ggrSafra && ggrSafra[bk]) || [], filter);
    bkArr[bk] = arr;
    ggrAll   += arr.reduce((a, c) => a + (c.ggr || 0), 0);
    ggrAllL  += arr.reduce((a, c) => a + (c.ggrM1 || 0), 0);
    turnAll  += arr.reduce((a, c) => a + (c.turnover || 0), 0);
    turnAllL += arr.reduce((a, c) => a + (c.turnoverM1 || 0), 0);
  });
  // ROAS GGR M0 = GGR da safra M0 (mesma janela) ÷ Investimento. Irmão do ROAS Dep M0, trocando o
  // numerador DEPÓSITO por RECEITA — responde "cada real de mídia deste mês virou quanto de GGR de
  // jogador novo", que é o ROAS que fecha com PnL. Numerador = bucket m0 do ggrSafra (já no escopo do
  // filtro de canal); denominador = M.invest, o mesmo dos outros ROAS. Em "Total Casa" fica BLENDED de
  // propósito (numerador segue o slicer, denominador só tem mídia paga) — mesma regra do ROAS Dep D0/M0.
  const m0Arr = bkArr.m0 || [];
  const ggrM0Sum  = m0Arr.length ? m0Arr.reduce((a, c) => a + (c.ggr   || 0), 0) : null;
  const ggrM0SumL = m0Arr.length ? m0Arr.reduce((a, c) => a + (c.ggrM1 || 0), 0) : null;
  const safraMargem = {};
  SAFRA_BK.forEach(([bk, lbl]) => {
    const arr = bkArr[bk];
    const S = (k) => arr.reduce((a, c) => a + (c[k] || 0), 0);
    const on = arr.length > 0;
    const ggr = S('ggr'), dep = S('dep'), turn = S('turnover');
    const ggrL = S('ggrM1'), depL = S('depM1'), turnL = S('turnoverM1');
    const shareG  = (on && ggrAll   > 0) ? ggr / ggrAll    : null;
    const shareGL = (on && ggrAllL  > 0) ? ggrL / ggrAllL  : null;
    const shareT  = (on && turnAll  > 0) ? turn / turnAll  : null;
    const shareTL = (on && turnAllL > 0) ? turnL / turnAllL : null;
    const wShare = (m, sh, shL, unit) => (sh == null ? m : { ...m, share: sh, shareM1: shL, shareUnit: unit });
    safraMargem['ggrDep_' + bk] = wShare(mk(`GGR/Dep ${lbl}`, 'pct', on ? div(ggr, dep) : null, null, on ? div(ggrL, depL) : null), shareG, shareGL, 'GGR');
    safraMargem['hold_' + bk]   = wShare(mk(`Hold ${lbl}`,    'pct', on ? div(ggr, turn) : null, null, on ? div(ggrL, turnL) : null), shareG, shareGL, 'GGR');
    // Rollover da safra = turnover ÷ depósito (mesma definição do card da casa, recortada por idade).
    // Share = composição do TURNOVER (o numerador daqui), não do GGR.
    safraMargem['roll_' + bk]   = wShare(mk(`Rollover ${lbl}`, 'multiple', on ? div(turn, dep) : null, null, on ? div(turnL, depL) : null), shareT, shareTL, 'turnover');
  });

  const bpM = (bp && bp.month) || null;
  let roasDepM0Bp = div(dm0.bp, inv.bp);   // fallback: razão da janela (mock / sem bp.month)
  if (bpM) {
    if (sel.length) {
      let dm = 0, iv = 0;
      sel.forEach(ch => { const b = bpM.byChannel && bpM.byChannel[ch]; if (b) { dm += b.depM0 || 0; iv += b.invest || 0; } });
      if (iv > 0) roasDepM0Bp = dm / iv;
    } else if (filter && filter.scope === 'growth') {
      const g = bpM.growthAgg || {};
      if (g.invest > 0) roasDepM0Bp = (g.depM0 || 0) / g.invest;
    } else {
      const hh = bpM.house || {};
      if (hh.invest > 0) roasDepM0Bp = (hh.m0tt || 0) / hh.invest;
    }
  }
  // BP do Multiplicador M0 = mesma regra do ROAS Dep M0, trocando o denominador INVESTIMENTO pelo
  // FTD AMOUNT: razão do MÊS INTEIRO do plano, nunca a soma prorateada da janela.
  let multM0Bp = div(dm0.bp, fa.bp);
  if (bpM) {
    if (sel.length) {
      let dm = 0, fam = 0;
      sel.forEach(ch => { const b = bpM.byChannel && bpM.byChannel[ch]; if (b) { dm += b.depM0 || 0; fam += b.ftdAmount || 0; } });
      if (fam > 0) multM0Bp = dm / fam;
    } else if (filter && filter.scope === 'growth') {
      const g = bpM.growthAgg || {};
      if (g.ftdAmount > 0) multM0Bp = (g.depM0 || 0) / g.ftdAmount;
    } else {
      const hh = bpM.house || {};
      if (hh.ftdAmountTt > 0) multM0Bp = (hh.m0tt || 0) / hh.ftdAmountTt;
    }
  }
  return {
    cac:         mk('CAC', 'brl', div(inv.act, ftdQtyM), div(B.invest, B.ftd), div(inv.m1, ftdQtyL), true),   // custo: menor=melhor
    ticketFtd:   mk('Tkt Médio FTD', 'brl', div(fa.act, ftdQtyM), div(B.ftdAmount, B.ftd), div(fa.m1, ftdQtyL)),
    roasDepD0:   mk('ROAS Dep D0', 'multiple', div(depD0M, inv.act), div(B.depD0, B.invest), div(depD0Lm, inv.m1)),
    // BP = razão do MÊS INTEIRO do plano (roasDepM0Bp, calculado acima) — NÃO prorateada pela janela.
    roasDepM0:   mk('ROAS Dep M0', 'multiple', div(dm0.act, inv.act), roasDepM0Bp, div(dm0.m1, inv.m1)),
    // Multiplicador M0 = Dep M0 ÷ FTD Amount — quanto cada R$ de PRIMEIRO depósito virou de depósito
    // no mês. Mesma família do ROAS Dep M0 (que divide pelo investimento); aqui a base é o próprio FTD,
    // então mede reciclagem do depositante e não eficiência de mídia.
    multM0:      mk('Multiplicador M0', 'multiple', div(dm0.act, fa.act), multM0Bp, div(dm0.m1, fa.m1)),
    roasGgrM0:   mk('ROAS GGR M0', 'multiple', div(ggrM0Sum, inv.act), ROAS_GGR_M0_META(filter), div(ggrM0SumL, inv.m1)),
    ...safraMargem,
    // FreeSpins/Bonif = custos (menor=melhor). BP plano: meta fixa (flat) de % sobre depósitos. Sem trend (pedido do Luis).
    // M-1 = freespin/bonus do mês anterior (mesma janela) ÷ Depósitos Totais do mês anterior (dt.m1).
    freespinDep: mk('FreeSpins / Dep', 'pct', div(fs, dt.act), 0.02, div(fsLm, dt.m1), true),
    bonusDep:    mk('Bonificação / Dep', 'pct', div(bn, dt.act), 0.028, div(bnLm, dt.m1), true),
  };
}

// Recalcula bp/pctBp dos hero cards conforme o escopo (growth ou canal específico).
// Aquisição + DEP M0 vêm do BP per-canal; Depósitos Totais espelha o M0 (= "same as M0") em qualquer escopo; GGR não tem BP por canal → farol off.
function applyBpLive_(out, filter, bp) {
  if (!bp) return out;
  const list = chList_(filter);
  let sel;
  if (list.length) {
    sel = {};
    list.forEach(ch => {
      const b = bp.byChannel && bp.byChannel[ch];
      if (b) ['invest','ftdAmount','depD0','ftd','depM0'].forEach(k => { if (b[k] != null) sel[k] = (sel[k] || 0) + b[k]; });
    });
  }
  else if (filter.scope === 'growth') sel = bp.growthAgg || {};
  else return out; // total: mantém o BP do backend
  const setM = (m, bpVal) => {
    if (!m) return m;
    const v = (bpVal != null && isFinite(bpVal) && bpVal !== 0) ? bpVal : null;
    return { ...m, bp: v, pctBp: (v && m.act != null) ? m.act / v : null };
  };
  out.invest      = setM(out.invest, sel.invest);
  out.ftdAmount   = setM(out.ftdAmount, sel.ftdAmount);
  out.ftdQty      = setM(out.ftdQty, sel.ftd);   // `ftd` = #FTD do plano (o sel já somava; faltava o card consumir)
  out.roasFtd     = setM(out.roasFtd, (sel.ftdAmount && sel.invest) ? sel.ftdAmount / sel.invest : null);
  out.depM0Growth = setM(out.depM0Growth, sel.depM0);
  out.depM0Total  = setM(out.depM0Total, sel.depM0);
  out.depTotal    = setM(out.depTotal, sel.depM0);   // Depósitos Totais = M0 também no escopo canal/growth (mês 1)
  // Sem BP per-canal: zera o farol pra não mostrar BP de Total da Casa no escopo errado.
  out.ggr       = { ...out.ggr, bp: null, pctBp: null };
  out.ggrPerDep = { ...out.ggrPerDep, bp: null, pctBp: null };
  out.ggrTrend  = { ...out.ggrTrend, bp: null, pctBp: null };
  // Retenção: BP do plano é só Total da Casa (não há plano por canal) → farol off em canal/growth.
  out.retM0M1   = { ...out.retM0M1, bp: null, pctBp: null };
  out.retM1M2   = { ...out.retM1M2, bp: null, pctBp: null };
  out.retM3plus = { ...out.retM3plus, bp: null, pctBp: null };
  return out;
}

// YTD = janela acumulada desde ABRIL (início da operação Apostou) até o último dia com dado (= todayISO_).
// Antes de abril, ancora no abril do ano anterior (a janela sempre cobre o último abril→hoje).
function ytdStartISO_() {
  const t = new Date();
  const y = t.getMonth() < 3 ? t.getFullYear() - 1 : t.getFullYear();
  return y + '-04-01';
}

const PRESETS = [
  { id: 'mtd', label: 'MTD', range: () => {
      const from = firstOfMonthISO_(), to = todayISO_();
      return { from, to: to < from ? from : to };  // no dia 1º, não deixa "até" cair no mês anterior
    } },
  { id: 'ytd', label: 'YTD', range: () => ({ from: ytdStartISO_(), to: todayISO_() }) }, // acumulado desde abril até ontem — vale p/ TODAS as abas
  { id: 'dia', label: 'Diário', range: () => ({ from: todayISO_(), to: todayISO_() }) }, // um único dia (ontem = último dia completo)
  // Escada de janelas rolantes em MÚLTIPLOS DE 7 (7/14/21/28, o 30d virou 28d a pedido do Luis em
  // 06/08/2026): cada janela fecha o mesmo nº de segundas, sábados etc., então comparar uma com a
  // outra não carrega viés de dia da semana — o que o 30d fazia (cobria 4 ou 5 fins de semana
  // conforme o dia em que caía). `todayISO_()` já é ONTEM, e daysAgoISO_(n) volta n dias de hoje,
  // então a janela é fechada e tem exatamente n dias.
  { id: '7d',  label: '7d',  range: () => ({ from: daysAgoISO_(7),  to: todayISO_() }) },
  { id: '14d', label: '14d', range: () => ({ from: daysAgoISO_(14), to: todayISO_() }) },
  { id: '21d', label: '21d', range: () => ({ from: daysAgoISO_(21), to: todayISO_() }) },
  { id: '28d', label: '28d', range: () => ({ from: daysAgoISO_(28), to: todayISO_() }) },
  { id: 'lm',  label: 'Mês passado', range: () => lastMonthRangeISO_() },
];

// Atalhos de período do popover de EXTRAÇÃO (Excel). Cada um devolve {from,to}. Independem do slicer do
// dashboard — o export tem a própria seleção de data. "Mês atual" é o default (1 mês = 1 consulta, rápido).
const EXPORT_PRESETS = [
  { id: 'mtd', label: 'Mês atual',  range: () => { const from = firstOfMonthISO_(), to = todayISO_(); return { from, to: to < from ? from : to }; } },
  { id: 'lm',  label: 'Mês passado', range: () => lastMonthRangeISO_() },
  { id: '3m',  label: 'Últimos 3 meses', range: () => { const t = new Date(); return { from: toLocalISO_(new Date(t.getFullYear(), t.getMonth() - 2, 1)), to: todayISO_() }; } },
  { id: 'ytd', label: 'YTD',        range: () => ({ from: ytdStartISO_(), to: todayISO_() }) },
];
// Nº de meses-calendário que [from, to] cobre (inclusivo) — p/ avisar quantas consultas o export fará.
function monthsBetween_(from, to) {
  if (!from || !to || from > to) return 0;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

// Botão "Excel" com popover de SELEÇÃO DE DATA da extração (default = janela atual do slicer). Escolhe o
// período, mostra quantos meses/consultas, e dispara exportFarolRange_ (fetch em pool). Encapsula o
// próprio estado (aberto/período/ocupado) + fechar-ao-clicar-fora, no mesmo padrão do ChannelMultiSelect.
function ExcelExportButton({ defaultRange, chFilter, escopo, disabled }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [prog, setProg] = React.useState('');
  const [range, setRange] = React.useState(defaultRange);
  const ref = React.useRef(null);
  // Enquanto FECHADO, acompanha o slicer (default zero-fricção); aberto, respeita o que o usuário digitou.
  React.useEffect(() => { if (!open) setRange(defaultRange); }, [defaultRange.from, defaultRange.to, open]);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const nMonths = monthsBetween_(range.from, range.to);
  const badRange = !range.from || !range.to || range.from > range.to;
  const runExport = async () => {
    if (badRange) { alert('A data inicial não pode ser maior que a final.'); return; }
    setBusy(true); setProg('');
    try {
      await exportFarolRange_({ from: range.from, to: range.to, chFilter, escopo, onProgress: (d, t) => setProg(`${d}/${t}`) });
      setOpen(false);
    } catch (e) { alert('Falha ao gerar o Excel: ' + (e && e.message || e)); }
    finally { setBusy(false); setProg(''); }
  };
  const dInput = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '12px', padding: '5px 7px', borderRadius: '6px', colorScheme: 'dark' };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={busy ? 'refresh-btn spinning' : 'refresh-btn'}
        onClick={() => setOpen(o => !o)}
        disabled={disabled || busy}
        title="Exportar Farol + Monthly Close (mês a mês) em Excel — escolha o período da extração"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <path d="M7 10l5 5 5-5"/>
          <path d="M12 15V3"/>
        </svg>
        {busy ? `Gerando…${prog ? ' ' + prog : ''}` : 'Excel'}
      </button>
      {open && !busy && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: '272px', background: 'var(--surface)', border: '1px solid rgba(250,204,21,.45)', borderRadius: '10px', padding: '12px', boxShadow: '0 10px 28px rgba(0,0,0,.55)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '9px' }}>Período da extração</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px' }}>
            <input type="date" value={range.from} max={range.to || undefined} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} style={{ ...dInput, flex: 1, minWidth: 0 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
            <input type="date" value={range.to} min={range.from || undefined} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} style={{ ...dInput, flex: 1, minWidth: 0 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {EXPORT_PRESETS.map(p => {
              const r = p.range();
              const on = r.from === range.from && r.to === range.to;
              return <button key={p.id} type="button" className={`preset-btn ${on ? 'active' : ''}`} onClick={() => setRange(r)}>{p.label}</button>;
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {badRange ? 'Período inválido.' : `${nMonths} ${nMonths === 1 ? 'mês' : 'meses'} · ${nMonths} ${nMonths === 1 ? 'consulta' : 'consultas'} ao BigQuery`}
          </div>
          <button className="apply-btn" style={{ width: '100%' }} disabled={badRange} onClick={runExport}>Exportar Excel</button>
        </div>
      )}
    </div>
  );
}

// Aba Segurança (só admin) — designar quem tem acesso. Login validado no backend (doPost).
function SegurancaTab({ user, allTabs, hiddenTabs, onSetTabHidden }) {
  const [users, setUsers] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ email: '', name: '', senha: '', admin: false });
  const session = localStorage.getItem(SESSION_KEY);
  // Espelho do estado p/ ler a versão MAIS RECENTE dentro dos saves atrasados (evita stale closure).
  const usersRef = React.useRef(null);
  React.useEffect(() => { usersRef.current = users; }, [users]);
  const saveTimers = React.useRef({});
  const scenTimers = React.useRef({});   // debounce dos saves de cenário por usuário (separado das abas)
  const load = React.useCallback(() => {
    setErr(null);
    apiPost_({ action: 'listUsers', session }).then(j => {
      if (j && j.ok) setUsers(j.users); else setErr((j && j.error) || 'Falha ao listar usuários');
    }).catch(() => setErr('Erro de conexão'));
  }, [session]);
  React.useEffect(() => { load(); }, [load]);
  // Tracker de acessos (últimos 30 dias) — só admin. Carrega 1× ao abrir a aba.
  const [access, setAccess] = React.useState(null);
  const [accErr, setAccErr] = React.useState(null);
  React.useEffect(() => {
    apiPost_({ action: 'accessLog', session }).then(j => {
      if (j && j.ok) setAccess(j.access); else setAccErr((j && j.error) || 'Falha ao carregar acessos');
    }).catch(() => setAccErr('Erro de conexão'));
  }, [session]);
  const fmtWhen_ = (ts) => { try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } };
  const add = (ev) => {
    ev.preventDefault(); setBusy(true); setErr(null);
    apiPost_({ action: 'addUser', session, email: form.email, name: form.name, senha: form.senha, admin: form.admin })
      .then(j => { setBusy(false); if (j && j.ok) { setForm({ email: '', name: '', senha: '', admin: false }); load(); } else setErr((j && j.error) || 'Falha ao salvar'); })
      .catch(() => { setBusy(false); setErr('Erro de conexão'); });
  };
  const remove = (email) => {
    if (!window.confirm('Remover o acesso de ' + email + '?')) return;
    apiPost_({ action: 'removeUser', session, email }).then(j => { if (j && j.ok) load(); else setErr((j && j.error) || 'Falha ao remover'); }).catch(() => setErr('Erro de conexão'));
  };
  // Allowlist de abas por usuário. Vazio/tudo marcado = TODAS. Update OTIMISTA (reflete na hora); o save é
  // COALESCIDO por usuário (vários cliques seguidos viram 1 POST com o estado final) e lê o estado mais recente
  // via usersRef no momento do flush — assim (des)marcar várias abas em sequência não sobrescreve as anteriores.
  const allIds = (allTabs || []).map(t => t.id);
  const flushTabs = React.useCallback((email) => {
    const u = (usersRef.current || []).find(x => x.email === email);
    const tabs = (u && Array.isArray(u.tabs)) ? u.tabs : [];   // null (todas) → [] no wire
    apiPost_({ action: 'setUserTabs', session, email, tabs })
      .then(j => { if (!(j && j.ok)) setErr((j && j.error) || 'Falha ao salvar abas'); })
      .catch(() => setErr('Erro de conexão'));
  }, [session]);
  // Mesmo padrão p/ a allowlist de CENÁRIOS do Farol (setUserScen).
  const flushScen = React.useCallback((email) => {
    const u = (usersRef.current || []).find(x => x.email === email);
    const scen = (u && Array.isArray(u.scen)) ? u.scen : [];   // null (todos) → [] no wire
    apiPost_({ action: 'setUserScen', session, email, scen })
      .then(j => { if (!(j && j.ok)) setErr((j && j.error) || 'Falha ao salvar cenários'); })
      .catch(() => setErr('Erro de conexão'));
  }, [session]);
  // Dispara saves pendentes ao sair da aba (navegar antes do debounce).
  React.useEffect(() => () => {
    Object.keys(saveTimers.current).forEach(email => { clearTimeout(saveTimers.current[email]); flushTabs(email); });
    Object.keys(scenTimers.current).forEach(email => { clearTimeout(scenTimers.current[email]); flushScen(email); });
  }, [flushTabs, flushScen]);
  const toggleUserTab = (email, tabId) => {
    setErr(null);
    setUsers(prev => (prev || []).map(x => {
      if (x.email !== email) return x;
      const restricted = Array.isArray(x.tabs) && x.tabs.length;
      const cur = restricted ? x.tabs.slice() : allIds.slice();   // "todas" (null) → expande p/ desmarcar a partir de tudo
      const raw = cur.indexOf(tabId) >= 0 ? cur.filter(y => y !== tabId) : cur.concat([tabId]);
      const nextTabs = raw.length >= allIds.length ? null : raw;   // tudo marcado → null (sem restrição)
      return { ...x, tabs: nextTabs };
    }));
    if (saveTimers.current[email]) clearTimeout(saveTimers.current[email]);
    saveTimers.current[email] = setTimeout(() => { delete saveTimers.current[email]; flushTabs(email); }, 600);
  };
  // Allowlist de CENÁRIOS do Farol por usuário (mesmo padrão otimista+coalescido das abas). scenIds = bp/conserv/rolling.
  const scenIds = CENARIOS.map(c => c.id);
  const toggleUserScen = (email, scenId) => {
    setErr(null);
    setUsers(prev => (prev || []).map(x => {
      if (x.email !== email) return x;
      const restricted = Array.isArray(x.scen) && x.scen.length;
      const cur = restricted ? x.scen.slice() : scenIds.slice();   // "todos" (null) → expande p/ desmarcar a partir de tudo
      const raw = cur.indexOf(scenId) >= 0 ? cur.filter(y => y !== scenId) : cur.concat([scenId]);
      const nextScen = raw.length >= scenIds.length ? null : raw;   // tudo marcado → null (sem restrição)
      return { ...x, scen: nextScen };
    }));
    if (scenTimers.current[email]) clearTimeout(scenTimers.current[email]);
    scenTimers.current[email] = setTimeout(() => { delete scenTimers.current[email]; flushScen(email); }, 600);
  };
  const inp = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' };
  return (
    <React.Fragment>
      <div className="tab-header"><div>
        <h1>Segurança · Acessos</h1>
        <div className="subtitle">Quem pode entrar no dashboard. Login validado no backend, senha guardada em hash (SHA-256). Só admin vê esta aba.</div>
      </div></div>
      <div className="support">
        <div className="support-title">Quem acessou · últimos {access ? access.windowDays : 30} dias</div>
        <div className="ch-note" style={{ marginTop: 0, marginBottom: '12px' }}>
          Cada usuário <strong>autenticado</strong> que carrega o dashboard é registrado (o cockpit é gated por login → só aparece quem entrou; não há visita anônima). No máx 1 registro por hora por pessoa. Só admin vê.
        </div>
        {accErr && <div style={{ color: 'var(--negative)', fontSize: '12px', marginBottom: '8px' }}>{accErr}</div>}
        <div className="table-scroll"><table className="ch-table">
          <thead><tr><th>Usuário</th><th>E-mail</th><th>Último acesso</th><th>Dias ativos</th><th>Acessos</th><th title="Um bloco por dia (14 dias); aceso = acessou">Últimos 14 dias</th></tr></thead>
          <tbody>
            {(access ? access.users : []).map((u, i) => {
              const daySet = {}; (u.days || []).forEach(d => { daySet[d] = 1; });
              return (
                <tr key={i}>
                  <td className="ch-name">{u.name}{u.admin ? ' · admin' : ''}{!u.known ? ' · removido' : ''}</td>
                  <td>{u.email}</td>
                  <td>{u.lastSeen ? fmtWhen_(u.lastSeen) : '—'}</td>
                  <td>{u.activeDays}</td>
                  <td>{u.hits}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {Array.from({ length: 14 }, (_, k) => {
                      const iso = daysAgoISO_(13 - k);
                      const on = !!daySet[iso];
                      return <span key={k} title={iso} style={{ display: 'inline-block', width: '8px', height: '13px', marginRight: '2px', borderRadius: '2px', background: on ? 'var(--accent-yellow)' : 'var(--border)' }} />;
                    })}
                  </td>
                </tr>
              );
            })}
            {access && access.users.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--text-muted)' }}>nenhum acesso registrado ainda</td></tr>}
            {!access && !accErr && <tr><td colSpan="6" style={{ color: 'var(--text-muted)' }}>carregando…</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="support">
        <div className="support-title">Adicionar / atualizar acesso</div>
        <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
          <input style={inp} type="email" placeholder="e-mail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input style={inp} type="text" placeholder="nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={inp} type="password" placeholder="senha inicial" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} required />
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input type="checkbox" checked={form.admin} onChange={e => setForm(f => ({ ...f, admin: e.target.checked }))} /> admin
          </label>
          <button className="apply-btn" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </form>
        {err && <div style={{ color: 'var(--negative)', fontSize: '12px', marginBottom: '8px' }}>{err}</div>}
        <div className="table-scroll"><table className="ch-table">
          <thead><tr><th>E-mail</th><th>Nome</th><th>Admin</th><th>Abas</th><th></th></tr></thead>
          <tbody>
            {(users || []).map((u, i) => (
              <tr key={i}>
                <td className="ch-name">{u.email}</td>
                <td>{u.name}</td>
                <td>{u.admin ? '✓' : '—'}</td>
                <td style={{ color: (!u.admin && u.tabs && u.tabs.length) ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
                  {u.admin ? 'todas' : (u.tabs && u.tabs.length) ? `${u.tabs.length} de ${allIds.length}` : 'todas'}
                </td>
                <td>{u.email === (user && user.email) ? <span style={{ color: 'var(--text-dim)' }}>você</span> : <button className="logout-btn" onClick={() => remove(u.email)}>remover</button>}</td>
              </tr>
            ))}
            {users && users.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--text-muted)' }}>nenhum usuário</td></tr>}
            {!users && !err && <tr><td colSpan="5" style={{ color: 'var(--text-muted)' }}>carregando…</td></tr>}
          </tbody>
        </table></div>
        <div className="ch-note">A senha é definida aqui e guardada em <strong>hash</strong> (não dá pra ler depois) — passe ao usuário por um canal seguro. Reenviar com o mesmo e-mail <strong>redefine</strong> a senha. Remover tira o acesso (sessões ativas expiram em até 6h).</div>
      </div>
      <div className="support" style={{ marginTop: '16px' }}>
        <div className="support-title">Visibilidade das abas</div>
        <div className="ch-note" style={{ marginTop: 0, marginBottom: '12px' }}>
          Desmarque uma aba para <strong>ocultá-la do menu</strong> — some para <strong>todos, inclusive você</strong>. Reexiba aqui a qualquer momento (esta aba nunca some). Vale no próximo carregamento do dashboard.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(allTabs || []).map(t => {
            const hidden = (hiddenTabs || []).indexOf(t.id) >= 0;
            return (
              <label
                key={t.id}
                title={hidden ? 'Oculta para não-admins' : 'Visível para todos'}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 11px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: 'var(--surface)', opacity: hidden ? 0.6 : 1 }}
              >
                <input type="checkbox" checked={!hidden} onChange={e => onSetTabHidden(t.id, !e.target.checked)} />
                {t.label}
                {hidden && <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>oculta</span>}
              </label>
            );
          })}
        </div>
      </div>

      <div className="support" style={{ marginTop: '16px' }}>
        <div className="support-title">Acesso por aba · por usuário</div>
        <div className="ch-note" style={{ marginTop: 0, marginBottom: '12px' }}>
          Marque as abas que <strong>cada pessoa</strong> pode ver. <strong>Todas marcadas = sem restrição</strong> (vê tudo); desmarque p/ limitar. Admins veem todas sempre. Aplica no <strong>próximo login/refresh</strong> da pessoa. É um filtro do <em>menu</em> (esconde as abas) — não é uma barreira de dados no backend.
        </div>
        {err && <div style={{ color: 'var(--negative)', fontSize: '12px', marginBottom: '10px' }}>{err}</div>}
        {(users || []).filter(u => !u.admin).map((u, i) => {
          const restricted = Array.isArray(u.tabs) && u.tabs.length;
          return (
            <div key={i} style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', marginBottom: '7px' }}>
                <strong>{u.name}</strong> <span style={{ color: 'var(--text-dim)' }}>{u.email}</span>
                {' · '}<span style={{ color: restricted ? 'var(--accent-yellow)' : 'var(--text-muted)', fontSize: '12px' }}>
                  {restricted ? `só ${u.tabs.length} aba${u.tabs.length > 1 ? 's' : ''}` : 'todas as abas'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(allTabs || []).map(t => {
                  const on = restricted ? (u.tabs.indexOf(t.id) >= 0) : true;   // sem restrição = tudo marcado
                  return (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'var(--surface)', opacity: on ? 1 : 0.5 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleUserTab(u.email, t.id)} />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        {users && (users || []).filter(u => !u.admin).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum usuário não-admin. (Admins sempre veem todas as abas.)</div>}
      </div>

      <div className="support" style={{ marginTop: '16px' }}>
        <div className="support-title">Acesso por cenário do Farol · por usuário</div>
        <div className="ch-note" style={{ marginTop: 0, marginBottom: '12px' }}>
          Marque os cenários do <strong>Farol</strong> (BP / Conservador / Rolling) que <strong>cada pessoa</strong> pode ver no switcher. <strong>Todos marcados = sem restrição</strong>; desmarque p/ limitar. Admins veem todos sempre. Aplica no <strong>próximo login/refresh</strong> da pessoa. É um filtro do <em>switcher de cenário</em> — não é uma barreira de dados no backend.
        </div>
        {(users || []).filter(u => !u.admin).map((u, i) => {
          const restricted = Array.isArray(u.scen) && u.scen.length;
          return (
            <div key={i} style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', marginBottom: '7px' }}>
                <strong>{u.name}</strong> <span style={{ color: 'var(--text-dim)' }}>{u.email}</span>
                {' · '}<span style={{ color: restricted ? 'var(--accent-yellow)' : 'var(--text-muted)', fontSize: '12px' }}>
                  {restricted ? `só ${u.scen.length} cenário${u.scen.length > 1 ? 's' : ''}` : 'todos os cenários'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {CENARIOS.map(c => {
                  const on = restricted ? (u.scen.indexOf(c.id) >= 0) : true;   // sem restrição = tudo marcado
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'var(--surface)', opacity: on ? 1 : 0.5 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleUserScen(u.email, c.id)} />
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        {users && (users || []).filter(u => !u.admin).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum usuário não-admin. (Admins sempre veem todos os cenários.)</div>}
      </div>
    </React.Fragment>
  );
}

// Filtra [{channel,...}] pelo escopo do chFilter (seleção explícita > growth > todos). Espelha o
// filterByChannel do App (que é closure sobre chFilter) numa forma standalone reusável.
function filterChannelList_(list, chFilter) {
  if (!list) return list;
  const sel = chList_(chFilter);
  if (sel.length) return list.filter(c => sel.indexOf(c.channel) >= 0);
  if (chFilter && chFilter.scope === 'growth') return list.filter(c => isGrowthCh_(c.channel));
  return list;
}

// Deriva dispM (hero cards, com override WINDOW-AWARE de DEP M0 pela coorte ggrSafra.m0) + farolMetrics
// de um dataset {M, componentsByChannel, retentionChannels, depM0Channels, bp, ggrSafra, channels, ggrChannels}
// no escopo do chFilter. FONTE ÚNICA: o App (janela atual) e o export YTD (mês a mês) consomem daqui.
function derivePayloadMetrics_(src, chFilter, isLive) {
  const s = src || {};
  const displayM = isLive
    ? deriveLiveM_(s.M, chFilter, s.componentsByChannel, s.retentionChannels, s.depM0Channels, s.bp, s.ggrRetentionChannels, s.turnRetentionChannels)
    : deriveMockM_(s.M, chFilter);
  const m0 = (s.ggrSafra && s.ggrSafra.m0) ? filterChannelList_(s.ggrSafra.m0, chFilter) : null;
  let dispM = displayM;
  if (m0 && m0.length) {
    let dep = 0, depM1 = 0, gDep = 0, gDepM1 = 0;
    m0.forEach(c => { dep += c.dep || 0; depM1 += c.depM1 || 0; if (isGrowthCh_(c.channel)) { gDep += c.dep || 0; gDepM1 += c.depM1 || 0; } });
    const over = (mm, act, m1) => mm ? { ...mm, act, m1 } : mm;
    dispM = { ...displayM, depM0Total: over(displayM.depM0Total, dep, depM1), depM0Growth: over(displayM.depM0Growth, gDep, gDepM1) };
  }
  const farol = buildFarolMetrics_(dispM, s.componentsByChannel, s.channels, s.ggrChannels, s.bp, chFilter, s.ggrSafra);
  return { dispM, farol };
}

function App({ user, onLogout, config }) {
  // 'aquisicao' era o default até 2026-08-05, quando a aba foi eliminada. Quem tinha uma aba removida
  // persistida cai no fallback da linha ~5775 (1ª aba visível) — não quebra, só volta pro Farol.
  const [tabId, setTabId] = usePersistedState('rvops:tab', 'farol');
  // Visibilidade de abas (global, editável por admin). hiddenTabs = ids ocultas p/ não-admins.
  const [hiddenTabs, setHiddenTabsState] = React.useState(() => (config && config.hiddenTabs) || []);
  React.useEffect(() => { if (config && Array.isArray(config.hiddenTabs)) setHiddenTabsState(config.hiddenTabs); }, [config]);
  const setTabHidden = React.useCallback((id, hide) => {
    const session = localStorage.getItem(SESSION_KEY);
    setHiddenTabsState(prev => {
      const next = hide ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id);
      apiPost_({ action: 'setHiddenTabs', session, tabs: next })
        .then(j => { if (j && j.ok && j.config && Array.isArray(j.config.hiddenTabs)) setHiddenTabsState(j.config.hiddenTabs); else setHiddenTabsState(prev); })
        .catch(() => setHiddenTabsState(prev));
      return next;
    });
  }, []);
  const initialRange = PRESETS[0].range();
  const [pendingRange, setPendingRange] = useState(initialRange);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [activePreset, setActivePreset] = useState('mtd');
  // Filtro de canal: channels = [] (Todos, cai no escopo) ou lista de canais · scope = 'all' (Total Casa) | 'growth' (Canais Growth)
  const [chFilter, setChFilter] = usePersistedState('rvops:chFilter', { channels: [], scope: 'all' });
  const ytd = activePreset === 'ytd';   // YTD ativo = preset de data 'ytd' (janela abril→ontem); vale p/ todas as abas via appliedRange
  const [state, setState] = useState({
    loading: !!ENDPOINT_URL,
    error: null,
    meta: MOCK_META,
    M: MOCK_M,
    clusterDep: CLUSTER_DEP,
    clusterGgr: CLUSTER_GGR,
    depComposition: MOCK_DEP_COMPOSITION,
    verticals: VERTICALS,
    channels: MOCK_CHANNELS,
    retentionChannels: MOCK_RETENTION_CHANNELS,
    ggrChannels: MOCK_GGR_CHANNELS,
    ggrSafra: MOCK_GGR_SAFRA,       // GGR por safra (M0/M1/M2/M3+) — mock durante o load; live vem de payload.ggrSafra
    ggrSafraRoas: MOCK_GGR_SAFRA_ROAS, // invest + GGR acumulado por safra (cohort ROAS) — live vem de payload.ggrSafraRoas
    monthlyClose: null,        // depósitos por safra {act,bp} — aba Monthly Close
    ftdByRegister: null,       // FTDs por canal cohortados por data de CADASTRO — toggle no Farol (só live/backend v34+)
    ggrPayback: MOCK_GGR_PAYBACK,
    retencaoFaixa: MOCK_RETENCAO_FAIXA,
    componentsByChannel: null,
    depM0Channels: MOCK_DEPM0_CHANNELS,
    bp: MOCK_BP,
    planScenarios: null,       // plano de aquisição 3 cenários {bp,conserv,rolling} (aba DB Plan_Growth Mkt) — switch do Farol (só live/backend v42+)
    farolSpark: null,          // últimas 4 semanas fechadas por KPI (semana × canal) — linha de tendência nos hero cards do Farol (só live/backend v50+)
    planFcRatios: null,        // metas de Turnover/Rollover/Hold/FreeSpins-Dep do FORECAST (aba Projection_Revenue) — backend v64+
    isLive: false,
    retFaixaLive: false,   // o payload trouxe retencaoFaixa de verdade? false = tela mostrando MOCK
    benchmarkNet: null,        // benchmark_net.json (Apostou + Lottu, faixa_diaria com saque/net)
  });

  const loadData = React.useCallback((opts = {}) => {
    if (!ENDPOINT_URL) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    // Sempre busca o dataset completo (todos os canais); o filtro de canal é client-side (instantâneo).
    let url = `${ENDPOINT_URL}?${authParam_()}&from=${appliedRange.from}&to=${appliedRange.to}`;
    if (opts.bustCache) url += `&refresh=true`;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(payload => {
        if (payload.error === 'unauthorized') { if (onLogout) onLogout(); return; }
        if (payload.error) throw new Error(payload.error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          meta: payload.meta || prev.meta,
          M: payload.metrics || prev.M,
          clusterDep: payload.clusterDep,
          clusterGgr: payload.clusterGgr,
          depComposition: payload.depComposition,
          verticals: payload.verticals,
          channels: payload.channels,
          ftdByRegister: payload.ftdByRegister || null,
          retentionChannels: payload.retentionChannels,
          ggrRetentionChannels: payload.ggrRetentionChannels,
          turnRetentionChannels: payload.turnRetentionChannels,
          ggrChannels: payload.ggrChannels,
          ggrSafra: payload.ggrSafra || prev.ggrSafra,        // mantém o último bom (ou mock) se o live vier vazio → toggle de safra nunca some
          ggrSafraRoas: payload.ggrSafraRoas || prev.ggrSafraRoas,
          monthlyClose: payload.monthlyClose || null,
          ggrPayback: payload.ggrPayback || prev.ggrPayback,
          retencaoFaixa: payload.retencaoFaixa || prev.retencaoFaixa,  // cai no mock até o backend mandar (igual às outras abas)
          // ⚠️ A linha acima mantém o MOCK quando o backend devolve retencaoFaixa nulo (safeQuery_ engoliu
          // um erro da query) — e `isLive` vira true do mesmo jeito, então o chip do topo diz "Live" com
          // dado falso na tela. Esta flag separa as duas coisas: só é true quando o payload REALMENTE trouxe
          // a base. Quem consome retencaoFaixa deve avisar na tela quando ela for false.
          retFaixaLive: !!(payload.retencaoFaixa && payload.retencaoFaixa.length),
          componentsByChannel: payload.componentsByChannel || null,
          depM0Channels: payload.depM0Channels,
          bp: payload.bp || null,
          planScenarios: payload.planScenarios || null,
          farolSpark: payload.farolSpark || null,
          planFcRatios: payload.planFcRatios || null,
          isLive: true,
        }));
      })
      .catch(err => {
        setState(prev => ({ ...prev, loading: false, error: String(err.message || err) }));
      });
  }, [appliedRange.from, appliedRange.to]); // canal/scope NÃO disparam fetch — filtro é client-side

  useEffect(() => { loadData(); }, [loadData]);

  // Benchmark das casas concorrentes — arquivo estático servido ao lado do index.html.
  // 2026-08-05: `benchmark.json` (3 casas, ~828 KB) e `benchmark_sameday.json` (~201 KB) deixaram de ser
  // baixados junto com a remoção da aba Benchmark — ficaram sem consumidor. Os arquivos seguem no repo
  // (o build_benchmark.py ainda os gera); se a aba voltar, é só religar o fetch.
  useEffect(() => {
    // cache:'no-cache' = revalida sempre (304 se igual) — evita date bounds/casas estagnados de versão antiga do JSON.
    const opt = { cache: 'no-cache' };
    fetch('benchmark_net.json', opt)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setState(prev => ({ ...prev, benchmarkNet: j })); })
      .catch(() => {});
  }, []);

  // Auto-roll do calendário: se um preset estiver ativo (MTD/YTD/7-28d/mês passado),
  // re-avalia a data quando a aba volta ao foco e periodicamente — assim o MTD
  // acompanha o dia mesmo numa aba/telão deixado aberto virando a meia-noite.
  // Só atualiza (e re-busca) se a janela realmente mudou.
  useEffect(() => {
    if (!activePreset) return;
    function reevaluate() {
      const p = PRESETS.find(x => x.id === activePreset);
      if (!p) return;
      const r = p.range();
      const same = prev => prev.from === r.from && prev.to === r.to;
      setAppliedRange(prev => same(prev) ? prev : r);
      setPendingRange(prev => same(prev) ? prev : r);
    }
    function onVisible() { if (document.visibilityState === 'visible') reevaluate(); }
    window.addEventListener('focus', reevaluate);
    document.addEventListener('visibilitychange', onVisible);
    const tick = setInterval(reevaluate, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', reevaluate);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(tick);
    };
  }, [activePreset]);

  // Filtro client-side (modo mock e redundância no live) das tabelas por canal
  function filterByChannel(list, isPaid) {
    if (!list) return list;
    const sel = chList_(chFilter);
    if (sel.length) return list.filter(c => sel.includes(c.channel));
    if (chFilter.scope === 'growth') {
      return list.filter(c => isGrowthCh_(c.channel));
    }
    return list;
  }

  const fChannels = filterByChannel(state.channels, c => c.spend != null);
  const fGgrChannels = filterByChannel(state.ggrChannels, c => c.spend != null);
  // GGR por safra: filtra cada bucket pelos mesmos canais (client-side), igual às outras tabelas.
  const fGgrSafra = state.ggrSafra
    ? Object.keys(state.ggrSafra).reduce((o, b) => { o[b] = filterByChannel(state.ggrSafra[b], null); return o; }, {})
    : null;
  const fGgrSafraRoas = state.ggrSafraRoas
    ? Object.keys(state.ggrSafraRoas).reduce((o, b) => { o[b] = filterByChannel(state.ggrSafraRoas[b], null); return o; }, {})
    : null;
  // Depósitos do mês por canal (qtd + valor) — derivado do componentsByChannel (player_metrics).

  // Opções do dropdown: nomes dos canais presentes no dado (sem filtro aplicado)
  const channelOptions = (state.channels || []).map(c => c.channel);

  // Hero cards (dispM, com override WINDOW-AWARE de DEP M0 via ggrSafra.m0: o deriveLiveM_ pega o M0 da view
  // de coorte MENSAL — mês do início da janela — que quebra em YTD e nas janelas rolantes; ggrSafra.m0[].dep já é o DEP M0
  // DENTRO da janela) + métricas do Farol (CAC/Tkt/ROAS/FreeSpins…). FONTE ÚNICA derivePayloadMetrics_ —
  // a MESMA derivação que o export YTD roda mês a mês.
  const { dispM, farol: farolMetrics } = derivePayloadMetrics_({
    M: state.M, componentsByChannel: state.componentsByChannel, retentionChannels: state.retentionChannels, ggrRetentionChannels: state.ggrRetentionChannels, turnRetentionChannels: state.turnRetentionChannels,
    depM0Channels: state.depM0Channels, bp: state.bp, ggrSafra: state.ggrSafra, channels: state.channels, ggrChannels: state.ggrChannels,
  }, chFilter, state.isLive);

  function applyPreset(presetId) {
    const p = PRESETS.find(x => x.id === presetId);
    if (!p) return;
    const r = p.range();
    setActivePreset(presetId);
    setPendingRange(r);
    setAppliedRange(r);
  }

  function applyManual() {
    setActivePreset(null);
    setAppliedRange(pendingRange);
  }

  const isDirty = pendingRange.from !== appliedRange.from || pendingRange.to !== appliedRange.to;

  // Aba Segurança só aparece p/ admin. Fallback p/ 1ª aba se o tabId persistido não existir no escopo.
  // Abas globalmente OCULTAS somem do nav p/ TODOS — inclusive admin — e são reexibidas pela aba Segurança
  // ("Visibilidade das abas"). A allowlist POR USUÁRIO restringe ainda mais, DENTRO das não-ocultas.
  const isAdmin = !!(user && user.admin);
  const notHidden = TABS.filter(t => hiddenTabs.indexOf(t.id) < 0);   // vale p/ todos, inclusive admin
  const userTabs = (user && Array.isArray(user.tabs) && user.tabs.length) ? user.tabs : null;
  const baseTabs = (!isAdmin && userTabs)
    ? notHidden.filter(t => userTabs.indexOf(t.id) >= 0)   // não-admin restrito: interseção com as visíveis
    : notHidden;
  let visibleTabs = isAdmin
    ? baseTabs.concat([{ id: 'seguranca', label: 'Segurança', component: SegurancaTab }])   // admin sempre tem Segurança p/ reexibir
    : baseTabs;
  if (!visibleTabs.length) visibleTabs = [TABS[0]];   // fail-safe: nunca deixa o usuário com ZERO aba
  const activeTabId = visibleTabs.find(t => t.id === tabId) ? tabId : visibleTabs[0].id;
  // Abas já visitadas ficam MONTADAS (escondidas via CSS) — não refazem fetch nem perdem estado/datas ao trocar.
  // Montagem é LAZY: só monta a aba na 1ª visita (não dispara o fetch de todas no load).
  const [visitedTabs, setVisitedTabs] = React.useState({});
  React.useEffect(() => { setVisitedTabs(v => v[activeTabId] ? v : { ...v, [activeTabId]: true }); }, [activeTabId]);
  const tabProps = {
    user, M: dispM, farol: farolMetrics, channels: fChannels, bp: state.bp,
    ggrChannels: fGgrChannels, ggrSafra: fGgrSafra, ggrSafraRoas: fGgrSafraRoas, ggrPayback: state.ggrPayback,
    retencaoFaixa: state.retencaoFaixa, retFaixaLive: state.retFaixaLive,
    componentsByChannel: state.componentsByChannel,   // spend/ftd por canal (tbl_performance_daily) — aba CAC usa p/ Investimento bater com o Farol
    meta: state.meta,
    benchmarkNet: state.benchmarkNet, chFilter, range: appliedRange,
    isLive: state.isLive,
    monthlyClose: state.monthlyClose,   // aba Monthly Close (house-level, segue scope do backend)
    ftdByRegister: state.ftdByRegister,  // FTDs por canal por data de cadastro — toggle no Farol (Aquisição)
    planScenarios: state.planScenarios,  // plano 3 cenários (BP/Conservador/Rolling) — switch de cenário do Farol
    farolSpark: state.farolSpark,  // últimas 4 semanas fechadas por KPI — linha de tendência nos hero cards do Farol
    planFcRatios: state.planFcRatios,  // metas de razão do Forecast (Projection_Revenue)
    ytd,   // YTD ativo (preset global): Farol/Monthly Close suprimem M-1/trend e relabelam (a janela já é abril→ontem via appliedRange)
    allTabs: TABS, hiddenTabs, onSetTabHidden: setTabHidden,   // controle de visibilidade (Segurança)
  };

  // Enquanto o payload oficial não chega, a tela mostra MOCK (na 1ª carga) ou o dado do período
  // ANTERIOR (ao trocar o slicer) — número que parece real e não é. Nesse intervalo o conteúdo fica
  // borrado e não-clicável, com uma engrenagem no meio (pedido do Luis, 06/08/2026).
  // ⚠️ Em ERRO também mantém o borrado: se desborrasse, o mock ficaria nítido na tela justamente
  // quando não há dado oficial — que é o caso pior. O overlay troca a engrenagem por "tentar de novo".
  // Sem ENDPOINT_URL (modo mock/QA local) nunca borra, senão a tela ficaria travada para sempre.
  const aguardando = !!ENDPOINT_URL && (state.loading || !state.isLive || !!state.error);

  return (
    <React.Fragment>
      <header className="topbar">
        <div className="brand">RevOps Cockpit<span> — Apostou</span></div>
        <div className="controls">
          <span className="meta-chip">
            {fmtBR_(appliedRange.from)} → {fmtBR_(appliedRange.to)}
          </span>
          {state.loading && <span className="meta-chip">Carregando do BQ…</span>}
          {state.error && <span className="mock-chip" title={state.error}>Erro · usando mock</span>}
          {!state.loading && !state.error && (
            <span className={state.isLive ? 'meta-chip' : 'mock-chip'}>
              {state.isLive ? 'Live · BigQuery' : 'Mock · BQ pendente'}
            </span>
          )}
          {ENDPOINT_URL && (
            <button
              className={state.loading ? 'refresh-btn spinning' : 'refresh-btn'}
              onClick={() => loadData({ bustCache: true })}
              disabled={state.loading}
              title="Atualizar dados (fura o cache de 1h do BigQuery)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {state.loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          )}
          <ExcelExportButton
            defaultRange={appliedRange}
            chFilter={chFilter}
            escopo={chLabel_(chFilter)}
            disabled={state.loading}
          />
          {user && <span className="user-chip" title={user.email}>{user.name}{user.admin ? ' · admin' : ''}</span>}
          {onLogout && <button className="logout-btn" onClick={onLogout} title="Encerrar sessão">Sair</button>}
        </div>
      </header>
      <div className="slicer slicer-main">
        <div className="slicer-group">
          <label>De</label>
          <input
            type="date"
            value={pendingRange.from}
            max={pendingRange.to}
            onChange={e => { setPendingRange(r => ({ ...r, from: e.target.value })); setActivePreset(null); }}
          />
          <span className="slicer-arrow">→</span>
          <label>Até</label>
          <input
            type="date"
            value={pendingRange.to}
            min={pendingRange.from}
            onChange={e => { setPendingRange(r => ({ ...r, to: e.target.value })); setActivePreset(null); }}
          />
        </div>
        <div className="slicer-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`preset-btn ${activePreset === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="slicer-divider" />
        <div className="slicer-group">
          <label>Canal</label>
          <ChannelMultiSelect
            options={channelOptions}
            selected={chList_(chFilter)}
            onChange={chs => setChFilter(f => ({ ...f, channels: chs }))}
          />
        </div>
        <div className="slicer-presets">
          <button
            className={`preset-btn ${chFilter.scope === 'growth' ? 'active' : ''}`}
            onClick={() => setChFilter(f => ({ ...f, scope: 'growth' }))}
            title="Universo = só mídia paga (Meta, Google, TikTok, Kwai, Programática). Define o que 'Todos' mostra."
          >
            Canais Growth
          </button>
          <button
            className={`preset-btn ${chFilter.scope === 'all' ? 'active' : ''}`}
            onClick={() => setChFilter(f => ({ ...f, scope: 'all' }))}
            title="Universo = casa toda. Define o que 'Todos' mostra."
          >
            Total Casa
          </button>
        </div>
        <button className="apply-btn" disabled={!isDirty} onClick={applyManual}>Aplicar</button>
      </div>
      <nav className="tabs">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tabId === t.id ? 'active' : ''}`}
            onClick={() => setTabId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        <div className={aguardando ? 'gate-blur' : undefined}>
        {visibleTabs.filter(t => visitedTabs[t.id] || t.id === activeTabId).map(t => {
          const Comp = t.component;
          return (
            <div key={t.id} style={{ display: t.id === activeTabId ? 'contents' : 'none' }}>
              <Comp {...tabProps} />
            </div>
          );
        })}
        <div className="footer">
          <span className="farol-key"><span className="dot verde" /> ≥ 95% BP</span>
          <span className="farol-key"><span className="dot amarelo" /> 85–94%</span>
          <span className="farol-key"><span className="dot vermelho" /> &lt; 85%</span>
          <div style={{ marginTop: 8 }}>
            {state.isLive
              ? <>Live · dados até {state.meta.dataMaxDate ? state.meta.dataMaxDate.slice(8,10)+'/'+state.meta.dataMaxDate.slice(5,7) : '—'} · gerado em {state.meta.generatedAt ? new Date(state.meta.generatedAt).toLocaleString('pt-BR') : '—'}</>
              : <>Snapshot {state.meta.refDate} · Mock data · Configure <code>ENDPOINT_URL</code> para ir live</>
            }
          </div>
        </div>
        </div>
        {aguardando && (
          <div className="gate-overlay" role="status" aria-live="polite">
            <svg className={`gate-gear${state.error ? '' : ' spin'}`} viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {state.error ? (
              <React.Fragment>
                <div className="gate-msg gate-err">Não foi possível carregar os números oficiais</div>
                <div className="gate-sub" title={state.error}>O que está por baixo é dado provisório — não use.</div>
                <button className="apply-btn" onClick={() => loadData({ bustCache: true })}>Tentar de novo</button>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="gate-msg">Carregando os números oficiais…</div>
                <div className="gate-sub">{fmtBR_(appliedRange.from)} → {fmtBR_(appliedRange.to)}</div>
              </React.Fragment>
            )}
          </div>
        )}
      </main>
    </React.Fragment>
  );
}

// ===== Tela de login (gateia o app quando há ENDPOINT_URL e não há sessão) =====
function Login({ onLogin }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = (ev) => {
    ev.preventDefault(); setBusy(true); setErr(null);
    apiPost_({ action: 'login', email, senha })
      .then(j => { if (j && j.ok) onLogin(j.session, j.user, j.config); else { setErr((j && j.error) || 'Falha no login'); setBusy(false); } })
      .catch(() => { setErr('Erro de conexão'); setBusy(false); });
  };
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-title">RevOps Cockpit</div>
        <div className="login-sub">Acesso restrito · Apostou</div>
        <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="username" />
        <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" />
        {err && <div className="login-err">{err}</div>}
        <button type="submit" disabled={busy || !email || !senha}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}

// ===== Root — gerencia a sessão e decide: Login vs App =====
function Root() {
  const [session, setSession] = React.useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [user, setUser] = React.useState(() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } });
  const [checking, setChecking] = React.useState(!!session);
  const [config, setConfig] = React.useState(null);   // { hiddenTabs: [...] } — vem do backend no me/login
  // Segundos decorridos na verificação — a tela ficava muda durante o cold start do Apps Script (até ~45s)
  // e parecia travada. Mostrar o contador + o motivo evita o "não está carregando".
  const [waited, setWaited] = React.useState(0);
  React.useEffect(() => {
    if (!checking) return;
    const t = setInterval(() => setWaited(w => w + 1), 1000);
    return () => clearInterval(t);
  }, [checking]);

  React.useEffect(() => {
    if (!session) { setChecking(false); return; }
    apiPost_({ action: 'me', session }).then(j => {
      if (j && j.ok) { setUser(j.user); localStorage.setItem(USER_KEY, JSON.stringify(j.user)); setConfig(j.config || { hiddenTabs: [] }); }
      else { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(USER_KEY); setSession(null); setUser(null); }
      setChecking(false);
    }).catch(() => setChecking(false));
  }, []);

  const onLogin = (tok, u, cfg) => {
    localStorage.setItem(SESSION_KEY, tok); localStorage.setItem(USER_KEY, JSON.stringify(u));
    setSession(tok); setUser(u); setConfig(cfg || { hiddenTabs: [] });
  };
  const onLogout = () => {
    const tok = localStorage.getItem(SESSION_KEY);
    if (tok) apiPost_({ action: 'logout', session: tok }).catch(() => {});
    localStorage.removeItem(SESSION_KEY); localStorage.removeItem(USER_KEY);
    setSession(null); setUser(null);
  };

  // Modo dev (sem ENDPOINT_URL) não exige login.
  if (ENDPOINT_URL && !session) return <Login onLogin={onLogin} />;
  if (ENDPOINT_URL && checking) return (
    <div className="login-wrap"><div className="login-card">
      <div className="login-sub">Verificando sessão…{waited > 2 ? ' (' + waited + 's)' : ''}</div>
      {waited > 6 && (
        <div className="login-sub" style={{ marginTop: '10px', fontSize: '12px', opacity: .75, lineHeight: 1.5 }}>
          O servidor está acordando — a primeira chamada do dia ao Apps Script leva até ~45s.
          Se passar disso, a tela volta pro login sozinha.
        </div>
      )}
    </div></div>
  );
  return <App user={user} onLogout={onLogout} config={config} />;
}

ReactDOM.createRoot(document.getElementById('app')).render(<Root />);
