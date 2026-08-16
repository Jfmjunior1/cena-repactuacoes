/* ================== GERADOR DE RELATÓRIO ================== */
const LOGO = new URL('logo.png', location.href).href;
const RODAPE = new URL('rodape.png', location.href).href;
/* Faixas repetidas em toda página impressa: logo no alto à direita, assinatura no rodapé à direita. */
const FAIXA_TOPO = `<div class="phead"><img src="${LOGO}" alt="Cena Empreendimentos"></div>`;
const FAIXA_PE = `<div class="pfoot"><span>Documento interno de uso restrito · dados de locatários protegidos pela LGPD · não distribuir a terceiros.</span><img src="${RODAPE}" alt="Cena Empreendimentos · Av. Osvaldo Rodrigues Cabral, 1570, sala 213 · Centro Empresarial Florianópolis"></div>`;
/* O conteúdo vai dentro do tbody; thead e tfoot são repetidos pelo navegador em cada página. */
const moldura = conteudo => `<table class="pg">
  <thead><tr><td>${FAIXA_TOPO}</td></tr></thead>
  <tfoot><tr><td>${FAIXA_PE}</td></tr></tfoot>
  <tbody><tr><td>${conteudo}</td></tr></tbody></table>`;

const RCOLS=[
 {id:'data',t:'Data da repactuação',v:i=>dbr(i.data)},
 {id:'cliente',t:'Cliente',v:i=>i.cliente},
 {id:'emp',t:'Empreendimento',v:i=>i.emp},
 {id:'sig',t:'Local',v:i=>i.sig},
 {id:'unidade',t:'Unidade',v:i=>curto(i.unidade,60)},
 {id:'gar',t:'Vaga garagem',v:i=>i.gar&&i.gar!=='-'?curto(i.gar,60):''},
 {id:'m2',t:'Área m²',n:1,v:i=>i.m2,f:v=>v?br2(v):'—'},
 {id:'valor',t:'Valor atual',n:1,v:i=>i.valor,f:v=>'R$ '+brl(v)},
 {id:'rm2',t:'R$/m² atual',n:1,v:i=>rm2(i),f:v=>v?'R$ '+br2(v):'—'},
 {id:'meta',t:'R$/m² alvo',n:1,v:i=>alvoM2(i),f:v=>v?'R$ '+br2(v):'—'},
 {id:'valorAlvo',t:'Valor alvo',n:1,v:i=>alvoVal(i),f:v=>v?'R$ '+brl(v):'—'},
 {id:'rm2rep',t:'R$/m² repactuado',n:1,v:i=>i.rm2Rep,f:v=>v?'R$ '+br2(v):'—'},
 {id:'vrep',t:'Valor repactuado',n:1,v:i=>i.valorRep,f:v=>v!=null?'R$ '+brl(v):'—'},
 {id:'status',t:'Status',v:i=>i.status},
 {id:'mesRep',t:'Mês da repactuação',v:i=>i.mesRep||'—'},
 {id:'prev',t:'Valor previsto',n:1,v:i=>prev(i),f:v=>'R$ '+brl(v)},
 {id:'dif',t:'Diferença mensal',n:1,v:i=>dif(i),f:v=>(v>0?'+':'')+'R$ '+brl(v)},
 {id:'pct',t:'% de reajuste',n:1,v:i=>i.valor?dif(i)/i.valor*100:null,f:v=>v==null?'—':v.toFixed(1).replace('.',',')+'%'},
 {id:'anual',t:'Impacto anual',n:1,v:i=>dif(i)*12,f:v=>(v>0?'+':'')+'R$ '+brl(v)},
 {id:'mesCom',t:'Mês de contato',v:i=>i.mesCom+'/'+String(i.ano).slice(2)},
 {id:'ini',t:'Início do contrato',v:i=>dbr(i.ini)},
 {id:'fim',t:'Fim do contrato',v:i=>dbr(i.fim)},
 {id:'prazo',t:'Vigência',v:i=>i.prazo==='Indet.'?'Indeterminada':i.prazo},
 {id:'ult',t:'Última repactuação',v:i=>i.ult&&String(i.ult).includes('-')?dbr(i.ult):'—'},
 {id:'vista',t:'Vista',v:i=>i.vista||'—'},
 {id:'locador',t:'Locador',v:i=>i.locador||'—'},
 {id:'sit',t:'Situação',v:i=>i.sit},
 {id:'simul',t:'Simulado',v:i=>sim[i.id]!=null?'Sim':'Não'},
 {id:'criterio',t:'Critério da data',v:i=>i.origem},
];
const RSECS=[
 {id:'resumo',t:'Resumo executivo',d:'Totais de contratos, área, valor atual, previsto e diferença'},
 {id:'porAno',t:'Consolidado por ano',d:'Uma linha por ano do recorte'},
 {id:'porEmp',t:'Consolidado por empreendimento',d:'Uma linha por edifício, com subtotais'},
 {id:'detalhe',t:'Detalhamento dos contratos',d:'Tabela contrato a contrato, agrupada por empreendimento'},
 {id:'metas',t:'Metas de R$/m² adotadas',d:'Premissa usada no cálculo do valor previsto'},
 {id:'simulacoes',t:'Simulações registradas',d:'Somente os contratos com valor simulado neste painel'},
 {id:'notas',t:'Nota metodológica',d:'Regra dos três anos, fonte dos dados e ressalvas'},
];
const RFMT=[
 {id:'pdf',a:'PDF',b:'abre para impressão / salvar em PDF'},
 {id:'excel',a:'Excel',b:'planilha .xls com o logo e formatação'},
 {id:'csv',a:'CSV',b:'dados puros, separados por ponto e vírgula'},
];
const R_PADRAO={fmt:'pdf',anos:[],sigs:[],
 secs:['resumo','porAno','porEmp','detalhe','notas'],
 cols:['data','cliente','prazo','unidade','sig','m2','rm2','valor','meta','valorAlvo','rm2rep','vrep','pct','status','mesRep']};
let R=Object.assign({},R_PADRAO,jGet('rp_rel',{})||{});
const RUI={emps:false,cols:false};   // blocos recolhidos por padrão

const sigsAll=()=>[...new Set(IT.map(i=>i.sig))].sort((a,b)=>soma(IT.filter(i=>i.sig===b),i=>i.valor)-soma(IT.filter(i=>i.sig===a),i=>i.valor));
const relFiltrado=()=>IT.filter(i=>(!R.anos.length||R.anos.includes(i.ano))&&(!R.sigs.length||R.sigs.includes(i.sig)))
  .sort((a,b)=>a.data<b.data?-1:(a.data>b.data?1:0));

const tick='<span class="bx"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M4 12l5.5 5.5L20 6.5"/></svg></span>';

