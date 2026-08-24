// Seção "Freespin por safra": freespin ÷ depósito por IDADE DE COORTE, share = composição do FREESPIN,
// ref = freespin ÷ GGR Bruto da safra. Roda o buildFarolMetrics_/buildFarolGroups_ REAIS do bundle.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('C:/Users/LuisFelipeMedeiros/.claude/repos/revops-cockpit-src/index.html','utf8');
let code='';html.replace(/<script[^>]*>([\s\S]*?)<\/script>/g,(_,s)=>{if(s.length>code.length)code=s;return _;});
const ctx={window:{},document:{},localStorage:{getItem:()=>null,setItem:()=>{}},console,
  React:{useState:(v)=>[v,()=>{}],useMemo:(f)=>f(),useEffect:()=>{},createElement:()=>null,Fragment:'F'}};
vm.createContext(ctx); try{vm.runInContext(code,ctx);}catch(e){}

let ok=0,fail=0;
const near=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<1e-9;
const t=(n,c)=>{console.log((c?'PASS':'FAIL')+' | '+n);c?ok++:fail++;};

const M={ ggr:{act:1000000,m1:800000}, depTotal:{act:5000000,m1:4000000}, turnover:{act:25000000,m1:20000000} };
const ggrCh=[{channel:'Meta',freespin:250000,bonus:200000,freespinLm:200000,bonusLm:160000}];

// ggrSafra: 2 canais por bucket pra provar que o front soma Σ/Σ (nunca média de %).
// Totais de freespin: M0 = 60k · M1 = 30k · M2 = 8k · M3+ = 2k  →  100k  (M0 = 60% do freespin)
const safra={
  m0:[{channel:'Meta',ggr:300000,ggrM1:280000,dep:2000000,depM1:1800000,turnover:1e7,turnoverM1:9e6,freespin:40000,freespinM1:36000},
      {channel:'Google',ggr:100000,ggrM1:90000,dep:1000000,depM1:900000,turnover:5e6,turnoverM1:45e5,freespin:20000,freespinM1:18000}],
  m1:[{channel:'Meta',ggr:200000,ggrM1:190000,dep:1000000,depM1:950000,turnover:6e6,turnoverM1:57e5,freespin:20000,freespinM1:19000},
      {channel:'Google',ggr:100000,ggrM1:95000,dep:500000,depM1:475000,turnover:3e6,turnoverM1:28e5,freespin:10000,freespinM1:9500}],
  m2:[{channel:'Meta',ggr:80000,ggrM1:78000,dep:400000,depM1:390000,turnover:2e6,turnoverM1:19e5,freespin:8000,freespinM1:7800}],
  m3plus:[{channel:'Meta',ggr:50000,ggrM1:49000,dep:200000,depM1:196000,turnover:1e6,turnoverM1:98e4,freespin:2000,freespinM1:1900}],
};
const f=ctx.buildFarolMetrics_(M,null,[],ggrCh,null,null,safra);

// ---- os 4 cards ------------------------------------------------------------
t('existem os 4 buckets', ['fsDep_m0','fsDep_m1','fsDep_m2','fsDep_m3plus'].every(k=>!!f[k]));
t('label = FreeSpins/Dep M0 (mesma família do GGR/Dep M0)', f.fsDep_m0.label==='FreeSpins/Dep M0');
// M0: (40k+20k) ÷ (2M+1M) = 60k/3M = 2,0%
t('M0 = Σfreespin ÷ Σdep = 60k/3M = 2,0% (Σ/Σ, não média de %)', near(f.fsDep_m0.act, 0.02));
// M1: 30k ÷ 1,5M = 2,0%  ·  M2: 8k/400k = 2,0%  ·  M3+: 2k/200k = 1,0%
t('M1 = 30k/1,5M = 2,0%', near(f.fsDep_m1.act, 0.02));
t('M2 = 8k/400k = 2,0%', near(f.fsDep_m2.act, 0.02));
t('M3+ = 2k/200k = 1,0%', near(f.fsDep_m3plus.act, 0.01));
// M-1 (mesma janela do mês anterior): M0 = 54k/2,7M = 2,0%
t('M-1 do M0 = 54k/2,7M = 2,0%', near(f.fsDep_m0.m1, 0.02));

