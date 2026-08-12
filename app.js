/* ===== estado (dados vêm do DB, preferências ficam locais) ===== */
let IT=[], SEM=[], EMPN={}, EMPCOR={}, HOJE='';
let sim={}, acomp={}, ANOS=[];
const jGet=(k,d)=>{const v=DB.prefLocal.get(k);return v==null?d:v;};
const jSet=(k,v)=>DB.prefLocal.set(k,v);
function salvar(id,campo,valor){
  DB.salvarCampo(id,campo,valor).then(r=>{ if(!r.ok) toast(r.motivo==='sem-permissao'?'Seu perfil é somente leitura':'Não foi possível salvar: '+r.motivo); });
}

/* ===== dados ===== */
let fechados=jGet('rp_fechados',{});       // { sigla: true } grupos recolhidos
let ANO=null;
let SEL=null;
let TELA='home';
let CFIL={ano:'todos',sig:'todos',st:'todos',ac:'todos',q:''};   // filtros do consolidado
let SOPEND=false;                                      // ver só pendentes no ano
let CONSABERTO=jGet('rp_consAberto',false);            // tabela consolidada visível na home

/* ===== cor por empreendimento ===== */
const cor=s=>EMPCOR[s]||'#4c5a66';
const dotc=s=>`<span class="dotc" style="background:${cor(s)}"></span>`;
const sigtag=s=>`<span class="sigtag" style="background:${cor(s)}">${esc(s)}</span>`;

/* ===== acompanhamento ===== */
const WF=['A iniciar','Aguardando prazo','Em preparação','Em negociação','Proposta enviada','Concluída','Sem êxito'];

function wfPadrao(i){ return i.status==='Concluído'?'Concluída'
  : i.status==='Em negociação'?'Em negociação'
  : i.status==='Aguardando data'?'Aguardando prazo':'A iniciar'; }
const ac=id=>acomp[id]||{};
const wf=i=>ac(i.id).st||wfPadrao(i);
const emAndamento=i=>['Em preparação','Em negociação','Proposta enviada'].includes(wf(i));
const CAMPO_DB={st:'etapa',resp:'responsavel',prox:'proximo_contato'};
function acSet(id,campo,valor){
  acomp[id]=Object.assign({},acomp[id],{[campo]:valor});
  if(CAMPO_DB[campo]) salvar(id,CAMPO_DB[campo],valor||null);
}
function obsAdd(id,txt){
  DB.addAnotacao(id,txt).then(r=>{
    if(!r.ok){ toast(r.motivo==='sem-permissao'?'Seu perfil é somente leitura':'Não foi possível registrar: '+r.motivo); return; }
    acomp[id]=acomp[id]||{}; acomp[id].obs=[r.nota,...(acomp[id].obs||[])];
    renderAno(); toast('Anotação registrada');
  });
}
function obsDel(id,notaId){
  DB.delAnotacao(id,notaId).then(r=>{
    if(!r.ok){ toast('Não foi possível remover'); return; }
    acomp[id].obs=(acomp[id].obs||[]).filter(o=>o.id!==notaId);
    renderAno(); toast('Anotação removida');
  });
}
function dth(iso){ try{const d=new Date(iso);
  return d.toLocaleDateString('pt-BR')+' · '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';} }

/* ===== helpers ===== */
const brl=n=>n==null||isNaN(n)?'—':n.toLocaleString('pt-BR',{maximumFractionDigits:0});
const br2=n=>n==null||isNaN(n)?'—':n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const dbr=s=>{if(!s)return '—';const p=String(s).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s;};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const soma=(L,f)=>L.reduce((s,i)=>s+(f(i)||0),0);
const rm2=i=>i.valor&&i.m2?i.valor/i.m2:null;
const feito=i=>i.status==='Concluído';
/* alvo só existe onde o Comercial já definiu (plano de 2026); nos anos seguintes fica em branco */
const alvoVal=i=>i.valorAlvo!=null?i.valorAlvo:(i.alvoM2&&i.m2?i.alvoM2*i.m2:null);
const alvoM2=i=>i.alvoM2!=null?i.alvoM2:(i.valorAlvo&&i.m2?i.valorAlvo/i.m2:null);
/* valor previsto: o repactuado quando já fechado; senão a simulação; senão o alvo; senão o próprio atual */
const prev=i=>{ if(i.valorRep!=null) return i.valorRep;
  if(sim[i.id]!=null) return sim[i.id];
  const a=alvoVal(i); if(a==null) return i.valor||0;
  return Math.max(a,i.valor||0); };
const temPrev=i=>i.valorRep!=null||sim[i.id]!=null||alvoVal(i)!=null;
const dif=i=>prev(i)-(i.valor||0);
const rm2Rep=i=>{const p=prev(i);return i.m2?p/i.m2:null;};
const STCOR={'Concluído':'p-ok','Em negociação':'p-c','Aguardando data':'p-w','Previsto':'p-n','Sem previsão':'p-n'};
const stPill=i=>`<span class="pill ${STCOR[i.status]||'p-n'}">${esc(i.status)}</span>`;
function pill(s){
 if(s==='Vigente')return '<span class="pill p-ok">Vigente</span>';
 if(s.startsWith('Contrato prorrogado'))return '<span class="pill p-w">Vigência indeterminada</span>';
 if(s.startsWith('Em negociação'))return '<span class="pill p-c">Em negociação</span>';
 if(s.startsWith('Sem êxito'))return '<span class="pill p-c">Sem êxito na última</span>';
 if(s.startsWith('Definido manter'))return '<span class="pill p-w">Revisar decisão</span>';
 return '<span class="pill p-n">Acima da média</span>';}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2500);}
function go(){requestAnimationFrame(()=>{
  document.querySelectorAll('[data-w]').forEach(e=>{e.style.width=e.dataset.w+'%';});
  document.querySelectorAll('[data-h]').forEach(e=>{e.style.height=e.dataset.h+'%';});});}
const doAno=()=>IT.filter(i=>i.ano===ANO&&(!SOPEND||!feito(i))).sort((a,b)=>a.data<b.data?-1:1);
const doAnoTodos=()=>IT.filter(i=>i.ano===ANO).sort((a,b)=>a.data<b.data?-1:1);
function grupos(){
  const L=doAno(), m=new Map();
  L.forEach(i=>{ if(!m.has(i.sig)) m.set(i.sig,[]); m.get(i.sig).push(i); });
  return [...m.entries()].sort((a,b)=>soma(b[1],i=>i.valor)-soma(a[1],i=>i.valor));
}

