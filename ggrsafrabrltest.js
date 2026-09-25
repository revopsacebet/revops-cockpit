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
t('4 cards GGR por safra', ['ggrSafra_m0','ggrSafra_m1','ggrSafra_m2','ggrSafra_m3plus'].every(k=>!!f[k]));
t('GGR M0 = 300k+100k = 400k', near(f.ggrSafra_m0.act,400000));
t('GGR M0 m1 = 370k', near(f.ggrSafra_m0.m1,370000));
t('GGR M1 = 300k', near(f.ggrSafra_m1.act,300000));
t('share M0 = 400k/830k', near(f.ggrSafra_m0.share,400000/830000));
t('fmt brl', f.ggrSafra_m0.fmt==='brl');
t('Não-M0 = GGR casa 1M − M0 400k = 600k', near(f.ggrSafra_notm0.act,600000));
t('Não-M0 m1 = 800k − 370k = 430k', near(f.ggrSafra_notm0.m1,430000));
t('Não-M0 sem Orçado', f.ggrSafra_notm0.bp==null);
const G=ctx.buildFarolGroups_?null:null;
const src=fs.readFileSync('C:/Users/LuisFelipeMedeiros/.claude/repos/revops-cockpit-src/app.jsx','utf8');
const iD=src.indexOf("title: 'Retenção de valores (R$)'"),iG=src.indexOf("f.ggrSafra_m0 ? { ...dress(f.ggrSafra_m0), rowBreak: true }"),iM=src.indexOf("title: 'GGR por safra', cards");
t('GGR (R$) dentro de Retenção de valores (R$), com quebra de linha, antes da margem', iD>0&&iG>iD&&iM>iG&&src.indexOf("title: 'GGR por safra (R$)'")<0);
console.log(ok+' pass · '+fail+' fail');