// ---- custo, sem meta -------------------------------------------------------
t('menor=melhor (é custo)', f.fsDep_m0.lowerBetter===true);
t('SEM BP — a meta de 2% do plano é do BLEND da casa, não de uma safra',
  [f.fsDep_m0,f.fsDep_m1,f.fsDep_m2,f.fsDep_m3plus].every(c=>c.bp==null));
t('REGRESSÃO: não herdou o 0.02 do card da casa (FreeSpins/Dep tem, a safra não)',
  f.freespinDep.bp===0.02 && f.fsDep_m0.bp==null);

// ---- share = composição do FREESPIN ---------------------------------------
t('shareUnit = freespin (segue o NUMERADOR do card, não o GGR)', f.fsDep_m0.shareUnit==='freespin');
t('share M0 = 60k/100k = 60%', near(f.fsDep_m0.share, 0.6));
t('as 4 safras somam 100% do freespin',
  near(f.fsDep_m0.share+f.fsDep_m1.share+f.fsDep_m2.share+f.fsDep_m3plus.share, 1));
t('shareM1 M0 = 54k/92,2k', near(f.fsDep_m0.shareM1, 54000/92200));
t('REGRESSÃO: share ≠ composição do GGR (o card de GGR/Dep M0 usa essa)',
  !near(f.fsDep_m0.share, f.ggrDep_m0.share));

// ---- ref = GGR Bruto da safra ---------------------------------------------
// M0: 60k ÷ (400k + 60k) = 13,04%  — recompõe o freespin que o ngr_total já subtraiu
t('ref M0 = fs ÷ (GGR+fs) = 60k/460k', near(f.fsDep_m0.ref, 60000/460000));
t('REGRESSÃO: ref não é fs/GGR líquido = 60k/400k (infla)', !near(f.fsDep_m0.ref, 0.15));
t('refLabel = do GGR Bruto', f.fsDep_m0.refLabel==='do GGR Bruto');
t('refM1 M0 = 54k/(370k+54k)', near(f.fsDep_m0.refM1, 54000/424000));

// ---- backend velho (sem a coluna freespin no ggrSafra) --------------------
const semFs={m0:[{channel:'Meta',ggr:300000,ggrM1:280000,dep:2000000,depM1:1800000,turnover:1e7,turnoverM1:9e6}]};
const fOld=ctx.buildFarolMetrics_(M,null,[],ggrCh,null,null,semFs);
t('backend < v71 → card fica null (freespin AUSENTE ≠ freespin ZERO)', fOld.fsDep_m0.act==null);
const gOld=ctx.buildFarolGroups_({},fOld,{from:'2026-08-01',to:'2026-08-19'},false).find(x=>x.title==='Freespin por safra');
t('backend < v71 → seção inteira some (sem título órfão)', !gOld);

// ---- grupo na tela ---------------------------------------------------------
const groups=ctx.buildFarolGroups_({},f,{from:'2026-08-01',to:'2026-08-19'},false);
const titles=groups.map(g=>g.title);
const g=groups.find(x=>x.title==='Freespin por safra');
t('seção "Freespin por safra" existe', !!g);
t('4 cards na ordem M0→M1→M2→M3+: '+(g.cards||[]).map(c=>c.label).join(' | '),
  (g.cards||[]).map(c=>c.label).join('|')==='FreeSpins/Dep M0|FreeSpins/Dep M1|FreeSpins/Dep M2|FreeSpins/Dep M3+');
t('fica LOGO DEPOIS de "Rollover por safra"',
  titles.indexOf('Freespin por safra')===titles.indexOf('Rollover por safra')+1);
t('REGRESSÃO: as seções de cima não mudaram',
  ['GGR por safra','Hold por safra','Rollover por safra'].every(x=>titles.indexOf(x)>=0));

// ---- export do Excel -------------------------------------------------------
const ex=ctx.buildFarolExportGroups_({},f,null,[],null,{from:'2026-08-01',to:'2026-08-19'},false);
const ge=ex.find(x=>x.title==='Freespin por safra');
t('export .xlsx leva a seção com os 4 cards', !!ge && ge.cards.length===4);

console.log('\n'+ok+' pass · '+fail+' fail');process.exit(fail?1:0);
