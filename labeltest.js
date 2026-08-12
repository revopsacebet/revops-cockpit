// Roda o buildFarolGroups_ REAL do bundle e exige "Orçado" em TODO card com BP, nos 3 cenários.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('C:/Users/LuisFelipeMedeiros/.claude/repos/revops-cockpit-src/index.html','utf8');
let code='';html.replace(/<script[^>]*>([\s\S]*?)<\/script>/g,(_,s)=>{if(s.length>code.length)code=s;return _;});
const ctx={window:{},document:{},localStorage:{getItem:()=>null,setItem:()=>{}},console,
  React:{useState:(v)=>[v,()=>{}],useMemo:(f)=>f(),useEffect:()=>{},createElement:()=>null,Fragment:'F'}};
vm.createContext(ctx); try{vm.runInContext(code,ctx);}catch(e){}

const mk=(act,bp,extra)=>Object.assign({act,bp,fmt:'brl',label:'x'},extra||{});
const range={from:'2026-08-01',to:'2026-08-11'};
let ok=0,fail=0;
const t=(n,c)=>{console.log((c?'PASS':'FAIL')+' | '+n);c?ok++:fail++;};

// simula os 3 cenários: 'meta'/'conservador' re-anchoram via scenBp; forecast marca fcBp nas razões
const cenarios=[
  {nome:'Meta',        flag:{scenBp:true}},
  {nome:'Conservador', flag:{scenBp:true}},
  {nome:'Forecast',    flag:{fcBp:true}},
  {nome:'sem cenario', flag:{}},
];
for(const c of cenarios){
  const MM={ depTotal:mk(23e6,25e6,c.flag), turnover:mk(23295545,24523418,c.flag), ggr:mk(2e6,2.1e6,c.flag),
             invest:mk(1e6,1.1e6,c.flag), ftd:mk(1000,1200,c.flag), rollover:mk(5.16,5.0,c.flag),
             hold:mk(0.03,0.035,c.flag), retM0M1:mk(0.54,0.60), ggrPerDep:mk(0.15,0.16,c.flag) };
  const f={ freespinDep:mk(0.04,0.02), bonusDep:mk(0.03,0.028) };
  const groups=ctx.buildFarolGroups_(MM,f,range,false,{});
  const cards=[].concat(...groups.map(g=>g.cards||[])).filter(Boolean);
  const comBp=cards.filter(x=>x.bp!=null);
  t(c.nome+': tem card com BP pra checar ('+comBp.length+')',comBp.length>0);
  const erradas=comBp.filter(x=>x.bpLabel!=='Orçado').map(x=>x.label+'='+x.bpLabel);
  t(c.nome+': TODO card com BP diz "Orçado"'+(erradas.length?' — vazou: '+erradas.join(', '):''),erradas.length===0);
  // REGRESSÃO do pedido: nenhum card pode carregar o nome do cenário
  const vazou=cards.filter(x=>x&&/^(Meta|Conservador|Forecast|BP)$/.test(x.bpLabel||''));
  t(c.nome+': nenhum card com nome de cenário',vazou.length===0);
}
console.log('\n'+ok+' pass · '+fail+' fail');process.exit(fail?1:0);
