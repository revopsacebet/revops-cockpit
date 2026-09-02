// QA headless da aba Segurança + do gate de SEÇÕES do Farol.
//
// Modelo: o acesso deixou de ser marcado por pessoa e virou PERFIL (abas + cenários do Farol +
// seções do Farol) atribuído às pessoas. Este teste renderiza a SegurancaTab de verdade num
// mini-React com hooks + effects, com `apiPost_` stubado por um thenable SÍNCRONO, e assere a
// árvore + os POSTs que a aba dispara. Mais os gates puros (allowedSecoes_/filterFarolSecoes_).
//
// Rodar:  node segtest.js        (dentro de repos/revops-cockpit-src)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Babel = require('@babel/standalone');

let pass = 0, fail = 0;
const timers = new Map(); let timerSeq = 0;
function flushTimers() { const q = Array.from(timers.values()); timers.clear(); q.forEach(f => f()); }
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  FALHOU: ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' | esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }

// ---------- mini-React com fila de hooks, effects e re-render ----------
function makeHost() {
  const host = { hooks: [], i: 0, dirty: false, effects: [] };
  host.reset = () => { host.hooks = []; host.i = 0; host.dirty = false; host.effects = []; };
  host.startPass = () => { host.i = 0; host.dirty = false; host.effects = []; };
  const React = {
    Fragment: 'FRAGMENT',
    createElement: (type, props, ...kids) => {
      const p = Object.assign({}, props);
      if (kids.length) p.children = kids.length === 1 ? kids[0] : kids;
      return { type, props: p };
    },
    useState(init) {
      const i = host.i++;
      if (host.hooks.length <= i) host.hooks[i] = { v: typeof init === 'function' ? init() : init };
      const slot = host.hooks[i];
      return [slot.v, (nv) => { const n = typeof nv === 'function' ? nv(slot.v) : nv; if (n !== slot.v) { slot.v = n; host.dirty = true; } }];
    },
    useRef(init) { const i = host.i++; if (host.hooks.length <= i) host.hooks[i] = { current: init }; return host.hooks[i]; },
    // ⚠️ useMemo/useCallback TÊM que memoizar pelas deps. Com `f => f` o `load`/`loadProfiles` viram
    // funções novas a cada passe, o useEffect([load, loadProfiles]) reroda e o listProfiles do fixture
    // SOBRESCREVE a mudança otimista antes do debounce salvar — o assert passa lendo o fixture.
    useMemo(f, deps) {
      const i = host.i++;
      const prev = host.hooks[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && deps.every((d, k) => d === prev.deps[k])) return prev.v;
      const v = f(); host.hooks[i] = { v: v, deps: deps }; return v;
    },
    useCallback(f, deps) {
      const i = host.i++;
      const prev = host.hooks[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && deps.every((d, k) => d === prev.deps[k])) return prev.v;
      host.hooks[i] = { v: f, deps: deps }; return f;
    },
    useEffect(f, deps) {
      const i = host.i++;
      const prev = host.hooks[i];
      const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, k) => d !== prev.deps[k]);
      host.hooks[i] = { deps: deps };
      if (changed) host.effects.push(f);
    },
  };
  return { host, React };
}
// thenable SÍNCRONO que achata promise aninhada (padrão .then().then())
function thenable(v) { return { then(f) { const o = f(v); return (o && o.then) ? o : thenable(o); }, catch() { return this; } }; }

