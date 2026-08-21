// Card "Hold Bruto % (pré-FreeSpins)": GGR Bruto = ngr + freespin (ngr_total já subtraiu o freespin ganho).
// Roda o buildFarolMetrics_/buildFarolSpark_/buildFarolGroups_ REAIS do bundle.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('C:/Users/LuisFelipeMedeiros/.claude/repos/revops-cockpit-src/index.html','utf8');
let code='';html.replace(/<script[^>]*>([\s\S]*?)<\/script>/g,(_,s)=>{if(s.length>code.length)code=s;return _;});
const ctx={window:{},document:{},localStorage:{getItem:()=>null,setItem:()=>{}},console,
  React:{useState:(v)=>[v,()=>{}],useMemo:(f)=>f(),useEffect:()=>{},createElement:()=>null,Fragment:'F'}};
vm.createContext(ctx); try{vm.runInContext(code,ctx);}catch(e){}

let ok=0,fail=0;
const near=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<1e-9;
const t=(n,c)=>{console.log((c?'PASS':'FAIL')+' | '+n);c?ok++:fail++;};

// GGR líquido (ngr) = 1.000.000 · freespin = 250.000 · turnover = 25.000.000
//   hold líquido = 1,0M / 25M = 4,0%   ·   hold BRUTO = 1,25M / 25M = 5,0%
const M={ ggr:{act:1000000,m1:800000}, depTotal:{act:5000000,m1:4000000}, turnover:{act:25000000,m1:20000000},
          hold:{act:1000000/25000000,m1:800000/20000000,label:'Hold %'} };
const ggrCh=[{channel:'Meta',freespin:250000,bonus:200000,freespinLm:200000,bonusLm:160000}];
const f=ctx.buildFarolMetrics_(M,null,[],ggrCh,null,null,null);

t('card existe com o label do pedido', !!f.holdBruto && f.holdBruto.label==='Hold Bruto % (pré-FreeSpins)');
t('formato pct', f.holdBruto.fmt==='pct');
t('hold bruto = (ngr+fs)/turnover = 5,0%', near(f.holdBruto.act, 0.05));
t('REGRESSÃO: não repete o hold líquido 4,0% (o card seria inútil)', !near(f.holdBruto.act, 0.04));
t('REGRESSÃO: não divide por depósito (1,25M/5M = 25%)', !near(f.holdBruto.act, 0.25));
t('bruto > líquido por construção (freespin > 0)', f.holdBruto.act > M.hold.act);
t('o delta bruto−líquido = freespin/turnover = 1,0 p.p.', near(f.holdBruto.act - M.hold.act, 250000/25000000));
t('M-1 = (800k+200k)/20M = 5,0%', near(f.holdBruto.m1, 0.05));
t('MAIOR=melhor (é margem, não custo)', !f.holdBruto.lowerBetter);
t('sem meta: o plano não orça GGR bruto nem freespin', f.holdBruto.bp==null && f.holdBruto.pctBp==null);

// freespin ausente (canal sem freespin / backend antigo) → cai no hold líquido, não em null
const fNoFs=ctx.buildFarolMetrics_(M,null,[],[{channel:'Meta'}],null,null,null);
t('sem freespin → bruto == líquido (4,0%), não null', near(fNoFs.holdBruto.act, 0.04));
// sem turnover → sem card (não divide por zero)
const fNoTn=ctx.buildFarolMetrics_({ggr:{act:1e6},depTotal:{act:1e6},turnover:{act:null}},null,[],ggrCh,null,null,null);
t('turnover null → act null', fNoTn.holdBruto.act==null);
// hold NEGATIVO é informação legítima (mês ruim) — não pode ser engolido por guarda de positividade
const fNeg=ctx.buildFarolMetrics_({ggr:{act:-500000},depTotal:{act:1e6},turnover:{act:25e6}},null,[],
  [{channel:'Meta',freespin:100000}],null,null,null);
t('GGR bruto negativo APARECE (−1,6%), diferente dos cards de custo', near(fNeg.holdBruto.act, -400000/25000000));

// ---- sparkline -------------------------------------------------------------
const spark={weeks:['W1','W2'],perf:[],house:[
  {week:'W1',channel:'Meta',ngr:1000000,freespin:250000,bonus:200000,dep:5e6,turnover:25e6,qtdDep:10},
  {week:'W2',channel:'Meta',ngr:900000,freespin:100000,bonus:40000,dep:5e6,turnover:25e6,qtdDep:5}]};
const sp=ctx.buildFarolSpark_(spark,null);
t('spark W1 = 5,0% (mesma fórmula do card)', near(sp.holdBruto[0],0.05));
t('spark W2 = 4,0%', near(sp.holdBruto[1],0.04));
t('spark bruto ≥ spark hold líquido nas 2 semanas',
  sp.holdBruto[0]>sp.hold[0] && sp.holdBruto[1]>sp.hold[1]);

// ---- grupo -----------------------------------------------------------------
const MM={...M, ggrPerDep:{act:0.2,label:'GGR / Depósito',fmt:'pct'}, rollover:{act:5,label:'Rollover',fmt:'multiple'}};
const groups=ctx.buildFarolGroups_(MM,f,{from:'2026-08-01',to:'2026-08-20'},false,sp);
const g=groups.find(x=>x.title==='Volume & GGR');
const labels=(g.cards||[]).filter(Boolean).map(c=>c.label);
t('entra em Volume & GGR logo depois do Hold %: '+labels.join(' | '),
  labels.indexOf('Hold Bruto % (pré-FreeSpins)') === labels.indexOf('Hold % (House Edge)')+1);
const hb=(g.cards||[]).find(c=>c&&c.label==='Hold Bruto % (pré-FreeSpins)');
t('recebe a sparkline (card de fluxo)', Array.isArray(hb.spark) && hb.spark.length===2);
t('sem trend (card de razão)', hb.trend===undefined);

console.log('\n'+ok+' pass · '+fail+' fail');process.exit(fail?1:0);
