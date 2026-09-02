// QA headless da aba Segurança depois da troca "acesso por pessoa" -> "PERFIL atribuído às pessoas".
// Mini-React com hooks + effects (padrão do benchd30test/mddtest): renderiza SegurancaTab de verdade,
// com apiPost_ stubado por um thenable SÍNCRONO, e assere a árvore + os POSTs que a aba dispara.
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
function eq(a, b, msg) { ok(a === b, msg + ' | esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }

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
    useMemo(f, deps) {
      const i = host.i++;
      const prev = host.hooks[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && deps.every((d, k) => d === prev.deps[k])) return prev.v;
      const v = f();
      host.hooks[i] = { v: v, deps: deps };
      return v;
    },
    useCallback(f, deps) {
      const i = host.i++;
      const prev = host.hooks[i];
      if (prev && prev.deps && deps && prev.deps.length === deps.length && deps.every((d, k) => d === prev.deps[k])) return prev.v;
      host.hooks[i] = { v: f, deps: deps };
      return f;
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

// ---------- carrega o app.jsx num contexto próprio ----------
const jsx = fs.readFileSync(path.join(__dirname, 'app.jsx'), 'utf8');
const { code } = Babel.transform(jsx, { presets: [['react', { runtime: 'classic' }]] });
console.log('babel ok — o app.jsx inteiro compila (syntax-check)');

const { host, React } = makeHost();
const store = {};
const sandbox = {
  React,
  ReactDOM: { createRoot: () => ({ render() {} }) },
  console,
  fetch: () => new Promise(() => {}),
  // O debounce NAO pode disparar dentro do proprio onChange: profRef so e atualizado por um useEffect,
  // ou seja DEPOIS do render. Enfileira e drena com flushTimers() no fim do loop de render.
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
vm.runInContext(code + '\n;globalThis.__Seg = SegurancaTab; globalThis.__CEN = CENARIOS; globalThis.__TABS = TABS;', ctx);

const Seg = ctx.__Seg, CENARIOS = ctx.__CEN, TABS = ctx.__TABS;
ok(typeof Seg === 'function', 'SegurancaTab existe');

// ---------- fixture ----------
const PROFILES = [
  { id: 'pA', name: 'Marketing', tabs: ['farol', 'ggr'], scen: ['bp'], users: 2 },
  { id: 'pB', name: 'Diretoria', tabs: null, scen: null, users: 1 },
];
const USERS = [
  { email: 'ana@x.com', name: 'Ana', admin: false, profile: 'pA', tabs: ['farol', 'ggr'], scen: ['bp'] },
  { email: 'bob@x.com', name: 'Bob', admin: false, profile: 'pA', tabs: ['farol', 'ggr'], scen: ['bp'] },
  { email: 'cleo@x.com', name: 'Cleo', admin: false, profile: 'pB', tabs: null, scen: null },
  { email: 'dan@x.com', name: 'Dan', admin: false, profile: null, tabs: null, scen: null },
  { email: 'luis@x.com', name: 'Luis', admin: true, profile: null, tabs: null, scen: null },
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

// driver: render -> effects -> re-render, até estabilizar
function render(props) {
  let tree = null;
  for (let pass_ = 0; pass_ < 12; pass_++) {
    host.startPass();
    tree = expand(Seg(props));
    const effs = host.effects.slice();
    effs.forEach(f => { try { f(); } catch (e) { console.log('  effect err: ' + e.message); } });
    if (!host.dirty) break;
  }
  flushTimers();   // debounce vence DEPOIS do render (como no browser)
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

// ============================================================
console.log('\n== 1. render base ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
let tree = render(PROPS);

const actions = posts.map(p => p.action);
ok(actions.indexOf('listUsers') >= 0, 'carrega usuários');
ok(actions.indexOf('listProfiles') >= 0, 'carrega perfis  <-- endpoint novo');
ok(actions.indexOf('accessLog') >= 0, 'carrega o tracker de acessos');

const txt = textOf(tree);
ok(/Perfis de acesso/.test(txt), 'seção "Perfis de acesso" existe');
ok(!/Acesso por aba · por usuário/.test(txt), 'seção antiga "Acesso por aba · por usuário" SUMIU');
ok(!/Acesso por cenário do Farol · por usuário/.test(txt), 'seção antiga "Acesso por cenário · por usuário" SUMIU');
ok(/Visibilidade das abas/.test(txt), 'a visibilidade GLOBAL das abas continua (é outra feature)');

// ---------- checkboxes de cada perfil ----------
const checks = [];
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'checkbox') checks.push(n); });
const selects = [];
walk(tree, n => { if (n.type === 'select') selects.push(n); });
const textInputs = [];
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'text') textInputs.push(n); });

// perfil Marketing: 2 abas de N marcadas; perfil Diretoria: todas marcadas
const nTabs = TABS.length, nScen = CENARIOS.length;
// checkboxes: [visib. global? não - vem depois] -> a ordem no DOM é: perfis (tabs+scen por perfil), form admin, visibilidade
const marcadosPerfilA = checks.slice(0, nTabs).filter(c => c.props.checked).length;
eq(marcadosPerfilA, 2, 'perfil restrito: só as 2 abas do perfil vêm marcadas');
const scenA = checks.slice(nTabs, nTabs + nScen).filter(c => c.props.checked).length;
eq(scenA, 1, 'perfil restrito: só 1 cenário marcado');
const offB = nTabs + nScen;
const marcadosPerfilB = checks.slice(offB, offB + nTabs).filter(c => c.props.checked).length;
eq(marcadosPerfilB, nTabs, 'perfil sem restrição (tabs=null): TUDO marcado');
const scenB = checks.slice(offB + nTabs, offB + nTabs + nScen).filter(c => c.props.checked).length;
eq(scenB, nScen, 'perfil sem restrição (scen=null): todos os cenários marcados');

// ---------- selects de atribuição ----------
// 1 no form de adicionar + 1 por usuário NÃO-admin (admin mostra "—")
eq(selects.length, 1 + USERS.filter(u => !u.admin).length, 'um select de perfil por pessoa não-admin (+1 no form)');
const selValues = selects.map(s => s.props.value);
ok(selValues.indexOf('pA') >= 0 && selValues.indexOf('pB') >= 0, 'os selects refletem o perfil atribuído de cada um');
const optNames = [];
walk(selects[1], n => { if (n.type === 'option') optNames.push(textOf(n)); });
ok(optNames.some(o => /Marketing/.test(o)) && optNames.some(o => /Diretoria/.test(o)), 'as opções listam os perfis existentes');
ok(optNames.some(o => /sem perfil/.test(o)), 'existe a opção "sem perfil (vê tudo)"');

// contagem de pessoas por perfil aparece
ok(/2\s+pessoas/.test(txt), 'mostra quantas pessoas usam o perfil Marketing');
ok(/1\s+pessoa\b/.test(txt), 'mostra "1 pessoa" no singular');

// ============================================================
console.log('\n== 2. desmarcar uma aba do perfil salva o PERFIL (não a pessoa) ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
posts = [];
// 1º checkbox de aba do perfil A = 'farol' (estava marcado) -> desmarca
checks.length = 0;
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'checkbox') checks.push(n); });
checks[0].props.onChange();
tree = render(PROPS);
const save = posts.find(p => p.action === 'saveProfile');
ok(!!save, 'dispara saveProfile');
ok(!posts.some(p => p.action === 'setUserTabs' || p.action === 'setUserScen'), 'NÃO dispara mais setUserTabs/setUserScen');
if (save) {
  eq(save.id, 'pA', 'salva no perfil certo');
  eq(save.name, 'Marketing', 'manda o nome junto (o save é do perfil inteiro)');
  eq(JSON.stringify(save.tabs), JSON.stringify(['ggr']), 'a aba desmarcada saiu da allowlist');
  eq(JSON.stringify(save.scen), JSON.stringify(['bp']), 'a allowlist de cenários foi preservada no mesmo POST');
}