function walk(node, visit) {
  if (node == null || node === false) return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  if (typeof node !== 'object') return;
  visit(node);
  // ⚠️ NÃO descer em kids E children: o createElement já jogou os kids dentro de props.children
  if (node.props && node.props.children !== undefined) walk(node.props.children, visit);
}
function findAll(root, pred) { const out = []; walk(root, n => { if (pred(n)) out.push(n); }); return out; }
function textOf(node) {
  const out = [];
  (function rec(n) {
    if (n == null || n === false) return;
    if (Array.isArray(n)) { n.forEach(rec); return; }
    if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return; }
    if (typeof n === 'object' && n.props) rec(n.props.children);
  })(node);
  return out.join(' ');
}
// Checkboxes com o TEXTO do <label> em volta — bem mais robusto que índice posicional (foi o que
// quebrou 3 asserts quando o card de perfil ganhou o 3º bloco, sem nenhum bug real).
function checksOf(root) {
  return findAll(root, n => n.type === 'label')
    .map(l => { const i = findAll(l, m => m.type === 'input' && m.props && m.props.type === 'checkbox'); return i.length === 1 ? { input: i[0], text: textOf(l).replace(/\s+/g, ' ').trim() } : null; })
    .filter(Boolean);
}
// Card de um perfil = a div cujo `key` é o id do perfil (o stub não retira `key` das props).
function cardOf(tree, pid) { return findAll(tree, n => n.type === 'div' && n.props && n.props.key === pid)[0]; }
function byText(list, re) { return list.filter(c => re.test(c.text)); }

// ---------- carrega o app.jsx num contexto próprio ----------
const SRC = fs.readFileSync(path.join(__dirname, 'app.jsx'), 'utf8');
const { code } = Babel.transform(SRC, { presets: [['react', { runtime: 'classic' }]] });
console.log('babel ok — o app.jsx inteiro compila (syntax-check)');

const { host, React } = makeHost();
const store = {};
const sandbox = {
  React,
  ReactDOM: { createRoot: () => ({ render() {} }) },
  console,
  fetch: () => new Promise(() => {}),
  // O debounce NÃO pode disparar dentro do próprio onChange: o profRef só é atualizado por um
  // useEffect, ou seja DEPOIS do render. Enfileira e drena com flushTimers() no fim do loop.
  setTimeout: (f) => { const id = ++timerSeq; timers.set(id, f); return id; },
  clearTimeout: (id) => { timers.delete(id); },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: new Proxy({}, { get: () => () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} }) }),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  navigator: { userAgent: 'node' },
  location: { href: 'http://x/', search: '' },
  alert: () => {},
  AbortController: function () { this.signal = null; this.abort = () => {}; },
  Math, JSON, Date, String, Number, Array, Object, Boolean, RegExp, Error, isNaN, parseFloat, parseInt, encodeURIComponent, decodeURIComponent, Promise, Intl, Map, Set, URL,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.confirm = () => true;
const ctx = vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__Seg = SegurancaTab; globalThis.__CEN = CENARIOS; globalThis.__TABS = TABS; globalThis.__SEC = FAROL_SECOES;', ctx);

const Seg = ctx.__Seg, CENARIOS = ctx.__CEN, TABS = ctx.__TABS, SECOES = ctx.__SEC;
ok(typeof Seg === 'function', 'SegurancaTab existe');
ok(Array.isArray(SECOES) && SECOES.length > 0, 'catálogo FAROL_SECOES existe');