function montaModal(){
  document.getElementById('mbody').innerHTML=`
   <div class="fset"><h5>Formato do arquivo</h5><div class="opts">
     ${RFMT.map(f=>`<button class="op big ${R.fmt===f.id?'on':''}" data-fmt="${f.id}"><span class="a">${f.a}</span><span class="b2">${f.b}</span></button>`).join('')}
   </div></div>
   <div class="fset"><h5>Anos</h5><div class="opts">
     <button class="op ${!R.anos.length?'on':''}" data-ano="todos">Todos os anos</button>
     ${ANOS.map(a=>`<button class="op ${R.anos.includes(a)?'on':''}" data-ano="${a}">${a} <span style="opacity:.6">(${IT.filter(i=>i.ano===a).length})</span></button>`).join('')}
   </div></div>
   <div class="fset"><h5>Empreendimentos <button class="lnk" data-tog="emps">${RUI.emps?'ocultar':'escolher'}</button></h5>
     <div class="sumline">${R.sigs.length?esc(R.sigs.map(s=>EMPN[s]||s).join(' · ')):'Todos os empreendimentos'}</div>
     ${RUI.emps?`<div class="opts">
       <button class="op ${!R.sigs.length?'on':''}" data-sig="todos">Todos</button>
       ${sigsAll().map(s=>`<button class="op ${R.sigs.includes(s)?'on':''}" data-sig="${s}" title="${esc(EMPN[s]||s)}">${s} <span style="opacity:.6">(${IT.filter(i=>i.sig===s).length})</span></button>`).join('')}
     </div>`:''}</div>
   <div class="fset"><h5>Seções do relatório</h5><div class="opts">
     ${RSECS.map(s=>`<button class="chk ${R.secs.includes(s.id)?'on':''}" data-sec="${s.id}" title="${s.d}">${tick}${s.t}</button>`).join('')}
   </div></div>
   <div class="fset"><h5>Colunas do detalhamento <button class="lnk" data-tog="cols">${RUI.cols?'ocultar':'ajustar'}</button></h5>
     <div class="sumline">${R.cols.length} coluna${R.cols.length>1?'s':''} · ${esc(RCOLS.filter(c=>R.cols.includes(c.id)).slice(0,5).map(c=>c.t).join(', '))}${R.cols.length>5?'…':''}</div>
     ${RUI.cols?`<div class="opts">
       ${RCOLS.map(c=>`<button class="chk ${R.cols.includes(c.id)?'on':''}" data-col="${c.id}">${tick}${c.t}</button>`).join('')}
     </div>
     <div style="display:flex;gap:8px;margin-top:11px">
       <button class="b sm" data-colset="padrao">Colunas padrão</button>
       <button class="b sm" data-colset="todas">Todas</button>
       <button class="b sm" data-colset="minimo">Só o essencial</button>
     </div>`:''}</div>`;

  const mb=document.getElementById('mbody');
  mb.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{RUI[b.dataset.tog]=!RUI[b.dataset.tog];montaModal();});
  mb.querySelectorAll('[data-fmt]').forEach(b=>b.onclick=()=>{R.fmt=b.dataset.fmt;salvaR();montaModal();});
  mb.querySelectorAll('[data-ano]').forEach(b=>b.onclick=()=>{
    const v=b.dataset.ano;
    if(v==='todos') R.anos=[];
    else{const a=+v; R.anos.includes(a)?R.anos=R.anos.filter(x=>x!==a):R.anos.push(a);}
    salvaR();montaModal();});
  mb.querySelectorAll('[data-sig]').forEach(b=>b.onclick=()=>{
    const v=b.dataset.sig;
    if(v==='todos') R.sigs=[];
    else R.sigs.includes(v)?R.sigs=R.sigs.filter(x=>x!==v):R.sigs.push(v);
    salvaR();montaModal();});
  mb.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{
    const v=b.dataset.sec; R.secs.includes(v)?R.secs=R.secs.filter(x=>x!==v):R.secs.push(v);
    salvaR();montaModal();});
  mb.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>{
    const v=b.dataset.col; R.cols.includes(v)?R.cols=R.cols.filter(x=>x!==v):R.cols.push(v);
    salvaR();montaModal();});
  mb.querySelectorAll('[data-colset]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.colset;
    R.cols = k==='todas'?RCOLS.map(c=>c.id)
      : k==='minimo'?['data','cliente','sig','unidade','valor','prev','dif']
      : R_PADRAO.cols.slice();
    salvaR();montaModal();});
  atualizaRes();
}
function salvaR(){ jSet('rp_rel',R); }
function atualizaRes(){
  const L=relFiltrado();
  const va=soma(L,i=>i.valor), vp=soma(L,prev);
  document.getElementById('mres').innerHTML=L.length
   ? `<b>${L.length}</b> repactuações · <b>${R.anos.length?R.anos.slice().sort().join(', '):'todos os anos'}</b> · <b>${R.sigs.length?R.sigs.join(', '):'todos os empreendimentos'}</b><br>
      atual <b>R$ ${brl(va)}</b>/mês · previsto <b>R$ ${brl(vp)}</b>/mês · diferença <b>+R$ ${brl(vp-va)}</b>/mês`
   : 'Nenhum contrato com esse recorte.';
}