/* ===== TELA 1 · visão geral ===== */
function abrirAno(a){ ANO=+a; SEL=null; TELA='ano';
  document.getElementById('vHome').classList.remove('on');
  document.getElementById('vAno').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'}); renderAno(); }
function voltar(){ TELA='home';
  document.getElementById('vAno').classList.remove('on');
  document.getElementById('vHome').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'}); renderHome(); }

function renderHome(){
  const va=soma(IT,i=>i.valor), vp=soma(IT,prev), d=vp-va;
  const nc=new Set(IT.map(i=>i.sig+i.unidade+i.cliente)).size;
  const nSim=IT.filter(i=>sim[i.id]!=null).length;
  document.getElementById('numsGeral').innerHTML=`
   <div class="nm"><div class="k">Repactuações previstas</div><div class="v">${IT.length}</div>
     <div class="s">${nc} contratos · ${ANOS[0]} a ${ANOS[ANOS.length-1]}${nSim?` · ${nSim} simuladas`:''}</div></div>
   <div class="nm"><div class="k">Área total envolvida</div><div class="v">${brl(soma(IT,i=>i.m2))} m²</div>
     <div class="s">${new Set(IT.map(i=>i.sig)).size} empreendimentos</div></div>
   <div class="nm"><div class="k">Valor atual da carteira</div><div class="v">R$ ${brl(va)}</div>
     <div class="s">por mês · R$ ${brl(va*12)} ao ano</div></div>
   <div class="nm acc"><div class="k">Valor previsto</div><div class="v">R$ ${brl(vp)}</div>
     <div class="s">por mês · R$ ${brl(vp*12)} ao ano</div></div>
   <div class="nm ok"><div class="k">Diferença</div><div class="v" style="color:var(--ok)">+R$ ${brl(d)}</div>
     <div class="s">${va?((d/va)*100).toFixed(1).replace('.',','):'0'}% · R$ ${brl(d*12)} ao ano</div></div>`;

  const mxD=Math.max(...ANOS.map(a=>soma(IT.filter(i=>i.ano===a),prev)),1);
  document.getElementById('hy').innerHTML=ANOS.map((a,k)=>{
    const S=IT.filter(i=>i.ano===a), va2=soma(S,i=>i.valor), vp2=soma(S,prev), d2=vp2-va2;
    return `<button class="hyc" data-a="${a}" style="animation-delay:${k*55}ms">
      <div class="y">${a}</div>
      <div class="q">${S.length} ${S.length===1?'repactuação':'repactuações'} · ${brl(soma(S,i=>i.m2))} m²</div>
      <div class="lin"></div>
      <div class="kv"><span class="k">Atual</span><span class="v">R$ ${brl(va2)}</span></div>
      <div class="kv"><span class="k">Previsto</span><span class="v p">R$ ${brl(vp2)}</span></div>
      <div class="kv"><span class="k">Diferença</span><span class="v d">+R$ ${brl(d2)}</span></div>
      <div class="sp"><i class="a" data-w="${va2/mxD*100}"></i><i class="d" data-w="${d2/mxD*100}"></i></div>
    </button>`;}).join('');
  document.getElementById('hy').insertAdjacentHTML('afterbegin',
    `<button class="hyc cons" data-cons="1"><div class="y" style="font-size:22px;line-height:1.15">Consolidado</div>
      <div class="q">${IT.length} repactuações · ${ANOS[0]} a ${ANOS[ANOS.length-1]}</div>
      <div class="lin"></div>
      <div class="kv"><span class="k">Concluídas</span><span class="v d">${IT.filter(feito).length}</span></div>
      <div class="kv"><span class="k">Pendentes</span><span class="v">${IT.filter(i=>!feito(i)).length}</span></div>
      <div class="kv"><span class="k">Contratos</span><span class="v">${new Set(IT.map(i=>i.sig+i.unidade+i.cliente)).size}</span></div>
      <div class="sp"><i class="d" data-w="${IT.filter(feito).length/IT.length*100}"></i><i class="a" data-w="${IT.filter(i=>!feito(i)).length/IT.length*100}"></i></div>
    </button>`);
  const nAnd=IT.filter(emAndamento).length, nObs=IT.filter(i=>(ac(i.id).obs||[]).length).length;
  document.getElementById('hy').insertAdjacentHTML('afterbegin',
    `<button class="hyc cons" data-and="1" style="border-color:#eccb99;background:linear-gradient(180deg,#fff,#fdf6ea)">
      <div class="y" style="font-size:22px;line-height:1.15">Em andamento</div>
      <div class="q">negociações abertas neste momento</div>
      <div class="lin"></div>
      <div class="kv"><span class="k">Em negociação</span><span class="v p">${nAnd}</span></div>
      <div class="kv"><span class="k">Com anotações</span><span class="v">${nObs}</span></div>
      <div class="kv"><span class="k">Concluídas</span><span class="v d">${IT.filter(feito).length}</span></div>
      <div class="sp"><i class="d" data-w="${nAnd/IT.length*100}"></i></div></button>`);
  document.querySelector('#hy .hyc[data-and]').onclick=()=>abrirConsolidado(true);
  document.querySelectorAll('#hy .hyc[data-a]').forEach(b=>b.onclick=()=>abrirAno(b.dataset.a));
  document.querySelector('#hy .hyc[data-cons]').onclick=()=>{ (CONSABERTO&&CFIL.ac!=='andamento')?fecharConsolidado():abrirConsolidado(false); };

  const mx=Math.max(...ANOS.map(a=>soma(IT.filter(i=>i.ano===a),prev)),1);
  const ch=document.getElementById('chartGeral');
  ch.style.gridTemplateColumns=`repeat(${ANOS.length},1fr)`;
  ch.innerHTML=ANOS.map(a=>{const S=IT.filter(i=>i.ano===a),v1=soma(S,i=>i.valor),v2=soma(S,prev);
    return `<div class="bc" data-a="${a}">
      <div class="tip">${S.length} contratos · atual R$ ${brl(v1)} · previsto R$ ${brl(v2)}</div>
      <div class="lb">R$ ${brl(v2/1000)}k</div>
      <div class="cw"><div class="cl a" data-h="${Math.max(3,v1/mx*100)}"></div><div class="cl p" data-h="${Math.max(3,v2/mx*100)}"></div></div>
      <div class="ax">${a}</div></div>`;}).join('');
  document.querySelectorAll('#chartGeral .bc').forEach(b=>b.onclick=()=>abrirAno(b.dataset.a));
  if(CONSABERTO){ renderCons(); modoCons(true); } else modoCons(false);
  go();
}

/* ===== barra de anos (tela do ano) ===== */
function renderYbar(){
  const T=doAnoTodos(), nOK=T.filter(feito).length;
  document.getElementById('ybar').innerHTML=
    `<button class="b sm" data-cons="1">Consolidado</button>`+
    ANOS.map(a=>`<button class="b sm ${a===ANO?'on':''}" data-a="${a}">${a} <span style="opacity:.6">(${IT.filter(i=>i.ano===a).length})</span></button>`).join('')+
    (nOK?`<button class="b sm ${SOPEND?'cop':''}" data-pend="1" style="margin-left:8px">${SOPEND?'Mostrando só pendentes':'Ver só o que falta'}</button>`:'');
  document.querySelectorAll('#ybar [data-a]').forEach(b=>b.onclick=()=>{ANO=+b.dataset.a;SEL=null;SOPEND=false;renderAno();window.scrollTo({top:0,behavior:'smooth'});});
  const bc=document.querySelector('#ybar [data-cons]'); if(bc) bc.onclick=()=>abrirConsolidado(false);
  const bp=document.querySelector('#ybar [data-pend]'); if(bp) bp.onclick=()=>{SOPEND=!SOPEND;SEL=null;renderAno();};
  const L=doAno();
  document.getElementById('anoTit').textContent=`Repactuações de ${ANO}`;
  document.getElementById('anoSub').textContent=`${L.length} contrato${L.length>1?'s':''} em ${grupos().length} empreendimento${grupos().length>1?'s':''}. Clique no contrato à esquerda para abrir a ficha e simular o reajuste.`;
}

/* ===== números do ano ===== */
function renderNums(){
  const T=doAnoTodos(), L=doAno();
  const va=soma(L,i=>i.valor), vp=soma(L,prev), d=vp-va;
  const OK=T.filter(feito), PEND=T.filter(i=>!feito(i));
  const okAnt=soma(OK,i=>i.valor), okNovo=soma(OK,i=>i.valorRep);
  const pendAt=soma(PEND,i=>i.valor), pendPrev=soma(PEND,prev);
  const nSim=L.filter(i=>sim[i.id]!=null).length;
  let h=`<div class="nm go" id="nmGo"><div class="k">Repactuações em ${ANO}</div><div class="v">${T.length}</div>
     <div class="s">${new Set(T.map(i=>i.sig)).size} empreendimentos${nSim?` · ${nSim} simuladas`:''} · ver lista →</div></div>`;
  if(OK.length){
    h+=`<div class="nm ok"><div class="k">Já repactuado</div><div class="v" style="color:var(--ok)">${OK.length} de ${T.length}</div>
       <div class="s">R$ ${brl(okAnt)} → <b style="color:var(--ok)">R$ ${brl(okNovo)}</b>/mês</div></div>
      <div class="nm ok"><div class="k">Ganho já obtido</div><div class="v" style="color:var(--ok)">+R$ ${brl(okNovo-okAnt)}</div>
       <div class="s">${okAnt?((okNovo-okAnt)/okAnt*100).toFixed(1).replace('.',','):'0'}% · R$ ${brl((okNovo-okAnt)*12)} ao ano</div></div>
      <div class="nm"><div class="k">Falta repactuar</div><div class="v">${PEND.length} contrato${PEND.length>1?'s':''}</div>
       <div class="s">R$ ${brl(pendAt)}/mês em mesa · alvo R$ ${brl(pendPrev)}</div></div>
      <div class="nm acc"><div class="k">Potencial restante</div><div class="v">+R$ ${brl(pendPrev-pendAt)}</div>
       <div class="s">se as ${PEND.length} pendentes fecharem no alvo</div></div>`;
  } else {
    h+=`<div class="nm"><div class="k">Área envolvida</div><div class="v">${brl(soma(L,i=>i.m2))} m²</div>
       <div class="s">média R$ ${br2(va/(soma(L,i=>i.m2)||1))}/m²</div></div>
      <div class="nm"><div class="k">Valor atual</div><div class="v">R$ ${brl(va)}</div><div class="s">por mês · R$ ${brl(va*12)} ao ano</div></div>
      <div class="nm acc"><div class="k">Valor previsto</div><div class="v">R$ ${brl(vp)}</div><div class="s">por mês · R$ ${brl(vp*12)} ao ano</div></div>
      <div class="nm ok"><div class="k">Diferença</div><div class="v" style="color:var(--ok)">+R$ ${brl(d)}</div>
       <div class="s">${va?((d/va)*100).toFixed(1).replace('.',','):'0'}% · R$ ${brl(d*12)} ao ano</div></div>`;
  }
  document.getElementById('nums').innerHTML=h;
  const g=document.getElementById('nmGo');
  if(g) g.onclick=()=>{const m=document.querySelector('#vAno .main'); if(m) m.scrollIntoView({behavior:'smooth',block:'start'});};
}

/* ===== comparativo por empreendimento ===== */
function renderCmp(){
  const G=grupos();
  const mx=Math.max(...G.map(([s,L])=>Math.max(soma(L,i=>i.valor),soma(L,prev))),1);
  document.getElementById('cmpTit').textContent=`Comparativo por empreendimento — ${ANO}`;
  document.getElementById('cmpb').innerHTML=G.map(([s,L])=>{
    const a=soma(L,i=>i.valor), p=soma(L,prev), d=p-a;
    return `<button class="cb" data-goto="${s}"><div class="l">${dotc(s)}${esc(EMPN[s]||s)}<small style="padding-left:16px">${s} · ${L.length} contrato${L.length>1?'s':''} · ${brl(soma(L,i=>i.m2))} m²</small></div>
      <div class="t"><div class="g a"><i data-w="${a/mx*100}" style="background:linear-gradient(90deg,${cor(s)},${cor(s)}bb)"></i></div><div class="g p"><i data-w="${p/mx*100}"></i></div></div>
      <div class="v"><div class="a">atual R$ ${brl(a)}</div><div class="p">previsto R$ ${brl(p)} ${d>0?`<span style="color:var(--ok)">(+${(d/a*100).toFixed(1).replace('.',',')}%)</span>`:''}</div></div></button>`;
  }).join('');
  document.querySelectorAll('#cmpb .cb').forEach(b=>b.onclick=()=>irPara(b.dataset.goto));
  const semAlvo=doAno().filter(i=>!temPrev(i)).length;
  document.getElementById('metaHint').innerHTML = semAlvo
    ? `${semAlvo} contrato${semAlvo>1?'s':''} sem valor alvo definido — nesses o previsto repete o valor atual até o Comercial fixar a meta.`
    : 'Todos os contratos do ano têm valor alvo ou simulação definidos.';
}

/* ===== lista agrupada ===== */
function renderLista(){
  const G=grupos(), L=doAno();
  document.getElementById('listTit').textContent=`Contratos de ${ANO}`;
  document.getElementById('listCount').innerHTML=`${L.length} contrato${L.length>1?'s':''}<br>${G.length} empreendimento${G.length>1?'s':''}`;
  document.getElementById('slist').innerHTML=G.map(([s,its])=>{
    const a=soma(its,i=>i.valor), p=soma(its,prev), d=p-a, fechado=!!fechados[s];
    return `<div class="grp" data-grp="${s}">
      <div class="gh ${fechado?'closed':''}" data-g="${s}" style="background:${cor(s)}">
        <div class="n"><div><div class="sg">${s}</div><div class="t">${esc(EMPN[s]||s)}</div>
          <div class="q">${its.length} contrato${its.length>1?'s':''} · ${brl(soma(its,i=>i.m2))} m²</div></div>
          <span class="arrow">▾</span></div>
        <div class="vals"><span class="a">atual <b>R$ ${brl(a)}</b></span><span class="p">previsto <b>R$ ${brl(p)}</b></span></div>
      </div>
      <div class="gbody" data-body="${s}" style="${fechado?'display:none':''}">
        ${its.map(i=>`<button class="it ${SEL===i.id?'on':''} ${feito(i)?'ok':''}" data-id="${esc(i.id)}">
          <div class="a">${esc(i.cliente.length>32?i.cliente.slice(0,30)+'…':i.cliente)}${feito(i)?'<span class="sim">✓ repactuado</span>':(sim[i.id]!=null?'<span class="sim">simulado</span>':(i.status!=='Previsto'?`<span class="sim st">${esc(i.status)}</span>`:''))}</div>
          <div class="r"><span>${esc(i.unidade.slice(0,22))} · ${dbr(i.data)}</span><span class="vl">${feito(i)?`R$ ${brl(i.valor)} → <b style="color:var(--ok)">R$ ${brl(i.valorRep)}</b>`:'R$ '+brl(i.valor)}</span></div>
          ${(emAndamento(i)||(ac(i.id).obs||[]).length||ac(i.id).resp)?`<div class="r" style="margin-top:3px">
            <span style="color:var(--copper-2);font-weight:600">${esc(wf(i))}${ac(i.id).resp?' · '+esc(ac(i.id).resp):''}</span>
            <span>${(ac(i.id).obs||[]).length?`${(ac(i.id).obs||[]).length} anotaç${(ac(i.id).obs||[]).length>1?'ões':'ão'}`:''}${ac(i.id).prox?' · contato '+dbr(ac(i.id).prox):''}</span></div>`:''}
        </button>`).join('')}
        <div class="gfoot"><span>fim de ${esc(s)}${its.filter(feito).length?` · ${its.filter(feito).length} de ${its.length} repactuado${its.filter(feito).length>1?'s':''}`:''}</span><span>diferença <b>+R$ ${brl(d)}/mês</b></span></div>
      </div></div>`;}).join('');
  document.querySelectorAll('#slist .gh').forEach(g=>g.onclick=()=>{
    const s=g.dataset.g; fechados[s]=!fechados[s]; jSet('rp_fechados',fechados);
    g.classList.toggle('closed',fechados[s]);
    document.querySelector(`[data-body="${s}"]`).style.display=fechados[s]?'none':'';});
  document.querySelectorAll('#slist .it').forEach(b=>b.onclick=()=>{SEL=b.dataset.id;renderAno();});
}

/* ===== ir para os contratos de um empreendimento ===== */
function irPara(sig){
  const its=doAno().filter(i=>i.sig===sig);
  if(!its.length) return;
  if(fechados[sig]){ fechados[sig]=false; jSet('rp_fechados',fechados); }
  renderAno();
  const main=document.querySelector('#vAno .main');
  if(main) main.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>{
    const sl=document.getElementById('slist'), g=sl.querySelector(`.grp[data-grp="${sig}"]`);
    if(g){ sl.scrollTop=Math.max(0,g.offsetTop-8); g.classList.add('flash');
      setTimeout(()=>g.classList.remove('flash'),1600); }
  },420);
  toast(`${EMPN[sig]||sig} · ${its.length} contrato${its.length>1?'s':''} em ${ANO}`);
}

function add3iso(iso){const [y,m,d]=iso.split('-').map(Number);return `${y+3}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}

/* ===== ficha + simulador ===== */
function renderDet(){
  const L=doAno();
  const i=SEL?IT.find(x=>x.id===SEL):null;
  const el=document.getElementById('det');
  if(!i){
    const va=soma(L,x=>x.valor), vp=soma(L,prev), G=grupos();
    el.innerHTML=`<div class="vazio">
      <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0762c" stroke-width="1.7">
        <path d="M9 4h9a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V9"/><path d="M4 9l5-5v5H4z"/><path d="M9 13h8M9 17h5"/></svg></div>
      <h3>Escolha um contrato à esquerda</h3>
      <p>Os contratos de ${ANO} estão agrupados por empreendimento. Clique na sala para abrir a ficha, ver os dados do contrato e simular o reajuste.</p>
      <div class="mini">
        <div class="c2"><div class="k">Contratos</div><div class="v">${L.length}</div></div>
        <div class="c2"><div class="k">Empreendimentos</div><div class="v">${G.length}</div></div>
        <div class="c2"><div class="k">Valor atual</div><div class="v">R$ ${brl(va)}</div></div>
        <div class="c2"><div class="k">Valor previsto</div><div class="v" style="color:var(--copper-2)">R$ ${brl(vp)}</div></div>
      </div></div>`;
    return;}
  const grupo=L.filter(x=>x.sig===i.sig);
  const gA=soma(grupo,x=>x.valor), gP=soma(grupo,prev);
  const p=prev(i), d=p-(i.valor||0), pm2=i.m2?p/i.m2:null;
  const mx=Math.max(i.valor||0,p,alvoVal(i)||0)||1;
  const maxSlider=Math.max((i.valor||0)*2.2,(alvoVal(i)||0)*1.4,1000);
  el.innerHTML=`
  <div class="dh" style="background:${cor(i.sig)}">
    <button class="dclose" id="dclose" title="Fechar ficha">×</button>
    <div class="tag">${esc(i.sig)} · ${esc(EMPN[i.sig]||i.emp)}</div>
    <h3>${esc(i.cliente)}</h3>
    <div class="s">${esc(i.unidade)}${i.gar&&i.gar!=='-'?' · garagem '+esc(i.gar.slice(0,40)):''}</div>
    <div class="chips"><span class="chp" style="${feito(i)?'background:rgba(95,200,150,.2);border-color:rgba(95,200,150,.45)':''}">${feito(i)?'✓ Repactuado em ':'Repactuação '}${dbr(i.data)}</span>
      <span class="chp">${i.status!=='Previsto'&&!feito(i)?esc(i.status)+' · ':''}Tratativa ${esc(i.mesCom)}/${String(i.ano).slice(2)}</span>
      <span class="chp">Vigência ${i.prazo==='Indet.'?'indeterminada':esc(i.prazo)}</span></div>
  </div>
  <div class="dbody">
    <div class="sect"><h4>Dados do contrato</h4>
      <div class="dgrid">
        <div class="dk"><div class="k">Área privativa</div><div class="v">${i.m2?br2(i.m2)+' m²':'—'}</div></div>
        <div class="dk"><div class="k">Valor atual</div><div class="v">R$ ${brl(i.valor)}</div></div>
        <div class="dk"><div class="k">R$/m² atual</div><div class="v">${rm2(i)?'R$ '+br2(rm2(i)):'—'}</div></div>
        <div class="dk"><div class="k">R$/m² alvo</div><div class="v">${alvoM2(i)?'R$ '+br2(alvoM2(i)):'a definir'}</div></div>
        <div class="dk"><div class="k">Início</div><div class="v sm">${dbr(i.ini)}</div></div>
        <div class="dk"><div class="k">Fim</div><div class="v sm">${dbr(i.fim)}</div></div>
        <div class="dk"><div class="k">Últ. repactuação</div><div class="v sm">${i.ult&&String(i.ult).includes('-')?dbr(i.ult):'—'}</div></div>
        <div class="dk"><div class="k">Locador</div><div class="v sm">${esc(i.locador||'—')}</div></div>
      </div>
      <div class="note" style="margin-top:11px">${pill(i.sit)} &nbsp; ${i.plano?'Consta no plano de repactuação de 2026.':'Data calculada por: <b>'+esc(i.origem.toLowerCase())+'</b>.'}</div>
    </div>
    ${feito(i)?`<div class="sect"><h4>Repactuação realizada</h4>
      <div class="simres">
        <div class="rs"><div class="k">Valor anterior</div><div class="v">R$ ${brl(i.valor)}</div><div class="s">R$ ${br2(rm2(i))}/m²</div></div>
        <div class="rs"><div class="k">Valor alvo</div><div class="v" style="color:var(--copper-2)">R$ ${brl(alvoVal(i))}</div><div class="s">R$ ${br2(alvoM2(i))}/m²</div></div>
        <div class="rs pos"><div class="k">Valor acordado</div><div class="v">R$ ${brl(i.valorRep)}</div><div class="s">R$ ${br2(i.rm2Rep)}/m²</div></div>
        <div class="rs pos"><div class="k">Reajuste obtido</div><div class="v">+${(i.pct*100).toFixed(1).replace('.',',')}%</div>
          <div class="s">+R$ ${brl(i.valorRep-i.valor)}/mês · +R$ ${brl((i.valorRep-i.valor)*12)}/ano</div></div>
      </div>
      <div class="cmp2" style="margin-top:12px">
        <div class="r"><span class="l">Anterior</span><span class="t"><i data-w="${(i.valor||0)/Math.max(i.valor,alvoVal(i)||0,i.valorRep)*100}" style="background:linear-gradient(90deg,#1c3a52,#33627f)"></i></span><span class="v">R$ ${brl(i.valor)}</span></div>
        <div class="r"><span class="l">Alvo</span><span class="t"><i data-w="${(alvoVal(i)||0)/Math.max(i.valor,alvoVal(i)||0,i.valorRep)*100}" style="background:linear-gradient(90deg,#8ea3b3,#c3ced6)"></i></span><span class="v">R$ ${brl(alvoVal(i))}</span></div>
        <div class="r"><span class="l">Acordado</span><span class="t"><i data-w="${i.valorRep/Math.max(i.valor,alvoVal(i)||0,i.valorRep)*100}" style="background:linear-gradient(90deg,#2f7d5b,#5fbf90)"></i></span><span class="v" style="color:var(--ok)">R$ ${brl(i.valorRep)}</span></div>
      </div>
      <div class="note">Próximo ciclo previsto para ${dbr(add3iso(i.data))}, três anos após esta repactuação.</div></div>`:''}

    <div class="sect"><h4>${feito(i)?'Simular um cenário alternativo':'Simular repactuação'}</h4>
      <div class="sim">
        <div class="simtop"><div class="t">Quanto pedir para este contrato?</div>
          <div class="row">
            ${alvoVal(i)?'<button class="b sm" data-q="alvo">Aplicar valor alvo</button>':''}
            <button class="b sm" data-q="5">+5%</button><button class="b sm" data-q="10">+10%</button>
            <button class="b sm" data-q="15">+15%</button><button class="b sm" data-q="20">+20%</button>
            <button class="b sm gh" data-q="limpar">Limpar</button>
          </div></div>
        <div class="simin">
          <div class="fi"><label>Valor mensal proposto (R$)</label>
            <input type="number" id="sVal" step="50" min="0" value="${Math.round(p)}"></div>
          <div class="fi"><label>Equivale a R$/m²</label>
            <input type="number" id="sM2" step="0.5" min="0" value="${pm2?pm2.toFixed(2):''}" ${i.m2?'':'disabled'}></div>
        </div>
        <input type="range" id="sRange" min="0" max="${Math.round(maxSlider)}" step="10" value="${Math.round(p)}">
        <div class="rlab"><span>R$ 0</span><span>atual R$ ${brl(i.valor)}</span><span>R$ ${brl(maxSlider)}</span></div>

        <div class="simres">
          <div class="rs"><div class="k">Valor atual</div><div class="v">R$ ${brl(i.valor)}</div><div class="s">R$ ${brl((i.valor||0)*12)} ao ano</div></div>
          <div class="rs"><div class="k">Valor previsto</div><div class="v" style="color:var(--copper-2)">R$ ${brl(p)}</div><div class="s">R$ ${brl(p*12)} ao ano</div></div>
          <div class="rs ${d>=0?'pos':'neg'}"><div class="k">Diferença mensal</div><div class="v">${d>=0?'+':''}R$ ${brl(d)}</div>
            <div class="s">${i.valor?((d/i.valor)*100).toFixed(1).replace('.',','):'0'}% de reajuste</div></div>
          <div class="rs ${d>=0?'pos':'neg'}"><div class="k">Impacto anual</div><div class="v">${d>=0?'+':''}R$ ${brl(d*12)}</div>
            <div class="s">no faturamento de locação</div></div>
        </div>

        <div class="cmp2">
          <div class="r"><span class="l">Atual</span><span class="t"><i data-w="${(i.valor||0)/mx*100}" style="background:linear-gradient(90deg,#1c3a52,#33627f)"></i></span><span class="v">R$ ${brl(i.valor)}</span></div>
          <div class="r"><span class="l">Alvo</span><span class="t"><i data-w="${(alvoVal(i)||0)/mx*100}" style="background:linear-gradient(90deg,#8ea3b3,#c3ced6)"></i></span><span class="v">${alvoVal(i)?'R$ '+brl(alvoVal(i)):'—'}</span></div>
          <div class="r"><span class="l">Simulado</span><span class="t"><i data-w="${p/mx*100}" style="background:linear-gradient(90deg,#a8631f,#e9a74f)"></i></span><span class="v" style="color:var(--copper-2)">R$ ${brl(p)}</span></div>
        </div>
      </div>
    </div>

    <div class="sect"><h4>Acompanhamento da tratativa</h4>
      <div class="wf">${WF.map(w=>`<button data-w="${w}" class="${wf(i)===w?'on':''}">${w}</button>`).join('')}</div>
      <div class="acgrid">
        <div><label>Responsável pela tratativa</label><input id="acResp" placeholder="Ex.: Fabiana de Souza" value="${esc(ac(i.id).resp||'')}"></div>
        <div><label>Próximo contato</label><input id="acProx" type="date" value="${esc(ac(i.id).prox||'')}"></div>
      </div>
      <label style="display:block;font-size:9.2px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;font-weight:600">Nova anotação</label>
      <div class="obsbox">
        <textarea id="acObs" placeholder="O que foi tratado, com quem, o que ficou combinado…"></textarea>
        <button class="b cop" id="acAdd" style="align-self:stretch;white-space:nowrap">Registrar</button>
      </div>
      ${(ac(i.id).obs||[]).length?`<div class="tl">${(ac(i.id).obs||[]).map((o,k)=>`
        <div class="ev"><div class="pt"></div><div class="bd">
          <div class="dtm"><span>${dth(o.d)}${o.autor?' · '+esc(o.autor):''}</span><span class="del" data-del="${o.id}">remover</span></div>
          <div class="tx">${esc(o.t)}</div></div></div>`).join('')}</div>`
        :'<div class="emptyobs">Nenhuma anotação ainda. Registre aqui o histórico da conversa com o locatário.</div>'}
    </div>

    <div class="sect"><h4>Reflexo no empreendimento</h4>
      <div class="impacto">
        <div class="t">${esc(EMPN[i.sig]||i.sig)} · repactuações de ${ANO}</div>
        <div class="r"><span class="k">Contratos no ano</span><span class="v">${grupo.length}</span></div>
        <div class="r"><span class="k">Valor atual somado</span><span class="v">R$ ${brl(gA)}/mês</span></div>
        <div class="r"><span class="k">Valor previsto somado</span><span class="v ok">R$ ${brl(gP)}/mês</span></div>
        <div class="r"><span class="k">Diferença</span><span class="v ok">+R$ ${brl(gP-gA)}/mês · +R$ ${brl((gP-gA)*12)}/ano</span></div>
        <div class="g"><i class="a" data-w="${gA/(gP||1)*100}"></i><i class="d" data-w="${(gP-gA)/(gP||1)*100}"></i></div>
        <div style="font-family:var(--fm);font-size:9.6px;color:var(--muted);margin-top:7px">Barra escura = valor atual · barra cobre = acréscimo previsto</div>
      </div>
      <div class="note">Este simulador é de apoio à negociação. O valor efetivo depende de aditivo assinado — minuta e comprovantes no <b>SharePoint</b>, tratativa registrada no <b>ClickUp</b>. Alterações de garantia ou quadro societário: validar com a Diretoria.</div>
    </div>
  </div>`;

  document.getElementById('dclose').onclick=()=>{SEL=null;renderAno();};
  el.querySelectorAll('.wf button').forEach(b=>b.onclick=()=>{
    acSet(i.id,'st',b.dataset.w);
    el.querySelectorAll('.wf button').forEach(x=>x.classList.toggle('on',x===b));
    toast('Etapa: '+b.dataset.w); renderLista(); renderNums();});
  const rp=document.getElementById('acResp'), px=document.getElementById('acProx');
  rp.onchange=()=>acSet(i.id,'resp',rp.value);
  px.onchange=()=>{acSet(i.id,'prox',px.value); renderLista();};
  document.getElementById('acAdd').onclick=()=>{
    const t=document.getElementById('acObs').value.trim();
    if(!t){toast('Escreva a anotação antes de registrar');return;}
    obsAdd(i.id,t);};
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>obsDel(i.id,+b.dataset.del));
  const iv=document.getElementById('sVal'), im=document.getElementById('sM2'), ir=document.getElementById('sRange');
  const aplica=v=>{ v=Math.max(0,Math.round(v||0)); sim[i.id]=v; salvar(i.id,'simulacao',v); renderAno(); };
  iv.oninput=()=>{const v=parseFloat(iv.value)||0; if(i.m2) im.value=(v/i.m2).toFixed(2); ir.value=Math.min(v,ir.max);};
  iv.onchange=()=>aplica(parseFloat(iv.value));
  if(i.m2){ im.oninput=()=>{const v=(parseFloat(im.value)||0)*i.m2; iv.value=Math.round(v); ir.value=Math.min(v,ir.max);};
            im.onchange=()=>aplica((parseFloat(im.value)||0)*i.m2); }
  ir.oninput=()=>{const v=+ir.value; iv.value=v; if(i.m2) im.value=(v/i.m2).toFixed(2);};
  ir.onchange=()=>aplica(+ir.value);
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{
    const q=b.dataset.q;
    if(q==='limpar'){ delete sim[i.id]; salvar(i.id,'simulacao',null); renderAno(); toast('Simulação removida'); return; }
    if(q==='alvo'){ if(!alvoVal(i)){toast('Este contrato ainda não tem valor alvo definido');return;} aplica(alvoVal(i)); toast('Valor alvo aplicado'); return; }
    aplica((i.valor||0)*(1+ +q/100)); toast(`Simulado com +${q}% sobre o valor atual`);
  });
  go();
}

/* ===== exportar / relatório ===== */
document.getElementById('bCsv').onclick=()=>{
  const L=doAno();
  const H=['Ano','Data repactuação','Empreendimento','Local','Cliente','Unidade','Área m2','Valor atual','R$/m2 atual','Meta R$/m2','Valor previsto','Diferença mensal','% reajuste','Simulado','Vigência','Situação'];
  const R=L.map(i=>[ANO,dbr(i.data),i.emp,i.sig,i.cliente,i.unidade,i.m2??'',i.valor??'',
    rm2(i)?rm2(i).toFixed(2):'',alvoM2(i)??'',prev(i).toFixed(2),dif(i).toFixed(2),
    i.valor?((dif(i)/i.valor)*100).toFixed(1):'',sim[i.id]!=null?'sim':'não',i.prazo,i.sit]);
  const csv=[H,...R].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`repactuacoes-${ANO}.csv`;a.click();toast(`${L.length} contratos exportados`);};

/* ===== render ===== */
function renderAno(){
  const L=doAno();
  if(SEL&&!L.some(i=>i.id===SEL)) SEL=null;
  renderYbar();renderNums();renderLista();renderDet();renderCmp();go(); }
function render(){ if(TELA==='home') renderHome(); else renderAno(); }
document.getElementById('bVoltar').onclick=voltar;
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&TELA==='ano') voltar(); });

/* ================== TELA 3 · CONSOLIDADO ================== */
function modoCons(on){
  document.getElementById('homeHead').style.display = on?'none':'';
  document.getElementById('homeTop').style.display  = on?'none':'';
  document.getElementById('consWrap').style.display = on?'block':'none';
}
function abrirConsolidado(soAndamento){
  CONSABERTO=true; jSet('rp_consAberto',true);
  CFIL={ano:'todos',sig:'todos',st:'todos',ac:(soAndamento===true?'andamento':'todos'),q:''};
  const cqi=document.getElementById('cq'); if(cqi) cqi.value='';
  TELA='home';
  document.getElementById('vAno').classList.remove('on');
  document.getElementById('vHome').classList.add('on');
  renderCons(); modoCons(true);
  window.scrollTo({top:0,behavior:'smooth'});
}
function fecharConsolidado(){
  CONSABERTO=false; jSet('rp_consAberto',false);
  modoCons(false);   window.scrollTo({top:0,behavior:'smooth'});
}
const STATUS_LISTA=['Concluído','Em negociação','Aguardando data','Previsto'];
function consFiltrado(){
  const q=(CFIL.q||'').trim().toLowerCase();
  return IT.filter(i=>(CFIL.ac!=='andamento'||emAndamento(i))&&
      (!q||(i.cliente+' '+i.unidade+' '+(i.gar||'')+' '+i.emp+' '+i.sig).toLowerCase().includes(q)))
    .sort((a,b)=>a.data<b.data?-1:(a.data>b.data?1:0));
}
function renderCons(){
  const L=consFiltrado(), SIG=[...new Set(IT.map(i=>i.sig))].sort();
  document.getElementById('consTit').textContent = CFIL.ac==='andamento'?'Tratativas em andamento':'Consolidado de repactuações';
  document.getElementById('consSub').textContent = CFIL.ac==='andamento'
    ? `${L.length} repactuaç${L.length>1?'ões':'ão'} em curso, separadas por ano. Clique na linha para abrir a ficha, registrar anotações e atualizar a etapa.`
    : `${L.length} repactuações de ${new Set(L.map(i=>i.sig+i.unidade+i.cliente)).size} contratos, separadas por ano, de ${ANOS[0]} a ${ANOS[ANOS.length-1]}. Uma linha por repactuação, com o que já foi fechado e o que ainda falta.`;

  const cq=document.getElementById('cq');
  if(cq && cq.value!==(CFIL.q||'')) cq.value=CFIL.q||'';
  const bn=document.getElementById('consBanner');
  if(CFIL.ac==='andamento'){
    const n=IT.filter(emAndamento).length;
    bn.style.display='block';
    bn.innerHTML=`<div class="cbanner"><span>Mostrando apenas as <b>${n} tratativa${n>1?'s':''} em andamento</b> — em preparação, em negociação ou com proposta enviada. Contratos cujo prazo de três anos ainda não venceu ficam como “Aguardando prazo” e não entram aqui.</span>
      <button class="b sm" id="bTudo">Mostrar todas as ${IT.length}</button></div>`;
    document.getElementById('bTudo').onclick=()=>{CFIL.ac='todos';renderCons();};
  } else bn.style.display='none';

  const OK=L.filter(feito);
  const va=soma(L,i=>i.valor), vAlvo=soma(L,i=>alvoVal(i)||0), vRep=soma(OK,i=>i.valorRep);
  const H=['Cliente','Prazo','Sala','Local','Garagem','M² Priv.','R$/m² At.','Vlr Atual','R$/m² Alvo','Vlr Alvo',
           'R$/m² Rep.','Vlr Repact.','% Reaj.','Status','Etapa','Obs.','Com.','Rep.','Ano'];
  const NUM=[5,6,7,8,9,10,11,12,15];
  let corpo='', anoAtual=null;
  L.forEach(i=>{
    if(i.ano!==anoAtual){anoAtual=i.ano;
      const S=L.filter(x=>x.ano===anoAtual), ok=S.filter(feito).length;
      corpo+=`<tr class="gsep"><td colspan="${H.length}">${anoAtual} · ${S.length} repactuaç${S.length>1?'ões':'ão'} · ${brl(soma(S,x=>x.m2))} m² · atual R$ ${brl(soma(S,x=>x.valor))}/mês${ok?` · ${ok} já repactuada${ok>1?'s':''}`:''}</td></tr>`;}
    const al=alvoVal(i), am=alvoM2(i);
    corpo+=`<tr data-id="${esc(i.id)}">
      <td class="nome acc" style="border-left-color:${cor(i.sig)}">${esc(i.cliente)}</td>
      <td>${i.prazo==='Indet.'?'Indet.':esc(i.prazo)}</td>
      <td title="${esc(i.unidade||'')}">${esc((i.unidade||'-').slice(0,20))}${(i.unidade||'').length>20?'…':''}</td>
      <td class="loc">${sigtag(i.sig)}</td>
      <td title="${esc(i.gar||'')}">${i.gar&&i.gar!=='-'?esc(i.gar.slice(0,16))+(i.gar.length>16?'…':''):'<span class="vz">—</span>'}</td>
      <td class="r">${i.m2?br2(i.m2):'<span class="vz">—</span>'}</td>
      <td class="r">${rm2(i)?br2(rm2(i)):'<span class="vz">—</span>'}</td>
      <td class="r">${brl(i.valor)}</td>
      <td class="r">${am?br2(am):'<span class="vz">—</span>'}</td>
      <td class="r">${al?brl(al):'<span class="vz">—</span>'}</td>
      <td class="r">${i.rm2Rep?br2(i.rm2Rep):(sim[i.id]!=null&&i.m2?'<i>'+br2(sim[i.id]/i.m2)+'</i>':'<span class="vz">—</span>')}</td>
      <td class="r">${i.valorRep!=null?'<b class="up">'+brl(i.valorRep)+'</b>':(sim[i.id]!=null?'<i>'+brl(sim[i.id])+'</i>':'<span class="vz">—</span>')}</td>
      <td class="r">${i.pct!=null?'<b class="up">'+(i.pct*100).toFixed(1).replace('.',',')+'%</b>':(sim[i.id]!=null&&i.valor?'<i>'+((sim[i.id]/i.valor-1)*100).toFixed(1).replace('.',',')+'%</i>':'<span class="vz">—</span>')}</td>
      <td>${stPill(i)}</td>
      <td>${emAndamento(i)?`<b style="color:var(--copper-2)">${esc(wf(i))}</b>`:esc(wf(i))}${ac(i.id).resp?`<br><span style="font-size:10px;color:var(--muted)">${esc(ac(i.id).resp)}</span>`:''}</td>
      <td class="r">${(ac(i.id).obs||[]).length||'<span class="vz">—</span>'}</td>
      <td>${esc(i.mesCom||'—')}</td>
      <td>${esc(i.mesRep||'—')}</td>
      <td class="r">${i.ano}</td></tr>`;});

  document.getElementById('ctab').innerHTML=
   `<thead><tr>${H.map((t,k)=>`<th class="${NUM.includes(k)?'r':''}">${t}</th>`).join('')}</tr></thead>
    <tbody>${corpo||`<tr><td colspan="${H.length}" style="text-align:center;padding:40px;color:var(--muted)">Nenhuma repactuação com esse recorte.</td></tr>`}</tbody>
    <tfoot><tr><td>TOTAL</td><td colspan="4">${L.length} repactuações</td>
      <td class="r">${brl(soma(L,i=>i.m2))}</td><td></td><td class="r">${brl(va)}</td>
      <td></td><td class="r">${brl(vAlvo)}</td><td></td><td class="r">${brl(vRep)}</td>
      <td colspan="6"></td></tr></tfoot>`;
  document.querySelectorAll('#ctab tbody tr[data-id]').forEach(r=>r.onclick=()=>{
    const it=IT.find(x=>x.id===r.dataset.id); if(!it) return;
    ANO=it.ano; SEL=it.id; SOPEND=false; TELA='ano';
    CONSABERTO=false; jSet('rp_consAberto',false); modoCons(false);
    document.getElementById('vHome').classList.remove('on');
    document.getElementById('vAno').classList.add('on');
    window.scrollTo({top:0,behavior:'smooth'}); renderAno();
  });
}
document.getElementById('cFechar').onclick=fecharConsolidado;
document.getElementById('cVoltar2').onclick=fecharConsolidado;
document.getElementById('cq').oninput=e=>{CFIL.q=e.target.value;renderCons();};
document.getElementById('cCsv').onclick=()=>{
  const L=consFiltrado();
  const H=['Ano','Data','Cliente','Prazo','Sala','Local','Vaga garagem','M2 priv','R$/m2 atual','Valor atual',
           'R$/m2 alvo','Valor alvo','R$/m2 repact','Valor repactuado','% reaj','Status','Com','Rep'];
  const R2=L.map(i=>[i.ano,dbr(i.data),i.cliente,i.prazo,i.unidade,i.sig,i.gar||'',i.m2??'',
    rm2(i)?rm2(i).toFixed(2):'',i.valor??'',alvoM2(i)?alvoM2(i).toFixed(2):'',alvoVal(i)?alvoVal(i).toFixed(2):'',
    i.rm2Rep??'',i.valorRep??'',i.pct!=null?(i.pct*100).toFixed(1):'',i.status,i.mesCom||'',i.mesRep||'']);
  const csv=[H,...R2].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
  a.download='consolidado-repactuacoes-cena.csv';a.click();toast(`${L.length} linhas exportadas`);};


/* ============================================================
   Sessão, carregamento e inicialização
   ============================================================ */
function pintaSessao(){
  const txt = DB.online
    ? `<b>${esc(DB.usuario?DB.usuario.nome:'')}</b><span class="tag2 ${DB.podeEditar()?'':'ro'}">${DB.podeEditar()?'edição':'somente leitura'}</span><button id="bSair">Sair</button>`
    : `<span class="tag2 off">modo local</span><span>alterações salvas só neste computador</span>`;
  document.querySelectorAll('.sess').forEach(el=>el.innerHTML=txt);
  document.querySelectorAll('#bSair').forEach(b=>b.onclick=async()=>{ await DB.sair(); location.reload(); });
  document.body.classList.toggle('somenteleitura', DB.online && !DB.podeEditar());
}

async function carregarTudo(){
  const d = await DB.carregar();
  if(d.vazio){ mostrarLogin('Não foi possível falar com o banco de dados. Verifique a conexão e tente novamente.'); return; }
  IT=d.itens; SEM=d.sem; EMPN=d.empresas; EMPCOR=d.cores||{}; HOJE=d.hoje;
  sim=d.sim||{}; acomp=d.acomp||{};
  IT.forEach(i=>{ if(!i.id) i.id=i.sig+'|'+i.unidade+'|'+i.cliente.slice(0,16)+'|'+i.data; });
  ANOS=[...new Set(IT.map(i=>i.ano))].filter(Boolean).sort();
  ANO=ANOS.find(a=>a>=+String(HOJE).slice(0,4))||ANOS[0];
  ITENS_PARA_RELATORIO();
  pintaSessao();
  document.getElementById('app').style.display='block';
  document.getElementById('login').style.display='none';
  render();
}

/* o módulo de relatório precisa reler as listas depois do carregamento */
let ITENS_PARA_RELATORIO=()=>{};
function registraRelatorio(fn){ ITENS_PARA_RELATORIO=fn; }

function mostrarLogin(msg){
  const l=document.getElementById('login');
  l.style.display='flex';
  document.getElementById('app').style.display='none';
  if(msg){ const e=document.getElementById('loginErro'); e.textContent=msg; e.style.display='block'; }
}

(async function boot(){
  const st = await DB.iniciar();
  if(!st.online){ await carregarTudo(); return; }          // modo local
  if(!st.autenticado){ mostrarLogin(); return; }
  await carregarTudo();
})();

document.getElementById('loginBtn').onclick=async()=>{
  const b=document.getElementById('loginBtn'); b.disabled=true; b.textContent='Entrando…';
  try{
    await DB.entrar(document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
    await carregarTudo();
  }catch(err){
    const e=document.getElementById('loginErro');
    e.textContent = /Invalid login/i.test(err.message||'') ? 'E-mail ou senha incorretos.' : (err.message||'Não foi possível entrar.');
    e.style.display='block';
  }finally{ b.disabled=false; b.textContent='Entrar'; }
};
document.getElementById('loginSenha').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('loginBtn').click(); });
document.getElementById('loginReset').onclick=async()=>{
  const em=document.getElementById('loginEmail').value.trim();
  const e=document.getElementById('loginErro'); e.style.display='block';
  if(!em){ e.textContent='Escreva o e-mail acima e clique novamente.'; return; }
  try{ await DB.redefinirSenha(em); e.textContent='Enviamos um link de redefinição para '+em+'.'; }
  catch(err){ e.textContent=err.message||'Não foi possível enviar o link.'; }
};