// ============================================================
console.log('== 0. o catálogo de seções bate com o buildFarolGroups_ ==');
{
  // Checagem ESTÁTICA no fonte: renderizar o Farol inteiro exigiria um payload gigante, e o que
  // pode derivar aqui é textual (alguém adiciona uma seção e esquece do catálogo → ela fica
  // invisível pro admin; ou tira uma e sobra checkbox morto).
  const i0 = SRC.indexOf('function buildFarolGroups_');
  const i1 = SRC.indexOf('\nfunction ', i0 + 10);
  ok(i0 > 0 && i1 > i0, 'achei o corpo do buildFarolGroups_');
  const corpo = SRC.slice(i0, i1);
  const noCodigo = [];
  corpo.replace(/\{ id: '([a-z0-9]+)', title: '([^']*)'/g, (m, id, title) => { noCodigo.push({ id, title }); return m; });
  const semId = (corpo.match(/^\s*\{ title: '/gm) || []).length;
  eq(semId, 0, 'toda seção do Farol declara um id (nenhuma ficou só com title)');
  const idsCat = SECOES.map(x => x.id).sort();
  const idsCod = noCodigo.map(x => x.id).sort();
  eq(idsCod, idsCat, 'os ids do buildFarolGroups_ e do FAROL_SECOES são exatamente os mesmos');
  const labelById = {}; SECOES.forEach(x => { labelById[x.id] = x.label; });
  const divergem = noCodigo.filter(x => labelById[x.id] !== x.title).map(x => x.id + ': "' + x.title + '" != "' + labelById[x.id] + '"');
  eq(divergem, [], 'o label do catálogo é idêntico ao title da seção (o export do Excel casa por título)');
}

console.log('\n== 0a. o gate está LIGADO (o Farol e o Excel usam o filtro) ==');
{
  // Assert de FIAÇÃO: as funções puras acima podem estar todas certas e ninguém chamar. Estático
  // porque renderizar a TabFarol inteira exigiria o payload completo — e o que quebra aqui é a
  // chamada sumir num refactor, não a lógica.
  ok(/const groups = filterFarolSecoes_\(buildFarolGroups_\(/.test(SRC), 'a TabFarol filtra os grupos pelas seções do perfil');
  ok(/filterFarolSecoes_\(buildFarolExportGroups_\(/.test(SRC), 'o export de Excel filtra pelas MESMAS seções (senão o que some da tela sai no arquivo)');
  ok(/secAllow=\{allowedSecoes_\(user\)\}/.test(SRC), 'o botão de Excel recebe a allowlist do usuário');
  ok(/escopo, secAllow, onProgress/.test(SRC), 'e repassa pro exportFarolRange_');
}

console.log('\n== 0b. gates puros de seção ==');
{
  const allowedSecoes_ = ctx.allowedSecoes_, filterFarolSecoes_ = ctx.filterFarolSecoes_;
  eq(allowedSecoes_({ admin: true, sections: ['retencao'] }), null, 'admin ignora a allowlist de seções');
  eq(allowedSecoes_({ admin: false, sections: [] }), null, 'lista vazia = sem restrição');
  eq(allowedSecoes_({ admin: false, sections: null }), null, 'null = sem restrição');
  eq(allowedSecoes_({ admin: false, sections: ['retencao'] }), ['retencao'], 'lista = a própria lista');

  const G = [{ id: 'aquisicao', title: 'Aquisição' }, { id: 'retencao', title: 'Retenção' }, { id: 'volumeggr', title: 'Volume & GGR' }];
  eq(filterFarolSecoes_(G, null).length, 3, 'sem restrição não filtra nada');
  eq(filterFarolSecoes_(G, ['retencao', 'volumeggr']).map(g => g.id), ['retencao', 'volumeggr'], 'CRM sem Aquisição: a seção some');
  // o export monta a própria lista de grupos, SEM id — casa por título
  const GX = [{ title: 'Aquisição' }, { title: 'Retenção' }];
  eq(filterFarolSecoes_(GX, ['retencao']).map(g => g.title), ['Retenção'], 'grupo sem id casa pelo título (caminho do export de Excel)');
  // fail-CLOSED: allowlist que não casa com nada devolve vazio, NUNCA o Farol inteiro
  eq(filterFarolSecoes_(G, ['secao_que_sumiu']).length, 0, 'allowlist que não casa = vazio (não vaza o Farol inteiro)');
}

// ---------- fixture ----------
const PROFILES = [
  { id: 'pA', name: 'Marketing', tabs: ['farol', 'ggr'], scen: ['bp'], sections: ['aquisicao', 'depm0'], users: 2 },
  { id: 'pB', name: 'Diretoria', tabs: null, scen: null, sections: null, users: 1 },
];
const USERS = [
  { email: 'ana@x.com', name: 'Ana', admin: false, profile: 'pA', tabs: ['farol', 'ggr'], scen: ['bp'], sections: ['aquisicao', 'depm0'] },
  { email: 'bob@x.com', name: 'Bob', admin: false, profile: 'pA', tabs: ['farol', 'ggr'], scen: ['bp'], sections: ['aquisicao', 'depm0'] },
  { email: 'cleo@x.com', name: 'Cleo', admin: false, profile: 'pB', tabs: null, scen: null, sections: null },
  { email: 'dan@x.com', name: 'Dan', admin: false, profile: null, tabs: null, scen: null, sections: null },
  { email: 'luis@x.com', name: 'Luis', admin: true, profile: null, tabs: null, scen: null, sections: null },
];
let posts = [];
function installApi(state) {
  ctx.apiPost_ = (p) => {
    posts.push(p);
    if (p.action === 'listUsers') return thenable({ ok: true, users: JSON.parse(JSON.stringify(state.users)) });
    if (p.action === 'listProfiles') return thenable({ ok: true, profiles: JSON.parse(JSON.stringify(state.profiles)) });
    if (p.action === 'accessLog') return thenable({ ok: true, access: { windowDays: 30, users: [{ email: 'ana@x.com', name: 'Ana', admin: false, known: true, lastSeen: Date.now(), days: [], activeDays: 3, hits: 9 }] } });
    if (p.action === 'saveProfile' || p.action === 'deleteProfile') return thenable({ ok: true, profiles: JSON.parse(JSON.stringify(state.profiles)) });
    return thenable({ ok: true });
  };
}
const PROPS = { user: { email: 'luis@x.com', admin: true }, allTabs: TABS, hiddenTabs: [], onSetTabHidden: () => {} };

// driver: render -> effects -> re-render, até estabilizar; timers no fim (ordem do browser)
function render(props) {
  let tree = null;
  for (let p = 0; p < 12; p++) {
    host.startPass();
    tree = expand(Seg(props));
    host.effects.slice().forEach(f => { try { f(); } catch (e) { console.log('  effect err: ' + e.message); } });
    if (!host.dirty) break;
  }
  flushTimers();
  return tree;
}
// ⚠️ expandir componente-função DENTRO do render (nunca num walker separado): senão a fila de hooks recomeça
function expand(node) {
  if (node == null || node === false) return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node !== 'object') return node;
  let n = node;
  if (typeof n.type === 'function') n = expand(n.type(n.props));
  if (n && n.props && n.props.children !== undefined) n = Object.assign({}, n, { props: Object.assign({}, n.props, { children: expand(n.props.children) }) });
  return n;
}
function boot() { host.reset(); posts = []; installApi({ users: USERS, profiles: PROFILES }); const t = render(PROPS); posts = []; return t; }

// ============================================================
console.log('\n== 1. render base ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
let tree = render(PROPS);

const actions = posts.map(p => p.action);
ok(actions.indexOf('listUsers') >= 0, 'carrega usuários');
ok(actions.indexOf('listProfiles') >= 0, 'carrega perfis');
ok(actions.indexOf('accessLog') >= 0, 'carrega o tracker de acessos');

const txt = textOf(tree);
ok(/Perfis de acesso/.test(txt), 'seção "Perfis de acesso" existe');
ok(!/Acesso por aba · por usuário/.test(txt), 'seção antiga "Acesso por aba · por usuário" SUMIU');
ok(!/Acesso por cenário do Farol · por usuário/.test(txt), 'seção antiga "…por cenário · por usuário" SUMIU');
ok(/Visibilidade das abas/.test(txt), 'a visibilidade GLOBAL das abas continua (é outra feature)');
ok(/Seções do Farol/.test(txt), 'bloco "Seções do Farol" existe no card do perfil');

const nTabs = TABS.length, nScen = CENARIOS.length, nSec = SECOES.length;
{
  const cA = cardOf(tree, 'pA'), cB = cardOf(tree, 'pB');
  ok(!!cA && !!cB, 'os dois cards de perfil renderizam');
  const kA = checksOf(cA), kB = checksOf(cB);
  eq(kA.length, nTabs + nScen + nSec, 'card do perfil tem os três blocos de checkbox');
  eq(kA.filter(c => c.input.props.checked).length, 2 + 1 + 2, 'perfil restrito: 2 abas + 1 cenário + 2 seções marcados');
  eq(kB.filter(c => c.input.props.checked).length, nTabs + nScen + nSec, 'perfil sem restrição: tudo marcado');
  // as seções aparecem com o rótulo do catálogo
  ok(byText(kA, /^Aquisição$/).length === 1, 'existe o checkbox da seção Aquisição');
  ok(byText(kA, /^Aquisição$/)[0].input.props.checked, 'e ele vem marcado (está na allowlist do perfil)');
  ok(byText(kA, /^Retenção$/).length === 1 && !byText(kA, /^Retenção$/)[0].input.props.checked, 'seção fora da allowlist vem desmarcada');
  ok(/2 de \d+ seções do Farol/.test(textOf(cA)), 'o resumo do card conta as seções');
  ok(/todas as seções do Farol/.test(textOf(cB)), 'perfil sem restrição diz "todas as seções"');
}

console.log('\n== 2. desmarcar uma aba do perfil salva o PERFIL (não a pessoa) ==');
{
  tree = boot();
  byText(checksOf(cardOf(tree, 'pA')), /^Farol$/)[0].input.props.onChange();
  render(PROPS);
  const save = posts.find(p => p.action === 'saveProfile');
  ok(!!save, 'dispara saveProfile');
  ok(!posts.some(p => p.action === 'setUserTabs' || p.action === 'setUserScen'), 'NÃO dispara mais setUserTabs/setUserScen');
  eq(save.id, 'pA', 'salva no perfil certo');
  eq(save.name, 'Marketing', 'manda o nome junto (o save é do perfil inteiro)');
  eq(save.tabs, ['ggr'], 'a aba desmarcada saiu da allowlist');
  eq(save.scen, ['bp'], 'a allowlist de cenários foi preservada no mesmo POST');
  eq(save.sections, ['aquisicao', 'depm0'], 'a allowlist de seções foi preservada no mesmo POST');
}

console.log('\n== 3. desmarcar seção num perfil SEM restrição expande a partir de tudo ==');
{
  tree = boot();
  byText(checksOf(cardOf(tree, 'pB')), /^Aquisição$/)[0].input.props.onChange();
  render(PROPS);
  const save = posts.find(p => p.action === 'saveProfile');
  ok(!!save, 'dispara saveProfile no perfil B');
  eq(save.id, 'pB', 'perfil certo');
  eq((save.sections || []).length, nSec - 1, 'null (todas) virou a lista completa MENOS a desmarcada');
  ok((save.sections || []).indexOf('aquisicao') < 0, 'a seção desmarcada é a que saiu');
  eq(save.tabs, [], 'as abas continuam sem restrição');
}

console.log('\n== 4. remarcar a última seção volta pra "sem restrição" (null) ==');
{
  const quase = SECOES.map(x => x.id).slice(0, -1);
  host.reset(); posts = [];
  installApi({ users: USERS, profiles: [{ id: 'pC', name: 'Quase', tabs: null, scen: null, sections: quase, users: 0 }] });
  tree = render(PROPS); posts = [];
  const ult = SECOES[SECOES.length - 1];
  byText(checksOf(cardOf(tree, 'pC')), new RegExp('^' + ult.label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '$'))[0].input.props.onChange();
  render(PROPS);
  const save = posts.find(p => p.action === 'saveProfile');
  ok(!!save, 'dispara saveProfile');
  eq(save.sections, [], 'tudo marcado -> manda [] (o backend traduz p/ null = sem restrição)');
}

console.log('\n== 5. o bloco de seções só aparece se o perfil enxerga o Farol ==');
{
  host.reset(); posts = [];
  installApi({ users: USERS, profiles: [{ id: 'pD', name: 'Só GGR', tabs: ['ggr'], scen: null, sections: null, users: 0 }] });
  tree = render(PROPS);
  const c = cardOf(tree, 'pD');
  ok(!/Seções do Farol/.test(textOf(c)), 'perfil sem a aba Farol não mostra o bloco de seções');
  eq(checksOf(c).length, nTabs + nScen, 'e o card fica só com os dois blocos');
}

console.log('\n== 6. atribuir perfil a uma pessoa ==');
{
  tree = boot();
  const sel = findAll(tree, n => n.type === 'select');
  sel[1].props.onChange({ target: { value: 'pB' } });
  render(PROPS);
  const asg = posts.find(p => p.action === 'setUserProfile');
  ok(!!asg, 'dispara setUserProfile');
  eq(asg.email, 'ana@x.com', 'no usuário certo');
  eq(asg.profile, 'pB', 'com o perfil escolhido');
  ok(posts.some(p => p.action === 'listProfiles'), 'recarrega os perfis (contagem de pessoas muda)');
}

console.log('\n== 7. criar e apagar perfil ==');
{
  host.reset(); posts = [];
  installApi({ users: USERS, profiles: PROFILES });
  tree = render(PROPS);
  const txtIn = findAll(tree, n => n.type === 'input' && n.props && n.props.type === 'text');
  eq(txtIn[0].props.value, '', 'campo de novo perfil começa vazio');
  txtIn[0].props.onChange({ target: { value: 'CRM' } });
  tree = render(PROPS); posts = [];
  findAll(tree, n => n.type === 'form' && n.props && n.props.onSubmit)[0].props.onSubmit({ preventDefault() {} });
  render(PROPS);
  const cre = posts.find(p => p.action === 'saveProfile');
  ok(!!cre, 'criar perfil dispara saveProfile');
  eq(cre.name, 'CRM', 'com o nome digitado');
  ok(!cre.id, 'sem id = criação');
  eq(cre.sections, [], 'nasce sem restrição de seção');

  tree = boot();
  const btns = findAll(tree, n => n.type === 'button' && /apagar perfil/.test(textOf(n)));
  eq(btns.length, PROFILES.length, 'um botão de apagar por perfil');
  btns[0].props.onClick();
  render(PROPS);
  const del = posts.find(p => p.action === 'deleteProfile');
  ok(!!del, 'dispara deleteProfile');
  eq(del.id, 'pA', 'no perfil certo');
}

console.log('\n== 8. o form de adicionar pessoa manda o perfil ==');
{
  host.reset(); posts = [];
  installApi({ users: USERS, profiles: PROFILES });
  tree = render(PROPS);
  const forms = findAll(tree, n => n.type === 'form' && n.props && n.props.onSubmit);
  eq(forms.length, 2, 'dois forms: criar perfil e adicionar pessoa');
  eq(findAll(forms[1], n => n.type === 'select').length, 1, 'o form de pessoa tem o select de perfil');
  const set = (pred, val) => {
    const f = findAll(render(PROPS), n => n.type === 'form' && n.props && n.props.onSubmit)[1];
    findAll(f, pred)[0].props.onChange({ target: { value: val } });
  };
  set(n => n.type === 'input' && n.props.type === 'email', 'novo@x.com');
  set(n => n.type === 'select', 'pA');
  set(n => n.type === 'input' && n.props.type === 'password', 's3nh4');
  tree = render(PROPS); posts = [];
  findAll(tree, n => n.type === 'form' && n.props && n.props.onSubmit)[1].props.onSubmit({ preventDefault() {} });
  render(PROPS);
  const au = posts.find(p => p.action === 'addUser');
  ok(!!au, 'dispara addUser');
  eq(au.email, 'novo@x.com', 'e-mail');
  eq(au.profile, 'pA', 'perfil escolhido vai junto');
}

console.log('\n== 9. tabela de usuários mostra o acesso efetivo ==');
{
  host.reset();
  installApi({ users: USERS, profiles: PROFILES });
  tree = render(PROPS);
  const rows = findAll(tree, n => n.type === 'tr');
  // o tracker de acessos também lista ana@x.com e vem ANTES: a linha de USUÁRIO é a que tem "remover"
  const ana = rows.find(r => /ana@x\.com/.test(textOf(r)) && /remover/.test(textOf(r)));
  ok(!!ana, 'linha da Ana existe');
  ok(/2 de \d+/.test(textOf(ana)), 'coluna Abas mostra o efetivo do perfil (2 de N)');
  const luis = rows.find(r => /luis@x\.com/.test(textOf(r)) && /você/.test(textOf(r)));
  ok(/todas/.test(textOf(luis)), 'admin: todas');
  eq(findAll(luis, n => n.type === 'select').length, 0, 'admin não tem select de perfil');
}

console.log('\n' + (fail ? 'FALHAS: ' + fail + ' | ' : '') + pass + ' asserts OK');
process.exit(fail ? 1 : 0);
