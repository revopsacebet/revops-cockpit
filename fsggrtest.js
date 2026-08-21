// Cards FreeSpins/GGR e Bonificação/GGR: freespin é PRE-GGR (÷ GGR Bruto = ngr+freespin),
// bonificação é direto ÷ GGR. Roda o buildFarolMetrics_/buildFarolSpark_/buildFarolGroups_ REAIS do bundle.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('C:/Users/LuisFelipeMedeiros/.claude/repos/revops-cockpit-src/index.html','utf8');
let code='';html.replace(/<script[^>]*>([\s\S]*?)<\/script>/g,(_,s)=>{if(s.length>code.length)code=s;return _;});
const ctx={window:{},document:{},localStorage:{getItem:()=>null,setItem:()=>{}},console,
  React:{useState:(v)=>[v,()=>{}],useMemo:(f)=>f(),useEffect:()=>{},createElement:()=>null,Fragment:'F'}};
vm.createContext(ctx); try{vm.runInContext(code,ctx);}catch(e){}

let ok=0,fail=0;
const near=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<1e-9;
const t=(n,c)=>{console.log((c?'PASS':'FAIL')+' | '+n);c?ok++:fail++;};

// ---- cards -----------------------------------------------------------------
// GGR (ngr) = 1.000.000 · freespin = 250.000 · bonus = 200.000
//   GGR Bruto = 1.250.000 → FreeSpins/GGR Bruto = 20% (NÃO 25%, que é o erro de dividir pelo ngr líquido)
//   Bonificação/GGR = 20%
const M={ ggr:{act:1000000,m1:800000}, depTotal:{act:5000000,m1:4000000}, turnover:{act:25000000,m1:20000000} };
const ggrCh=[{channel:'Meta',freespin:250000,bonus:200000,freespinLm:200000,bonusLm:160000}];
const f=ctx.buildFarolMetrics_(M,null,[],ggrCh,null,null,null);
t('card FreeSpins / GGR Bruto existe', !!f.freespinGgr && f.freespinGgr.label==='FreeSpins / GGR Bruto');
t('card Bonificação / GGR existe', !!f.bonusGgr && f.bonusGgr.label==='Bonificação / GGR');
t('FreeSpins/GGR = fs/(ngr+fs) = 20% (pre-GGR)', near(f.freespinGgr.act, 0.2));
t('REGRESSÃO: não é fs/ngr = 25% (dividir pelo GGR já líquido de freespin infla)', !near(f.freespinGgr.act, 0.25));
t('Bonificação/GGR = bn/ngr = 20% (sem recompor)', near(f.bonusGgr.act, 0.2));
t('bate com o `ref` do card /Dep (mesma conta, fonte única)',
  near(f.freespinGgr.act, f.freespinDep.ref) && near(f.bonusGgr.act, f.bonusDep.ref));
t('M-1 FreeSpins = 200k/(800k+200k) = 20%', near(f.freespinGgr.m1, 0.2));
t('M-1 Bonificação = 160k/800k = 20%', near(f.bonusGgr.m1, 0.2));
t('menor=melhor (é custo)', f.freespinGgr.lowerBetter===true && f.bonusGgr.lowerBetter===true);
t('sem meta (o plano declara % sobre depósito, não sobre GGR)', f.freespinGgr.bp==null && f.bonusGgr.bp==null);

// guarda de GGR ≤ 0: razão inverteria de sinal e leria como "melhorou"
const fNeg=ctx.buildFarolMetrics_({ggr:{act:-500000,m1:null},depTotal:{act:1e6},turnover:{act:5e6}},null,[],
  [{channel:'Meta',freespin:100000,bonus:80000}],null,null,null);
t('GGR ≤ 0 → não mostra nada (não inverte o sinal)', fNeg.freespinGgr.act==null && fNeg.bonusGgr.act==null);

// ---- sparkline -------------------------------------------------------------
const spark={weeks:['W1','W2'],perf:[],house:[
  {week:'W1',channel:'Meta',ngr:1000000,freespin:250000,bonus:200000,dep:5e6,turnover:25e6,qtdDep:10},
  {week:'W2',channel:'Meta',ngr:-100000,freespin:50000,bonus:40000,dep:1e6,turnover:5e6,qtdDep:5}]};
const sp=ctx.buildFarolSpark_(spark,null);
t('spark freespinGgr W1 = 20% (mesma fórmula do card)', near(sp.freespinGgr[0],0.2));
t('spark bonusGgr W1 = 20%', near(sp.bonusGgr[0],0.2));
t('spark: semana com GGR bruto ≤ 0 vira null (W2: -100k+50k = -50k)', sp.freespinGgr[1]===null && sp.bonusGgr[1]===null);

// ---- grupo -----------------------------------------------------------------
const groups=ctx.buildFarolGroups_({},f,{from:'2026-08-01',to:'2026-08-19'},false,sp);
const g=groups.find(x=>x.title==='FreeSpins & Bonificação');
const labels=(g.cards||[]).filter(Boolean).map(c=>c.label);
t('seção tem os 6 cards na ordem Dep → Turnover → GGR: '+labels.join(' | '),
  labels.join('|')==='FreeSpins / Dep|Bonificação / Dep|FreeSpins / Turnover|Bonificação / Turnover|FreeSpins / GGR Bruto|Bonificação / GGR');
const fg=(g.cards||[]).find(c=>c&&c.label==='FreeSpins / GGR Bruto');
t('card de GGR recebe a sparkline', Array.isArray(fg.spark) && fg.spark.length===2);

console.log('\n'+ok+' pass · '+fail+' fail');process.exit(fail?1:0);