/* ---------- construção do documento ---------- */
function docHTML(paraExcel){
  const L=relFiltrado();
  const va=soma(L,i=>i.valor), vp=soma(L,prev), d=vp-va;
  const cols=RCOLS.filter(c=>R.cols.includes(c.id));
  const anosSel=[...new Set(L.map(i=>i.ano))].sort();
  const sigsSel=[...new Set(L.map(i=>i.sig))].sort((a,b)=>soma(L.filter(i=>i.sig===b),i=>i.valor)-soma(L.filter(i=>i.sig===a),i=>i.valor));
  let _n=0; const nSec=()=>++_n;
  const recorte=`${R.anos.length?R.anos.slice().sort().join(', '):`${ANOS[0]} a ${ANOS[ANOS.length-1]}`} · ${R.sigs.length?R.sigs.map(s=>EMPN[s]||s).join(', '):'todos os empreendimentos'}`;
  let s='';

  if(R.secs.includes('resumo')) s+=`
   <h2>${nSec()}. Resumo executivo</h2>
   <table class="kpi"><tr>
     <td><span>Repactuações</span><b>${L.length}</b></td>
     <td><span>Área envolvida</span><b>${brl(soma(L,i=>i.m2))} m²</b></td>
     <td><span>Valor atual</span><b>R$ ${brl(va)}/mês</b></td>
     <td><span>Valor previsto</span><b>R$ ${brl(vp)}/mês</b></td>
     <td><span>Diferença</span><b>+R$ ${brl(d)}/mês</b></td>
     <td><span>Impacto anual</span><b>+R$ ${brl(d*12)}</b></td>
   </tr></table>`;

  if(R.secs.includes('porAno')&&anosSel.length) s+=`
   <h2>${nSec()}. Consolidado por ano</h2>
   <table class="ano"><tr><th>Ano</th><th class="r">Contratos</th><th class="r">Área m²</th><th class="r">Valor atual</th>
     <th class="r">Valor previsto</th><th class="r">Diferença</th><th class="r">%</th></tr>
   ${anosSel.map(a=>{const S=L.filter(i=>i.ano===a),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<tr><td>${a}</td><td class="r">${S.length}</td><td class="r">${brl(soma(S,i=>i.m2))}</td>
       <td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>
       <td class="r">${x?((y-x)/x*100).toFixed(1).replace('.',','):'—'}%</td></tr>`;}).join('')}
   <tr class="tot"><td>Total</td><td class="r">${L.length}</td><td class="r">${brl(soma(L,i=>i.m2))}</td>
     <td class="r">R$ ${brl(va)}</td><td class="r">R$ ${brl(vp)}</td><td class="r">+R$ ${brl(d)}</td>
     <td class="r">${va?((d/va)*100).toFixed(1).replace('.',','):'—'}%</td></tr></table>`;

  if(R.secs.includes('porEmp')&&sigsSel.length) s+=`
   <h2>${nSec()}. Consolidado por empreendimento</h2>
   <table class="ano"><tr><th>Empreendimento</th><th>Sigla</th><th class="r">Contratos</th><th class="r">Área m²</th>
     <th class="r">Valor atual</th><th class="r">Valor previsto</th><th class="r">Diferença</th><th class="r">%</th></tr>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<tr><td>${esc(EMPN[sg]||sg)}</td><td>${sg}</td><td class="r">${S.length}</td><td class="r">${brl(soma(S,i=>i.m2))}</td>
       <td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>
       <td class="r">${x?((y-x)/x*100).toFixed(1).replace('.',','):'—'}%</td></tr>`;}).join('')}
   <tr class="tot"><td colspan="2">Total</td><td class="r">${L.length}</td><td class="r">${brl(soma(L,i=>i.m2))}</td>
     <td class="r">R$ ${brl(va)}</td><td class="r">R$ ${brl(vp)}</td><td class="r">+R$ ${brl(d)}</td>
     <td class="r">${va?((d/va)*100).toFixed(1).replace('.',','):'—'}%</td></tr></table>`;

  if(R.secs.includes('detalhe')&&cols.length) s+=`
   <h2 class="qbr">${nSec()}. Detalhamento dos contratos</h2>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<h3>${esc(EMPN[sg]||sg)} <span class="lt">· ${sg} · ${S.length} contrato${S.length>1?'s':''}</span></h3>
      <table class="ano"><tr>${cols.map(c=>`<th class="${c.n?'r':''}">${c.t}</th>`).join('')}</tr>
      ${S.map(i=>`<tr>${cols.map(c=>{const raw=c.v(i);const txt=c.f?c.f(raw):(raw==null||raw===''?'—':String(raw));
        return `<td class="${c.n?'r':''}">${esc(txt)}</td>`;}).join('')}</tr>`).join('')}
      <tr class="tot">${cols.map((c,k)=>{
        if(k===0) return '<td>Subtotal</td>';
        if(c.id==='m2') return `<td class="r">${brl(soma(S,i=>i.m2))}</td>`;
        if(c.id==='valor') return `<td class="r">R$ ${brl(x)}</td>`;
        if(c.id==='prev') return `<td class="r">R$ ${brl(y)}</td>`;
        if(c.id==='dif') return `<td class="r">+R$ ${brl(y-x)}</td>`;
        if(c.id==='anual') return `<td class="r">+R$ ${brl((y-x)*12)}</td>`;
        if(c.id==='pct') return `<td class="r">${x?((y-x)/x*100).toFixed(1).replace('.',','):'—'}%</td>`;
        return '<td></td>';}).join('')}</tr></table>`;}).join('')}`;

  if(R.secs.includes('simulacoes')){
    const S=L.filter(i=>sim[i.id]!=null);
    s+=`<h2 class="qbr">${nSec()}. Simulações registradas</h2>`+
     (S.length?`<table class="ano"><tr><th>Data</th><th>Cliente</th><th>Local</th><th>Unidade</th><th class="r">Valor atual</th>
       <th class="r">Valor simulado</th><th class="r">Diferença</th><th class="r">%</th></tr>
       ${S.map(i=>`<tr><td>${dbr(i.data)}</td><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(i.unidade)}</td>
         <td class="r">R$ ${brl(i.valor)}</td><td class="r">R$ ${brl(sim[i.id])}</td><td class="r">+R$ ${brl(dif(i))}</td>
         <td class="r">${i.valor?(dif(i)/i.valor*100).toFixed(1).replace('.',','):'—'}%</td></tr>`).join('')}</table>`
     :'<p class="obs">Nenhuma simulação registrada para este recorte. Os valores previstos usam as metas de R$/m².</p>');
  }

  if(R.secs.includes('metas')) s+=`
   <h2>${nSec()}. Valores alvo por empreendimento</h2>
   <table class="ano"><tr><th>Empreendimento</th><th>Sigla</th><th class="r">Contratos com alvo</th><th class="r">R$/m² alvo médio</th>
     <th class="r">R$/m² médio atual</th><th class="r">Defasagem</th></tr>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg), CA=S.filter(i=>alvoM2(i)!=null);
     const med=soma(S,i=>i.valor)/(soma(S,i=>i.m2)||1);
     const meta=CA.length?soma(CA,i=>alvoM2(i))/CA.length:null;
     return `<tr><td>${esc(EMPN[sg]||sg)}</td><td>${sg}</td><td class="r">${CA.length} de ${S.length}</td>
       <td class="r">${meta?'R$ '+br2(meta):'a definir'}</td>
       <td class="r">R$ ${br2(med)}</td><td class="r">${meta&&med?((meta/med-1)*100).toFixed(1).replace('.',',')+'%':'—'}</td></tr>`;}).join('')}</table>
   <p class="obs">O valor alvo só está definido onde o Comercial já fixou a meta — hoje, apenas no plano de 2026. Nos anos seguintes o campo permanece em branco até a definição, e o valor previsto repete o valor atual. Premissa interna de trabalho; não representa proposta formal ao locatário.</p>`;

  if(R.secs.includes('notas')) s+=`
   <h2 class="qbr">${nSec()}. Nota metodológica</h2>
   <p class="obs"><b>Regra aplicada:</b> repactuação a cada três anos, contada a partir da última ou da próxima renegociação registrada no controle de locações, projetada até o fim da vigência de cada contrato. Contratos com vigência vencida e prorrogada por prazo indeterminado aparecem como “Indeterminada” e tiveram dois ciclos projetados.<br><br>
   <b>Valor previsto:</b> corresponde ao valor efetivamente repactuado quando a negociação já foi fechada; ao valor simulado neste painel quando houver simulação; ao valor alvo definido pelo Comercial quando houver; e, na falta de todos, repete o valor atual — caso dos anos ainda sem definição de meta.<br><br>
   <b>Fonte:</b> planilha “Controle Contratos de Locação 2023 / 2024 / 2025 e 2026”, aba “Consolidado - Imóveis”, posição em ${dbr(HOJE)}. Minutas e aditivos no SharePoint; tratativas registradas no ClickUp.<br><br>
   <b>Confidencialidade:</b> documento interno da Cena Empreendimentos. Contém dados de locatários protegidos pela LGPD — não distribuir a terceiros. Alterações societárias, de garantia ou de fiança devem ser validadas com a Diretoria.</p>`;

  const estilo = ESTILO_REL(paraExcel);
  /* Mesma capa executiva do relatório mensal, mas com os números do recorte
     escolhido no modal — nunca os da carteira inteira, para não dizer à
     Diretoria uma coisa na capa e outra nas tabelas. */
  const capa = paraExcel ? '' : capaHTML(capaRecorte(L, recorte));

  return `<html><head><meta charset="utf-8"><title>Repactuações de locação — Cena Empreendimentos</title>
  <style>${estilo}</style></head><body>
  ${capa}
  ${moldura(`${paraExcel?`<div class="cab">
    <div><div class="ov">Relatório interno · Gestão de locações</div>
      <h1>Planejamento de repactuações</h1>
      <div class="s">${esc(recorte)}</div></div>
    <div class="dt">Posição em ${dbr(HOJE)}<br>${L.length} contrato${L.length>1?'s':''} no recorte<br>Emitido por ${esc(DB.usuario?DB.usuario.nome:'painel interno')}</div>
  </div>`:`<div class="cap"><b>${esc(recorte)}</b><b>${L.length} repactuações</b><b>R$ ${brl(va)}/mês</b><b>+R$ ${brl(d)}/mês previstos</b></div>`}${s}`)}
  </body></html>`;
}

/* Monta os dados da capa a partir do recorte de repactuações selecionado. */
function capaRecorte(L, recorte){
  const idc = i => i.id.slice(0, i.id.lastIndexOf('|'));
  const contratos = [...new Set(L.map(idc))].length;
  const emps = [...new Set(L.map(i=>i.sig))].length;
  const anosSel = [...new Set(L.map(i=>i.ano))].sort();
  const ind = i => i.prazo==='Indet.' || !i.fim || i.fim<HOJE;
  const D = L.filter(i=>!ind(i)), I = L.filter(ind);
  const area = soma(L,i=>i.m2), va = soma(L,i=>i.valor), vp = soma(L,prev);
  const fe = L.filter(feito), and = L.filter(emAndamento);
  const pct = (x,t) => t ? (x/t*100).toFixed(1).replace('.',',')+'%' : '—';
  return {
    ov:'Relatório personalizado · Gestão de locações',
    tit:'Planejamento de repactuações',
    sub:'Recorte selecionado no painel: '+recorte,
    badge:'Repactuações do recorte',
    ref: recorte.length>46 ? recorte.slice(0,44)+'…' : recorte,
    autor: DB.usuario?DB.usuario.nome:'painel interno',
    side:[['Recorte', anosSel.length?anosSel.join(', '):'todos os anos'],
          ['Repactuações', L.length],
          ['Contratos', contratos+' contratos'],
          ['Empreendimentos', emps]],
    kpis:[['Repactuações no recorte', L.length+''],
          ['Contratos envolvidos', contratos+' contratos'],
          ['Área envolvida', brl(area)+' m²'],
          ['Valor atual', 'R$ '+brl(va)+'/mês'],
          ['Diferença prevista', '+R$ '+brl(vp-va)+'/mês']],
    contratos: L.length, emps: emps, locadas: contratos, unidades: contratos,
    receita: va, areaOc: area, areaDet: soma(D,i=>i.m2), areaInd: soma(I,i=>i.m2),
    areaVaga: 0, vagas: 0,
    pctDet: pct(soma(D,i=>i.m2), area), pctInd: pct(soma(I,i=>i.m2), area),
    nDet: D.length, nInd: I.length,
    recDet: soma(D,i=>i.valor), recInd: soma(I,i=>i.valor),
    pctRecDet: pct(soma(D,i=>i.valor), va), pctRecInd: pct(soma(I,i=>i.valor), va),
    plano: L.length, feitas: fe.length, andamento: and.length,
    pend: L.length - fe.length - and.length,
    pctPlano: pct(fe.length, L.length), pctAnd: pct(and.length, L.length),
    pctPend: pct(L.length-fe.length-and.length, L.length),
    ganho: soma(fe,dif), aGanhar: soma(L.filter(i=>!feito(i)),dif),
    tComp:'Composição do recorte', tPlano:'Andamento das repactuações',
    tBars:'Repactuações por ano do recorte',
    rotDet:'Dentro do prazo de contrato', rotInd:'Prazo indeterminado',
    rotTot:'Total do recorte', rotAnel:'m² no recorte',
    nComp:`${L.length} repactuações de ${contratos} contrato${contratos===1?'':'s'} em ${emps} empreendimento${emps===1?'':'s'}.`,
    nSit:`O valor atual do recorte equivale a R$ ${brl(va*12)} ao ano.`,
    anos: anosSel.map(a=>{const S=L.filter(i=>i.ano===a);
      return {ano:a, n:S.length, atual:soma(S,i=>i.valor),
              dif:Math.max(0, soma(S,prev)-soma(S,i=>i.valor))};})
  };
}

const ESTILO_REL = paraExcel => `
   *,*::before,*::after{-webkit-print-color-adjust:exact;print-color-adjust:exact}
   body{font-family:'Plus Jakarta Sans',Calibri,Arial,sans-serif;color:#1b2b38;background:#fff;
     max-width:1080px;margin:${paraExcel?'0':'34px auto'};padding:${paraExcel?'12px':'0 26px'}}
   .cab{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:3px solid #1c3a52;padding-bottom:14px;margin-bottom:6px}
   .cab img{height:52px}
   .cab .ov{font-family:Arial,sans-serif;font-size:9.4px;letter-spacing:.18em;text-transform:uppercase;color:#c0762c}
   .cab h1{font-size:24px;margin:5px 0 3px;color:#1c3a52;font-family:Arial,sans-serif}
   .cab .s{font-family:Arial,sans-serif;font-size:11px;color:#7f8b95}
   .cab .dt{font-family:Arial,sans-serif;font-size:10.4px;color:#7f8b95;text-align:right;line-height:1.7}
   h2{font-family:Arial,sans-serif;font-size:13px;color:#1c3a52;margin:26px 0 9px;border-bottom:2px solid #1c3a52;padding-bottom:5px;letter-spacing:.02em}
   h3{font-family:Arial,sans-serif;font-size:11.6px;color:#1c3a52;margin:18px 0 6px}
   h3 .lt{font-weight:400;color:#7f8b95;font-size:10.4px}
   table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:10.4px;margin-bottom:8px}
   th{background:#1c3a52;color:#fff;padding:6px 7px;text-align:left;font-size:9px;letter-spacing:.05em;text-transform:uppercase;font-weight:bold;border:1px solid #1c3a52}
   td{padding:5px 7px;border:1px solid #e4dccf}
   td.r,th.r{text-align:right;white-space:nowrap}
   td.ctr,th.ctr{text-align:center;white-space:nowrap}
   tr:nth-child(even) td{background:#faf7f2}
   tr.tot td{background:#f6e7d2;font-weight:bold;border-top:2px solid #c0762c}
   table.kpi td{border:0;border-left:3px solid #c0762c;padding:4px 14px 4px 11px;background:#fff!important;vertical-align:top}
   table.kpi span{display:block;font-size:8.8px;color:#7f8b95;text-transform:uppercase;letter-spacing:.09em}
   table.kpi b{font-size:16px;color:#1c3a52}
   .obs{font-family:Arial,sans-serif;font-size:10px;color:#5b6772;line-height:1.75;background:#faf7f2;border-left:3px solid #c0762c;padding:11px 13px;margin:8px 0 0}
   .rod{margin-top:30px;border-top:1px solid #e4dccf;padding-top:10px;font-family:Arial,sans-serif;font-size:9.4px;color:#7f8b95;line-height:1.7}
   .cap{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 2px}
   .cap b{font-family:Arial,sans-serif;font-size:10px;font-weight:normal;color:#5b6772;background:#faf7f2;border:1px solid #e4dccf;border-radius:3px;padding:4px 9px}
   .sub{font-family:Arial,sans-serif;font-size:10.6px;color:#5b6772;margin:0 0 9px;line-height:1.6}
   .tag{font-family:Arial,sans-serif;font-size:8.6px;letter-spacing:.04em;text-transform:uppercase;padding:2px 6px;border-radius:3px;border:1px solid #d9cfc0;color:#5b6772;white-space:nowrap}
   .tag.ok{background:#e8f2ec;border-color:#bcd9c9;color:#2f7d5b}
   .tag.at{background:#fbf0e2;border-color:#e8cfa9;color:#a5651f}
   .tag.no{background:#f2f0ee;border-color:#ddd6cd;color:#7f8b95}
   /* ---------- capa executiva ---------- */
   .capa{display:flex;gap:0;height:176mm;background:#fdfaf5;font-family:Arial,sans-serif;margin-bottom:14px}
   .cside{width:50mm;flex:0 0 50mm;background:#1c3a52;color:#fff;padding:9mm 7mm;display:flex;flex-direction:column;position:relative;overflow:hidden}
   .clogo{width:28mm;filter:brightness(0) invert(1);margin-bottom:8mm}
   .cinfo .ci{border-top:1px solid rgba(255,255,255,.22);padding:3.6mm 0 0;margin-bottom:3.6mm}
   .cinfo .ci span{display:block;font-size:8.4px;letter-spacing:.14em;text-transform:uppercase;color:#a8c0d2}
   .cinfo .ci b{display:block;font-size:12.5px;font-weight:normal;margin-top:2px}
   .cfoot{margin-top:auto;font-size:8.6px;color:#a8c0d2;line-height:1.7;position:relative;z-index:2}
   .cart{position:absolute;left:0;bottom:-6mm;width:52mm;opacity:.28}
   .cmain{flex:1;padding:9mm 9mm 6mm;display:flex;flex-direction:column;min-width:0}
   .chead{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;margin-bottom:5mm}
   .cov{font-size:9.4px;letter-spacing:.18em;text-transform:uppercase;color:#c0762c}
   .ctit{font-size:31px;color:#1c3a52;margin:4px 0 0;font-weight:bold;letter-spacing:-.4px}
   .crule{width:16mm;height:2px;background:#1c3a52;margin:4mm 0 3mm}
   .csub{font-size:10.4px;color:#5b6772;margin:0;max-width:120mm;line-height:1.5}
   .cbadge{border:1.5px solid #c0762c;border-radius:4px;padding:5mm 7mm;text-align:center;flex:0 0 auto}
   .cbn{font-size:26px;color:#1c3a52;font-weight:bold;line-height:1}
   .cbn span{font-size:14px;font-weight:normal}
   .cbl{font-size:14px;color:#1c3a52;margin-top:1mm}
   .cbf{font-size:7.8px;letter-spacing:.13em;text-transform:uppercase;color:#c0762c;margin-top:3mm}
   .ckpi{display:flex;border:1px solid #dfe6ec;border-left:3px solid #c0762c;background:#fff;margin-bottom:4mm}
   .ck{flex:1;padding:4mm 4mm;border-left:1px solid #eef2f5}
   .ck:first-child{border-left:0}
   .ck span{display:block;font-size:7.8px;letter-spacing:.11em;text-transform:uppercase;color:#7f8b95}
   .ck b{display:block;font-size:15px;color:#1c3a52;margin-top:2mm}
   .cgrid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm;flex:1;min-height:0}
   .cbox{border:1px solid #dfe6ec;background:#fff;padding:3.5mm 4.5mm;display:flex;flex-direction:column;overflow:hidden;min-height:0}
   .cbox h3{font-size:12.4px;color:#1c3a52;margin:0 0 3mm;font-weight:bold}
   .cbox.cop h3{color:#a5651f}
   .cflex{display:flex;align-items:center;gap:5mm}
   .anel{width:26mm;height:26mm;flex:0 0 26mm}
   .anelN{font-size:19px;font-weight:bold;fill:#1c3a52;font-family:Arial}
   .anelS{font-size:9px;fill:#7f8b95;font-family:Arial}
   .cop .anelN{fill:#c0762c}
   .cmini{flex:1;border-collapse:collapse;font-size:9.6px}
   .cmini td{padding:2.4mm 0;border-bottom:1px solid #eef2f5;color:#3d4a55}
   .cmini td.r{text-align:right;white-space:nowrap}
   .cmini td.cop{color:#c0762c}
   .cmini tr.t td{font-weight:bold;color:#1c3a52;border-bottom:0;border-top:1px solid #dfe6ec}
   .cmini i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
   .ctab{width:100%;border-collapse:collapse;font-size:9.4px}
   .ctab th{background:none;color:#7f8b95;border:0;border-bottom:1px solid #dfe6ec;padding:0 0 2mm;
     font-size:7.6px;letter-spacing:.1em;text-transform:uppercase;text-align:left}
   .ctab td{border:0;border-bottom:1px solid #f0f3f6;padding:2.6mm 0;background:#fff!important;color:#3d4a55}
   .ctab .r{text-align:right}
   .ctab tr.t td{background:#1c3a52!important;color:#fff;font-weight:bold;padding:2.6mm 2mm;border:0}
   .cnota{font-size:8.6px;color:#7f8b95;line-height:1.55;margin:auto 0 0;padding-top:3mm;background:none;border:0}
   .cnota.cbar{background:#fbf2e6;border-left:2px solid #c0762c;padding:2.5mm 3mm;color:#5b6772}
   .cbars{display:flex;gap:2.5mm;align-items:flex-end;flex:1;min-height:0;padding-top:1mm}
   .cb{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
   .cbv{font-size:8px;color:#1c3a52;margin-bottom:1mm;white-space:nowrap}
   .cbw{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;min-height:0}
   .cbw .col{width:60%;display:flex;flex-direction:column;justify-content:flex-end;min-height:2px}
   .cbw i{display:block;width:100%;background:#1c3a52;min-height:1px}
   .cbw i.d{background:#c0762c;border-radius:2px 2px 0 0}
   .cbx{font-size:8.6px;color:#3d4a55;margin-top:1.5mm}
   .cbq{font-size:7.6px;color:#a0a9b1}
   .cbottom{margin-top:4mm;border-top:1px solid #dfe6ec;padding-top:3mm;font-size:8.4px;color:#7f8b95}
   /* moldura que se repete em toda página impressa: thead e tfoot são reimpressos pelo navegador */
   table.pg{width:100%;border-collapse:collapse;margin:0}
   table.pg>thead>tr>td,table.pg>tfoot>tr>td,table.pg>tbody>tr>td{border:0;padding:0;background:#fff!important}
   .band{font-family:Arial,sans-serif;font-size:11.6px;font-weight:bold;color:#fff;letter-spacing:.04em;
     padding:7px 11px;margin:18px 0 0;display:flex;justify-content:space-between;align-items:baseline;gap:16px}
   .band span{font-weight:normal;font-size:9.4px;letter-spacing:.08em;text-transform:uppercase;opacity:.82}
   .phead{display:flex;justify-content:flex-end;align-items:center;padding-bottom:9px}
   .phead img{height:40px}
   .pfoot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
     border-top:1px solid #e4dccf;padding-top:9px;margin-top:22px}
   .pfoot span{font-family:Arial,sans-serif;font-size:8.8px;color:#7f8b95;line-height:1.6;max-width:520px}
   .pfoot img{height:26px;width:auto}
   table.loc{table-layout:fixed;font-size:9.4px}
   table.loc td{word-break:break-word}
   table.loc th{font-size:8.2px;padding:5px 5px;white-space:normal;line-height:1.3}
   table.loc th.r{white-space:normal}
   table.loc td{padding:4px 5px}
   table.ano{font-size:9.6px}
   table.ano th{font-size:8.4px;padding:4px 6px}
   table.ano td{padding:3.2px 6px}
   @media print{
     @page{size:A4 landscape;margin:11mm 12mm 9mm}
     /* imprime as cores de fundo mesmo com "gráficos de segundo plano" desmarcado */
     *,*::before,*::after{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
     body{max-width:none;margin:0;padding:0}
     .phead img{height:12mm}
     .pfoot{margin-top:10px}
     .pfoot img{height:9mm}
     .capa{page-break-after:always;height:176mm;margin:0}
     h2{page-break-after:avoid} h3{page-break-after:avoid}
     table{page-break-inside:auto} tr{page-break-inside:avoid}
     table.pg>tbody>tr{page-break-inside:auto}
     .qbr{page-break-before:always}}`;

/* ================== RELATÓRIO MENSAL DA DIRETORIA ==================
   Formato fixo, definido a partir do pedido da Diretoria (e-mail de 28/07/2026):
   visão única da carteira, o que está em prazo de contrato e o que está por
   prazo indeterminado, e a listagem de todos os locatários com a situação de cada. */

const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesExt=iso=>{const p=String(iso).split('-');return `${MESES[+p[1]-1]} de ${p[0]}`;};
const refArq=iso=>{const p=String(iso).split('-');return `${p[0]}-${p[1]}`;};
const isData=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const curto=(s,n)=>{s=String(s==null?'':s);return s.length>(n||58)?s.slice(0,(n||58)-2)+'…':s;};

/* Uma linha por contrato (57), e não por ciclo de repactuação (80). */
function contratos(){
  const m=new Map();
  IT.concat(SEM).forEach(i=>{
    const k=`${i.sig}|${i.cliente}|${i.unidade}`;
    if(!m.has(k)) m.set(k,{b:i,cic:[]});
    if(i.ano) m.get(k).cic.push(i);
  });
  return [...m.values()].map(({b,cic})=>{
    cic.sort((x,y)=>x.data<y.data?-1:1);
    const conc=cic.filter(feito);
    const pend=cic.filter(i=>!feito(i));
    const nome=String(b.cliente||'');
    const proprio=/^(cena|du lac)/i.test(nome)||/cena\/du lac/i.test(nome);
    const vago=/^vago/i.test(nome)||/passado para/i.test(nome)||b.valor===0;
    const junto=b.valor==null&&!proprio&&!vago;   // valor lançado no contrato da unidade principal
    const indet=b.prazo==='Indet.'||!b.fim||b.fim<HOJE;
    return {
      sig:b.sig, emp:b.emp, cliente:b.cliente, unidade:b.unidade, gar:b.gar,
      m2:b.m2, valor:b.valor, ini:b.ini, fim:b.fim, prazo:b.prazo,
      locador:b.locador, obs:b.sit, indet, vista:b.vista||'',
      ultRep: conc.length?conc[conc.length-1].data:(isData(b.ult)?b.ult:null),
      proxRep: pend.length?pend[0].data:null,
      proxAno: pend.length?pend[0].ano:null,
      andamento: pend.some(emAndamento),
      ocupada: !vago&&!proprio,
      situacao: proprio?'Uso próprio':(vago?'Unidade vaga':(junto?'A confirmar':(pend.length?'Locado':'Sem previsão'))),
      classe: (proprio||vago)?'no':(junto?'at':'ok')
    };
  }).sort((a,b)=>a.sig===b.sig?String(a.unidade).localeCompare(String(b.unidade),'pt-BR'):a.sig.localeCompare(b.sig));
}

/* ---------- capa executiva (página 1) ---------- */
function anelSVG(pct, cor, fundo, texto, sub){
  const r=52, circ=2*Math.PI*r, on=circ*Math.max(0,Math.min(1,pct));
  return `<svg viewBox="0 0 130 130" class="anel">
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="${fundo}" stroke-width="15"/>
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="${cor}" stroke-width="15"
      stroke-dasharray="${on.toFixed(1)} ${(circ-on).toFixed(1)}" stroke-linecap="butt"
      transform="rotate(-90 65 65)"/>
    <text x="65" y="63" text-anchor="middle" class="anelN">${texto}</text>
    <text x="65" y="79" text-anchor="middle" class="anelS">${sub}</text></svg>`;
}
function capaHTML(d){
  const maxImp = Math.max(1, ...d.anos.map(a=>a.atual + a.dif));
  /* Textos e blocos com valor padrão: o relatório mensal usa o padrão,
     o personalizado sobrescreve com os números do recorte escolhido. */
  const side = d.side || [['Referência',d.ref],['Unidades',d.unidades],
    ['Contratos',d.contratos+' contratos'],['Empreendimentos',d.emps]];
  const kpis = d.kpis || [['Receita mensal contratada','R$ '+brl(d.receita)],
    ['Contratos ativos',d.contratos+' contratos'],['Área locada',brl(d.areaOc)+' m²'],
    ['Unidades locadas',d.locadas+' unidades'],['Empreendimentos',d.emps+' empreend.']];
  return `<section class="capa">
  <aside class="cside">
    <img class="clogo" src="${LOGO}" alt="Cena Empreendimentos">
    <div class="cinfo">
      ${side.map(([k,v])=>`<div class="ci"><span>${esc(String(k))}</span><b>${esc(String(v))}</b></div>`).join('')}
    </div>
    <div class="cfoot">Emitido em ${dbr(HOJE)}<br>Por ${esc(d.autor)}</div>
    <svg class="cart" viewBox="0 0 200 150" fill="none" stroke="#7f9cb3" stroke-width="1.4">
      <path d="M14 148V64l30-16 30 16v84M44 48V26M74 92h44v56M118 92l34-18 34 18v56M86 108h14M86 124h14"/>
      <path d="M26 82h14M26 100h14M26 118h14M50 82h14M50 100h14M50 118h14M130 108h14M160 108h14M130 126h14M160 126h14"/>
    </svg>
  </aside>
  <div class="cmain">
    <header class="chead">
      <div>
        <div class="cov">${esc(d.ov||'Relatório mensal · Diretoria')}</div>
        <h1 class="ctit">${esc(d.tit||'Locações e Repactuações')}</h1>
        <div class="crule"></div>
        <p class="csub">${esc(d.sub||'Visão executiva da carteira de locações: contratos, receita, área e andamento das repactuações.')}</p>
      </div>
      <div class="cbadge">
        <div class="cbn">${d.feitas} <span>de ${d.plano}</span></div>
        <div class="cbl">concluídas</div>
        <div class="cbf">${esc(d.badge||'Plano anual de repactuações')}</div>
      </div>
    </header>

    <div class="ckpi">
      ${kpis.map(([k,v])=>`<div class="ck"><span>${esc(String(k))}</span><b>${esc(String(v))}</b></div>`).join('')}
    </div>

    <div class="cgrid">
      <div class="cbox">
        <h3>${esc(d.tComp||'Composição da carteira')}</h3>
        <div class="cflex">
          ${anelSVG(d.areaDet/(d.areaOc||1), '#1c3a52', '#c3d2dd', brl(d.areaOc), d.rotAnel||'m² locados')}
          <table class="cmini">
            <tr><td><i style="background:#1c3a52"></i>${esc(d.rotDet||'Dentro do prazo')}</td><td class="r">${brl(d.areaDet)} m²</td><td class="r">${d.pctDet}</td></tr>
            <tr><td><i style="background:#c3d2dd"></i>${esc(d.rotInd||'Prazo indeterminado')}</td><td class="r">${brl(d.areaInd)} m²</td><td class="r">${d.pctInd}</td></tr>
            <tr class="t"><td>${esc(d.rotTot||'Total locado')}</td><td class="r">${brl(d.areaOc)} m²</td><td class="r">100,0%</td></tr>
          </table>
        </div>
        <p class="cnota">${d.nComp||`Fora da carteira locada há ${d.vagas} unidade${d.vagas===1?'':'s'} vaga${d.vagas===1?'':'s'} ou em uso próprio, somando ${brl(d.areaVaga)} m².`}</p>
      </div>

      <div class="cbox cop">
        <h3>${esc(d.tPlano||'Plano anual de repactuações')}</h3>
        <div class="cflex">
          ${anelSVG(d.feitas/(d.plano||1), '#c0762c', '#f2ddc2', d.pctPlano, 'concluído')}
          <table class="cmini">
            <tr><td>Concluídas</td><td class="r">${d.feitas} repactuações</td><td class="r">${d.pctPlano}</td></tr>
            <tr><td>Em andamento</td><td class="r">${d.andamento} repactuações</td><td class="r cop">${d.pctAnd}</td></tr>
            <tr><td>Pendentes</td><td class="r">${d.pend} repactuações</td><td class="r cop">${d.pctPend}</td></tr>
          </table>
        </div>
        <p class="cnota cbar">Ganho já obtido <b>+R$ ${brl(d.ganho)}/mês</b> · ainda a obter <b>+R$ ${brl(d.aGanhar)}/mês</b></p>
      </div>

      <div class="cbox">
        <h3>Situação da vigência</h3>
        <table class="ctab">
          <tr><th>Situação</th><th class="r">Contratos</th><th class="r">Área m²</th><th class="r">Receita</th><th class="r">%</th></tr>
          <tr><td>Dentro do prazo de contrato</td><td class="r">${d.nDet}</td><td class="r">${brl(d.areaDet)}</td><td class="r">${brl(d.recDet)}</td><td class="r">${d.pctRecDet}</td></tr>
          <tr><td>Prorrogado por prazo indeterminado</td><td class="r">${d.nInd}</td><td class="r">${brl(d.areaInd)}</td><td class="r">${brl(d.recInd)}</td><td class="r">${d.pctRecInd}</td></tr>
          <tr class="t"><td>Total</td><td class="r">${d.contratos}</td><td class="r">${brl(d.areaOc)}</td><td class="r">${brl(d.receita)}</td><td class="r">100,0%</td></tr>
        </table>
        <p class="cnota">${d.nSit||`A receita contratada equivale a R$ ${brl(d.receita*12)} ao ano.`}</p>
      </div>

      <div class="cbox">
        <h3>${esc(d.tBars||'Impacto das repactuações por ano')}</h3>
        <div class="cbars">
          ${d.anos.map(a=>`<div class="cb">
             <div class="cbv">${brl((a.atual+a.dif)/1000)} mil</div>
             <div class="cbw"><div class="col" style="height:${(((a.atual+a.dif)/maxImp)*100).toFixed(1)}%">
               ${a.dif?`<i class="d" style="flex:${a.dif.toFixed(0)}"></i>`:''}
               <i style="flex:${Math.max(1,a.atual).toFixed(0)}"></i></div></div>
             <div class="cbx">${a.ano}</div>
             <div class="cbq">${a.n} contrato${a.n===1?'':'s'}</div></div>`).join('')}
        </div>
        <p class="cnota">Barra escura: receita mensal dos contratos que vencem ciclo no ano. Barra cobre: ganho previsto, presente apenas onde o Comercial já definiu meta.</p>
      </div>
    </div>
  </div></section>`;
}

function docMensal(){
  const C=contratos();
  const oc=C.filter(c=>c.ocupada);
  const vagas=C.filter(c=>!c.ocupada);
  const det=oc.filter(c=>!c.indet), ind=oc.filter(c=>c.indet);
  const rec=soma(oc,c=>c.valor), area=soma(C,c=>c.m2), areaOc=soma(oc,c=>c.m2);
  const ANO_C=+String(HOJE).slice(0,4);
  const doAnoC=IT.filter(i=>i.ano===ANO_C);
  const fe=doAnoC.filter(feito), pe=doAnoC.filter(i=>!feito(i));
  const ganho=soma(fe,dif), aGanhar=soma(pe,dif);
  const emAnd=IT.filter(emAndamento).sort((a,b)=>a.data<b.data?-1:1);
  const futuros=ANOS.filter(a=>a>ANO_C);
  const sigs=[...new Set(C.map(c=>c.sig))].sort((a,b)=>soma(C.filter(c=>c.sig===b),c=>c.valor)-soma(C.filter(c=>c.sig===a),c=>c.valor));
  const pc=n=>rec?(n/rec*100).toFixed(1).replace('.',',')+'%':'—';
  const pctA=(x,t)=>t?(x/t*100).toFixed(1).replace('.',',')+'%':'—';
  const andN=doAnoC.filter(emAndamento).length;
  const capa=capaHTML({
    ref: mesExt(HOJE), autor: DB.usuario?DB.usuario.nome:'painel interno',
    unidades: C.length, contratos: oc.length, locadas: oc.length, emps: sigs.length,
    receita: rec, areaOc: areaOc, areaVaga: area-areaOc, vagas: vagas.length,
    areaDet: soma(det,c=>c.m2), areaInd: soma(ind,c=>c.m2),
    pctDet: pctA(soma(det,c=>c.m2), areaOc), pctInd: pctA(soma(ind,c=>c.m2), areaOc),
    nDet: det.length, nInd: ind.length,
    recDet: soma(det,c=>c.valor), recInd: soma(ind,c=>c.valor),
    pctRecDet: pc(soma(det,c=>c.valor)), pctRecInd: pc(soma(ind,c=>c.valor)),
    plano: doAnoC.length, feitas: fe.length, andamento: andN, pend: pe.length-andN,
    pctPlano: pctA(fe.length, doAnoC.length), pctAnd: pctA(andN, doAnoC.length),
    pctPend: pctA(pe.length-andN, doAnoC.length),
    ganho: ganho, aGanhar: aGanhar,
    anos: ANOS.map(a=>{const S=IT.filter(i=>i.ano===a);
      return {ano:a, n:S.length, atual:soma(S,i=>i.valor), dif:Math.max(0, soma(S,prev)-soma(S,i=>i.valor))};})
  });

  /* Mesmas colunas do "Relatório de Locação Grupo Cena", com vigência e situação ao final. */
  const gar=c=>{const g=String(c.gar||'').trim();
    return (!g||g==='-'||g===String(c.unidade).trim())?'':curto(g,40);};
  const linhas=L=>L.map(c=>`<tr>
     <td>${esc(c.cliente)}</td><td>${esc(curto(c.unidade,40))}</td><td>${esc(gar(c))||'—'}</td>
     <td class="ctr">${c.vista?esc(c.vista):'—'}</td>
     <td class="r">${c.valor?'R$ '+br2(c.valor):'—'}</td>
     <td class="r">${c.m2?br2(c.m2):'—'}</td>
     <td class="r">${c.valor&&c.m2?'R$ '+br2(c.valor/c.m2):'—'}</td>
     <td class="r">${dbr(c.ini)}</td>
     <td class="r">${c.fim?dbr(c.fim):'—'}</td>
     <td class="r">${c.proxRep?dbr(c.proxRep):'—'}</td>
     <td><span class="tag ${c.indet?'at':'ok'}">${c.indet?'Indet.':'Em prazo'}</span></td></tr>`).join('');

  /* Seções detalhadas, uma por ano futuro, no mesmo formato da seção 2. */
  const secAno=(a,n)=>{
    const S=IT.filter(i=>i.ano===a).sort((x,y)=>x.data<y.data?-1:1);
    if(!S.length) return '';
    const x=soma(S,i=>i.valor), y=soma(S,prev), m=soma(S,i=>i.m2);
    const nEmp=[...new Set(S.map(i=>i.sig))].length;
    const nInd=S.filter(i=>i.prazo==='Indet.'||!i.fim||i.fim<HOJE).length;
    /* As colunas de projeção só aparecem quando o Comercial já definiu meta de
       R$/m² para o ano; caso contrário seriam três colunas repetindo zero. */
    const meta=y>x;
    return `
   <h2 class="qbr">${n}. Repactuações de ${a}</h2>
   <table class="kpi"><tr>
     <td><span>Repactuações previstas</span><b>${S.length}</b></td>
     <td><span>Empreendimentos</span><b>${nEmp}</b></td>
     <td><span>Área envolvida</span><b>${brl(m)} m²</b></td>
     <td><span>Receita mensal em revisão</span><b>R$ ${brl(x)}</b></td>
     <td><span>Receita anual equivalente</span><b>R$ ${brl(x*12)}</b></td>
     <td><span>${meta?'Impacto anual estimado':'Por prazo indeterminado'}</span><b>${meta?'+R$ '+brl((y-x)*12):nInd+' de '+S.length}</b></td>
   </tr></table>
   <table class="ano"><tr><th>Data</th><th>Cliente</th><th>Local</th><th>Unidade</th><th class="r">Área m²</th><th class="r">Valor atual</th><th class="r">Valor do m²</th>${meta?'<th class="r">Valor previsto</th><th class="r">Diferença</th>':''}<th class="r">Fim do contrato</th><th>Vigência hoje</th></tr>
     ${S.map(i=>{const ii=i.prazo==='Indet.'||!i.fim||i.fim<HOJE; return `<tr>
       <td class="r">${dbr(i.data)}</td><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(curto(i.unidade,44))}</td>
       <td class="r">${i.m2?br2(i.m2):'—'}</td><td class="r">${i.valor?'R$ '+brl(i.valor):'a confirmar'}</td>
       <td class="r">${i.valor&&i.m2?'R$ '+br2(i.valor/i.m2):'—'}</td>
       ${meta?`<td class="r">R$ ${brl(prev(i))}</td><td class="r">${dif(i)>0?'+':''}R$ ${brl(dif(i))}</td>`:''}
       <td class="r">${i.fim?dbr(i.fim):'—'}</td>
       <td><span class="tag ${ii?'at':'ok'}">${ii?'Indet.':'Em prazo'}</span></td></tr>`;}).join('')}
     <tr class="tot"><td colspan="4">Total de ${a}</td><td class="r">${brl(m)}</td>
       <td class="r">R$ ${brl(x)}</td><td class="r">${m?'R$ '+br2(x/m):'—'}</td>
       ${meta?`<td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>`:''}<td colspan="2"></td></tr></table>`;
  };
  const anosDet=futuros.filter(a=>IT.some(i=>i.ano===a));
  const secoesAno=anosDet.map((a,k)=>secAno(a,4+k)).join('');
  const nListagem=4+anosDet.length;

  const s=`
   <h2>1. Repactuações de ${ANO_C}</h2>
   <table class="kpi"><tr>
     <td><span>Planejadas no ano</span><b>${doAnoC.length}</b></td>
     <td><span>Concluídas</span><b>${fe.length}</b></td>
     <td><span>Pendentes</span><b>${pe.length}</b></td>
     <td><span>Ganho já obtido</span><b>+R$ ${brl(ganho)}/mês</b></td>
     <td><span>Ganho a obter</span><b>+R$ ${brl(aGanhar)}/mês</b></td>
     <td><span>Impacto anual estimado</span><b>+R$ ${brl((ganho+aGanhar)*12)}</b></td>
   </tr></table>
   <table><tr><th>Mês</th><th>Cliente</th><th>Local</th><th>Unidade</th><th class="r">Valor atual</th><th class="r">Valor previsto</th><th class="r">Diferença</th><th class="r">%</th><th>Situação</th></tr>
     ${doAnoC.sort((a,b)=>a.data<b.data?-1:1).map(i=>`<tr>
       <td class="r">${dbr(i.data)}</td><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(curto(i.unidade,44))}</td>
       <td class="r">R$ ${brl(i.valor)}</td><td class="r">R$ ${brl(prev(i))}</td>
       <td class="r">${dif(i)>0?'+':''}R$ ${brl(dif(i))}</td>
       <td class="r">${i.valor?(dif(i)/i.valor*100).toFixed(1).replace('.',',')+'%':'—'}</td>
       <td><span class="tag ${feito(i)?'ok':'at'}">${esc(feito(i)?'Concluída':wf(i))}</span></td></tr>`).join('')}
     <tr class="tot"><td colspan="4">Total do ano</td><td class="r">R$ ${brl(soma(doAnoC,i=>i.valor))}</td>
       <td class="r">R$ ${brl(soma(doAnoC,prev))}</td><td class="r">+R$ ${brl(soma(doAnoC,dif))}</td><td colspan="2"></td></tr></table>

   <h2>2. Tratativas em andamento</h2>
   ${emAnd.length?`<table><tr><th>Cliente</th><th>Local</th><th>Unidade</th><th>Etapa</th><th>Responsável</th><th class="r">Próximo contato</th><th class="r">Valor atual</th><th class="r">Pretendido</th></tr>
     ${emAnd.map(i=>`<tr><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(curto(i.unidade,44))}</td>
       <td><span class="tag at">${esc(wf(i))}</span></td><td>${esc(ac(i.id).resp||'—')}</td>
       <td class="r">${ac(i.id).prox?dbr(ac(i.id).prox):'—'}</td>
       <td class="r">R$ ${brl(i.valor)}</td><td class="r">R$ ${brl(prev(i))}</td></tr>`).join('')}</table>`
    :'<p class="obs">Nenhuma tratativa em andamento nesta data. As demais repactuações do ano ainda não atingiram o prazo de abertura de negociação.</p>'}

   <h2>3. Calendário de repactuações ${futuros.length?futuros[0]+' a '+futuros[futuros.length-1]:''}</h2>
   ${(()=>{const metaFut=futuros.some(a=>{const S=IT.filter(i=>i.ano===a);return soma(S,prev)>soma(S,i=>i.valor);});
     const tx=soma(IT.filter(i=>futuros.indexOf(i.ano)>=0),i=>i.valor);
     return `<table><tr><th>Ano</th><th class="r">Contratos</th><th class="r">Empreendimentos</th><th class="r">Área m²</th><th class="r">Receita mensal em revisão</th><th class="r">Receita anual equivalente</th><th class="r">Por prazo indeterminado</th>${metaFut?'<th class="r">Impacto anual previsto</th>':''}</tr>
     ${futuros.map(a=>{const S=IT.filter(i=>i.ano===a),x=soma(S,i=>i.valor),y=soma(S,prev);
       const ni=S.filter(i=>i.prazo==='Indet.'||!i.fim||i.fim<HOJE).length;
       return `<tr><td>${a}</td><td class="r">${S.length}</td><td class="r">${[...new Set(S.map(i=>i.sig))].length}</td>
         <td class="r">${brl(soma(S,i=>i.m2))}</td><td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(x*12)}</td>
         <td class="r">${ni} de ${S.length}</td>${metaFut?`<td class="r">+R$ ${brl((y-x)*12)}</td>`:''}</tr>`;}).join('')}
     <tr class="tot"><td>Total ${futuros.length?futuros[0]+'–'+futuros[futuros.length-1]:''}</td>
       <td class="r">${IT.filter(i=>futuros.indexOf(i.ano)>=0).length}</td><td class="r"></td>
       <td class="r">${brl(soma(IT.filter(i=>futuros.indexOf(i.ano)>=0),i=>i.m2))}</td>
       <td class="r">R$ ${brl(tx)}</td><td class="r">R$ ${brl(tx*12)}</td><td class="r"></td>${metaFut?'<td class="r"></td>':''}</tr></table>`;})()}
   <p class="obs">Quadro de quantos contratos entram em ciclo de repactuação a cada ano e quanta receita mensal está em jogo. A projeção de valores não entra aqui porque o Comercial só definiu meta de R$/m² para ${ANO_C}; nos anos seguintes ela repetiria o valor atual.${anosDet.length?` Cada ano está detalhado, contrato a contrato, nas seções ${anosDet.length>1?'4 a '+(3+anosDet.length):'4'} a seguir.`:''}</p>
${secoesAno}
   <h2 class="qbr">${nListagem}. Listagem de locatários</h2>
   <p class="sub">Todas as ${C.length} unidades da carteira, agrupadas por empreendimento, incluindo as vagas e as de uso próprio.</p>
   ${sigs.map(sg=>{const S=C.filter(c=>c.sig===sg), sv=soma(S,c=>c.valor), sm=soma(S,c=>c.m2);
     return `<div class="band" style="background:${cor(sg)}">${esc(EMPN[sg]||sg)}<span>${sg} · ${S.length} unidade${S.length>1?'s':''}</span></div>
      <table class="loc"><colgroup><col style="width:16%"><col style="width:11%"><col style="width:10%"><col style="width:5%"><col style="width:9%"><col style="width:7%"><col style="width:8%">
        <col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:8%"></colgroup>
      <tr><th>Cliente</th><th>Unidade</th><th>Garagem</th><th class="ctr">Vista</th><th class="r">Valor contrato</th><th class="r">M² priv. sala</th><th class="r">Valor do m² locação</th>
        <th class="r">Início do contrato</th><th class="r">Fim do contrato</th><th class="r">Próxima renegociação</th><th>Vigência</th></tr>
      ${linhas(S)}
      <tr class="tot"><td colspan="4">Total dos contratos</td><td class="r">${sv?'R$ '+br2(sv):'—'}</td><td class="r">${br2(sm)}</td>
        <td class="r">${sv&&sm?'R$ '+br2(sv/sm):'—'}</td><td colspan="4"></td></tr></table>`;}).join('')}
   <table><tr class="tot"><td>Total geral · ${C.length} unidades · ${oc.length} locadas</td><td class="r">${br2(area)} m²</td>
     <td class="r">R$ ${br2(rec)}/mês</td><td class="r">R$ ${areaOc?br2(rec/areaOc):'—'}/m²</td><td class="r">R$ ${brl(rec*12)}/ano</td></tr></table>

`;

  return `<html><head><meta charset="utf-8"><title>Locações e Repactuações — ${mesExt(HOJE)} — Cena Empreendimentos</title>
  <style>${ESTILO_REL(false)}</style></head><body>
  ${capa}
  ${moldura(`<div class="cab">
    <div><div class="ov">Relatório mensal · Diretoria</div>
      <h1>Locações e Repactuações</h1>
      <div class="s">Referência: ${mesExt(HOJE)} · carteira completa, vigências e cronograma de repactuação</div></div>
    <div class="dt">Posição em ${dbr(HOJE)}<br>${C.length} unidades · ${oc.length} locadas<br>Emitido por ${esc(DB.usuario?DB.usuario.nome:'painel interno')}</div>
  </div>
  <div class="cap"><b>Receita mensal R$ ${brl(rec)}</b><b>${det.length} em prazo de contrato</b><b>${ind.length} por prazo indeterminado</b><b>${fe.length} de ${doAnoC.length} repactuações de ${ANO_C} concluídas</b></div>
  ${s}`)}
  </body></html>`;
}

function gerarMensal(){
  if(!IT.length){toast('Dados ainda carregando');return;}
  const w=window.open('','_blank');
  if(!w){toast('Libere as janelas pop-up para gerar o PDF');return;}
  w.document.write(docMensal()+'<script>document.title="Cena - Locacoes e Repactuacoes - '+refArq(HOJE)+'";setTimeout(function(){window.print()},700)<\/script>');
  w.document.close();
  toast('Relatório mensal aberto — salve como PDF');
}

function baixa(nome,conteudo,tipo){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['﻿'+conteudo],{type:tipo}));
  a.download=nome; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function nomeArq(ext){
  const r=(R.anos.length?R.anos.slice().sort().join('-'):'2026-2032')+(R.sigs.length?'-'+R.sigs.join('-'):'');
  return `repactuacoes-cena-${r}.${ext}`;
}
function gerar(){
  const L=relFiltrado();
  if(!L.length){toast('Nenhum contrato com esse recorte');return;}
  if(R.fmt==='csv'){
    const cols=RCOLS.filter(c=>R.cols.includes(c.id));
    const linhas=[cols.map(c=>c.t),...L.map(i=>cols.map(c=>{const raw=c.v(i);
      if(c.n&&typeof raw==='number') return String(raw.toFixed(2)).replace('.',',');
      return c.f?c.f(raw):(raw==null?'':String(raw));}))];
    baixa(nomeArq('csv'),linhas.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n'),'text/csv;charset=utf-8');
    toast(`${L.length} linhas exportadas em CSV`);
  } else if(R.fmt==='excel'){
    baixa(nomeArq('xls'),docHTML(true),'application/vnd.ms-excel;charset=utf-8');
    toast('Planilha gerada — abra no Excel');
  } else {
    const w=window.open('','_blank');
    if(!w){toast('Libere as janelas pop-up para gerar o PDF');return;}
    w.document.write(docHTML(false)+'<script>setTimeout(function(){window.print()},600)<\/script>');
    w.document.close();
    toast('Relatório aberto — use “Salvar como PDF”');
  }
  fecharModal();
}

/* ---------- abrir / fechar ---------- */
const mrel=document.getElementById('mrel');
function abrirModal(anoAtual){
  if(anoAtual){ R.anos=[anoAtual]; salvaR(); }
  montaModal(); mrel.classList.add('on');
}
function fecharModal(){ mrel.classList.remove('on'); }
document.getElementById('mclose').onclick=fecharModal;
document.getElementById('mcancel').onclick=fecharModal;
document.getElementById('mgo').onclick=gerar;
mrel.onclick=e=>{ if(e.target===mrel) fecharModal(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&mrel.classList.contains('on')) fecharModal(); });
document.getElementById('bMensal').onclick=gerarMensal;
document.getElementById('bRelGeral').onclick=()=>abrirModal(null);
document.getElementById('bRel').onclick=()=>abrirModal(ANO);
document.getElementById('cRel').onclick=()=>abrirModal(null);
document.getElementById('cRel').onclick=()=>abrirModal(CFIL.ano==='todos'?null:+CFIL.ano);