console.log('\n== 3. desmarcar num perfil SEM restrição expande a partir de tudo ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
posts = [];
checks.length = 0;
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'checkbox') checks.push(n); });
checks[offB].props.onChange();   // 1ª aba do perfil B (tabs=null)
render(PROPS);
const saveB = posts.find(p => p.action === 'saveProfile');
ok(!!saveB, 'dispara saveProfile no perfil B');
if (saveB) {
  eq(saveB.id, 'pB', 'perfil certo');
  eq(saveB.tabs.length, nTabs - 1, 'null (todas) virou a lista completa MENOS a desmarcada');
  ok(saveB.tabs.indexOf(TABS[0].id) < 0, 'a aba desmarcada é a que saiu');
}

console.log('\n== 4. remarcar a última aba volta pra "sem restrição" (null) ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: [{ id: 'pC', name: 'Quase', tabs: TABS.map(t => t.id).slice(0, -1), scen: null, users: 0 }] });
tree = render(PROPS);
posts = [];
checks.length = 0;
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'checkbox') checks.push(n); });
checks[nTabs - 1].props.onChange();   // marca a última aba (a única desmarcada)
render(PROPS);
const saveC = posts.find(p => p.action === 'saveProfile');
ok(!!saveC, 'dispara saveProfile');
if (saveC) eq(JSON.stringify(saveC.tabs), '[]', 'tudo marcado -> manda [] (o backend traduz p/ null = sem restrição)');

console.log('\n== 5. atribuir perfil a uma pessoa ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
posts = [];
selects.length = 0;
walk(tree, n => { if (n.type === 'select') selects.push(n); });
selects[1].props.onChange({ target: { value: 'pB' } });
render(PROPS);
const asg = posts.find(p => p.action === 'setUserProfile');
ok(!!asg, 'dispara setUserProfile');
if (asg) { eq(asg.email, 'ana@x.com', 'no usuário certo'); eq(asg.profile, 'pB', 'com o perfil escolhido'); }
ok(posts.some(p => p.action === 'listProfiles'), 'recarrega os perfis (contagem de pessoas muda)');

console.log('\n== 6. criar e apagar perfil ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
textInputs.length = 0;
walk(tree, n => { if (n.type === 'input' && n.props && n.props.type === 'text') textInputs.push(n); });
// o 1º text input é o "nome do novo perfil"; os seguintes são os nomes dos perfis existentes
const novo = textInputs[0];
eq(novo.props.value, '', 'campo de novo perfil começa vazio');
novo.props.onChange({ target: { value: 'Comercial' } });
tree = render(PROPS);
posts = [];
let form = null;
walk(tree, n => { if (n.type === 'form' && n.props && n.props.onSubmit && !form) form = n; });
// o 1º form da página é o de criar perfil (a seção Perfis vem antes de "Adicionar acesso")
form.props.onSubmit({ preventDefault() {} });
render(PROPS);
const cre = posts.find(p => p.action === 'saveProfile');
ok(!!cre, 'criar perfil dispara saveProfile');
if (cre) { eq(cre.name, 'Comercial', 'com o nome digitado'); ok(!cre.id, 'sem id = criação'); eq(JSON.stringify(cre.tabs), '[]', 'nasce sem restrição'); }

host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
posts = [];
const btns = [];
walk(tree, n => { if (n.type === 'button' && /apagar perfil/.test(textOf(n))) btns.push(n); });
eq(btns.length, PROFILES.length, 'um botão de apagar por perfil');
btns[0].props.onClick();
render(PROPS);
const del = posts.find(p => p.action === 'deleteProfile');
ok(!!del, 'dispara deleteProfile');
if (del) eq(del.id, 'pA', 'no perfil certo');

console.log('\n== 7. o form de adicionar pessoa manda o perfil ==');
host.reset(); posts = [];
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
const forms = [];
walk(tree, n => { if (n.type === 'form' && n.props && n.props.onSubmit) forms.push(n); });
eq(forms.length, 2, 'dois forms: criar perfil e adicionar pessoa');
// preenche o form de pessoa
const emailIn = []; walk(forms[1], n => { if (n.type === 'input' && n.props.type === 'email') emailIn.push(n); });
const pwIn = []; walk(forms[1], n => { if (n.type === 'input' && n.props.type === 'password') pwIn.push(n); });
const selIn = []; walk(forms[1], n => { if (n.type === 'select') selIn.push(n); });
eq(selIn.length, 1, 'o form de pessoa tem o select de perfil');
emailIn[0].props.onChange({ target: { value: 'novo@x.com' } });
tree = render(PROPS);
let f2 = []; walk(tree, n => { if (n.type === 'form' && n.props && n.props.onSubmit) f2.push(n); });
let s2 = []; walk(f2[1], n => { if (n.type === 'select') s2.push(n); });
s2[0].props.onChange({ target: { value: 'pA' } });
tree = render(PROPS);
f2 = []; walk(tree, n => { if (n.type === 'form' && n.props && n.props.onSubmit) f2.push(n); });
let p2 = []; walk(f2[1], n => { if (n.type === 'input' && n.props.type === 'password') p2.push(n); });
p2[0].props.onChange({ target: { value: 's3nh4' } });
tree = render(PROPS);
posts = [];
f2 = []; walk(tree, n => { if (n.type === 'form' && n.props && n.props.onSubmit) f2.push(n); });
f2[1].props.onSubmit({ preventDefault() {} });
render(PROPS);
const au = posts.find(p => p.action === 'addUser');
ok(!!au, 'dispara addUser');
if (au) { eq(au.email, 'novo@x.com', 'e-mail'); eq(au.profile, 'pA', 'perfil escolhido vai junto  <-- campo novo'); }

console.log('\n== 8. tabela de usuários mostra o acesso efetivo ==');
host.reset();
installApi({ users: USERS, profiles: PROFILES });
tree = render(PROPS);
const rows = [];
walk(tree, n => { if (n.type === 'tr') rows.push(n); });
// o tracker de acessos tambem lista ana@x.com e vem ANTES: a linha de USUARIO e a que tem "remover"
const anaRow = rows.find(r => /ana@x\.com/.test(textOf(r)) && /remover/.test(textOf(r)));
ok(!!anaRow, 'linha da Ana existe');
ok(/2 de \d+/.test(textOf(anaRow)), 'coluna Abas mostra o efetivo do perfil (2 de N)');
const luisRow = rows.find(r => /luis@x\.com/.test(textOf(r)) && /você/.test(textOf(r)));
ok(/todas/.test(textOf(luisRow)), 'admin: todas');
let luisSel = []; walk(luisRow, n => { if (n.type === 'select') luisSel.push(n); });
eq(luisSel.length, 0, 'admin não tem select de perfil (perfil não se aplica a admin)');

console.log('\n' + (fail ? 'FALHAS: ' + fail + ' | ' : '') + pass + ' asserts OK');
process.exit(fail ? 1 : 0);
