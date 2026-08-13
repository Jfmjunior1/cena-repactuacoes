/* ================== GERADOR DE RELATÓRIO ================== */
const LOGO = new URL('logo.png', location.href).href;

const RCOLS=[
 {id:'data',t:'Data da repactuação',v:i=>dbr(i.data)},
 {id:'cliente',t:'Cliente',v:i=>i.cliente},
 {id:'emp',t:'Empreendimento',v:i=>i.emp},
 {id:'sig',t:'Local',v:i=>i.sig},
 {id:'unidade',t:'Unidade',v:i=>i.unidade},
 {id:'gar',t:'Vaga garagem',v:i=>i.gar&&i.gar!=='-'?i.gar:''},
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
  const recorte=`${R.anos.length?R.anos.slice().sort().join(', '):`${ANOS[0]} a ${ANOS[ANOS.length-1]}`} · ${R.sigs.length?R.sigs.map(s=>EMPN[s]||s).join(', '):'todos os empreendimentos'}`;
  let s='';

  if(R.secs.includes('resumo')) s+=`
   <h2>Resumo executivo</h2>
   <table class="kpi"><tr>
     <td><span>Repactuações</span><b>${L.length}</b></td>
     <td><span>Área envolvida</span><b>${brl(soma(L,i=>i.m2))} m²</b></td>
     <td><span>Valor atual</span><b>R$ ${brl(va)}/mês</b></td>
     <td><span>Valor previsto</span><b>R$ ${brl(vp)}/mês</b></td>
     <td><span>Diferença</span><b>+R$ ${brl(d)}/mês</b></td>
     <td><span>Impacto anual</span><b>+R$ ${brl(d*12)}</b></td>
   </tr></table>`;

  if(R.secs.includes('porAno')&&anosSel.length) s+=`
   <h2>Consolidado por ano</h2>
   <table><tr><th>Ano</th><th class="r">Contratos</th><th class="r">Área m²</th><th class="r">Valor atual</th>
     <th class="r">Valor previsto</th><th class="r">Diferença</th><th class="r">%</th></tr>
   ${anosSel.map(a=>{const S=L.filter(i=>i.ano===a),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<tr><td>${a}</td><td class="r">${S.length}</td><td class="r">${brl(soma(S,i=>i.m2))}</td>
       <td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>
       <td class="r">${x?((y-x)/x*100).toFixed(1).replace('.',','):'—'}%</td></tr>`;}).join('')}
   <tr class="tot"><td>Total</td><td class="r">${L.length}</td><td class="r">${brl(soma(L,i=>i.m2))}</td>
     <td class="r">R$ ${brl(va)}</td><td class="r">R$ ${brl(vp)}</td><td class="r">+R$ ${brl(d)}</td>
     <td class="r">${va?((d/va)*100).toFixed(1).replace('.',','):'—'}%</td></tr></table>`;

  if(R.secs.includes('porEmp')&&sigsSel.length) s+=`
   <h2>Consolidado por empreendimento</h2>
   <table><tr><th>Empreendimento</th><th>Sigla</th><th class="r">Contratos</th><th class="r">Área m²</th>
     <th class="r">Valor atual</th><th class="r">Valor previsto</th><th class="r">Diferença</th><th class="r">%</th></tr>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<tr><td>${esc(EMPN[sg]||sg)}</td><td>${sg}</td><td class="r">${S.length}</td><td class="r">${brl(soma(S,i=>i.m2))}</td>
       <td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>
       <td class="r">${x?((y-x)/x*100).toFixed(1).replace('.',','):'—'}%</td></tr>`;}).join('')}
   <tr class="tot"><td colspan="2">Total</td><td class="r">${L.length}</td><td class="r">${brl(soma(L,i=>i.m2))}</td>
     <td class="r">R$ ${brl(va)}</td><td class="r">R$ ${brl(vp)}</td><td class="r">+R$ ${brl(d)}</td>
     <td class="r">${va?((d/va)*100).toFixed(1).replace('.',','):'—'}%</td></tr></table>`;

  if(R.secs.includes('detalhe')&&cols.length) s+=`
   <h2>Detalhamento dos contratos</h2>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg),x=soma(S,i=>i.valor),y=soma(S,prev);
     return `<h3>${esc(EMPN[sg]||sg)} <span class="lt">· ${sg} · ${S.length} contrato${S.length>1?'s':''}</span></h3>
      <table><tr>${cols.map(c=>`<th class="${c.n?'r':''}">${c.t}</th>`).join('')}</tr>
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
    s+=`<h2>Simulações registradas</h2>`+
     (S.length?`<table><tr><th>Data</th><th>Cliente</th><th>Local</th><th>Unidade</th><th class="r">Valor atual</th>
       <th class="r">Valor simulado</th><th class="r">Diferença</th><th class="r">%</th></tr>
       ${S.map(i=>`<tr><td>${dbr(i.data)}</td><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(i.unidade)}</td>
         <td class="r">R$ ${brl(i.valor)}</td><td class="r">R$ ${brl(sim[i.id])}</td><td class="r">+R$ ${brl(dif(i))}</td>
         <td class="r">${i.valor?(dif(i)/i.valor*100).toFixed(1).replace('.',','):'—'}%</td></tr>`).join('')}</table>`
     :'<p class="obs">Nenhuma simulação registrada para este recorte. Os valores previstos usam as metas de R$/m².</p>');
  }

  if(R.secs.includes('metas')) s+=`
   <h2>Valores alvo por empreendimento</h2>
   <table><tr><th>Empreendimento</th><th>Sigla</th><th class="r">Contratos com alvo</th><th class="r">R$/m² alvo médio</th>
     <th class="r">R$/m² médio atual</th><th class="r">Defasagem</th></tr>
   ${sigsSel.map(sg=>{const S=L.filter(i=>i.sig===sg), CA=S.filter(i=>alvoM2(i)!=null);
     const med=soma(S,i=>i.valor)/(soma(S,i=>i.m2)||1);
     const meta=CA.length?soma(CA,i=>alvoM2(i))/CA.length:null;
     return `<tr><td>${esc(EMPN[sg]||sg)}</td><td>${sg}</td><td class="r">${CA.length} de ${S.length}</td>
       <td class="r">${meta?'R$ '+br2(meta):'a definir'}</td>
       <td class="r">R$ ${br2(med)}</td><td class="r">${meta&&med?((meta/med-1)*100).toFixed(1).replace('.',',')+'%':'—'}</td></tr>`;}).join('')}</table>
   <p class="obs">O valor alvo só está definido onde o Comercial já fixou a meta — hoje, apenas no plano de 2026. Nos anos seguintes o campo permanece em branco até a definição, e o valor previsto repete o valor atual. Premissa interna de trabalho; não representa proposta formal ao locatário.</p>`;

  if(R.secs.includes('notas')) s+=`
   <h2>Nota metodológica</h2>
   <p class="obs"><b>Regra aplicada:</b> repactuação a cada três anos, contada a partir da última ou da próxima renegociação registrada no controle de locações, projetada até o fim da vigência de cada contrato. Contratos com vigência vencida e prorrogada por prazo indeterminado aparecem como “Indeterminada” e tiveram dois ciclos projetados.<br><br>
   <b>Valor previsto:</b> corresponde ao valor efetivamente repactuado quando a negociação já foi fechada; ao valor simulado neste painel quando houver simulação; ao valor alvo definido pelo Comercial quando houver; e, na falta de todos, repete o valor atual — caso dos anos ainda sem definição de meta.<br><br>
   <b>Fonte:</b> planilha “Controle Contratos de Locação 2023 / 2024 / 2025 e 2026”, aba “Consolidado - Imóveis”, posição em ${dbr(HOJE)}. Minutas e aditivos no SharePoint; tratativas registradas no ClickUp.<br><br>
   <b>Confidencialidade:</b> documento interno da Cena Empreendimentos. Contém dados de locatários protegidos pela LGPD — não distribuir a terceiros. Alterações societárias, de garantia ou de fiança devem ser validadas com a Diretoria.</p>`;

  const estilo = ESTILO_REL(paraExcel);

  return `<html><head><meta charset="utf-8"><title>Repactuações de locação — Cena Empreendimentos</title>
  <style>${estilo}</style></head><body>
  <div class="cab">
    <div><img src="${LOGO}" alt="Cena Empreendimentos">
      <div class="ov" style="margin-top:10px">Relatório interno · Gestão de locações</div>
      <h1>Planejamento de repactuações</h1>
      <div class="s">${esc(recorte)}</div></div>
    <div class="dt">Posição em ${dbr(HOJE)}<br>${L.length} contrato${L.length>1?'s':''} no recorte<br>Emitido por ${esc(DB.usuario?DB.usuario.nome:'painel interno')}</div>
  </div>
  ${s}
  <div class="rod">Cena Empreendimentos · Du Lac · Florianópolis/SC · documento interno, uso restrito · dados protegidos pela LGPD.</div>
  </body></html>`;
}

const ESTILO_REL = paraExcel => `
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
   @media print{@page{size:A4 landscape;margin:12mm} h2{page-break-after:avoid} h3{page-break-after:avoid} table{page-break-inside:auto} tr{page-break-inside:avoid} .qbr{page-break-before:always}}`;

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
      locador:b.locador, obs:b.sit, indet,
      ultRep: conc.length?conc[conc.length-1].data:(isData(b.ult)?b.ult:null),
      proxRep: pend.length?pend[0].data:null,
      proxAno: pend.length?pend[0].ano:null,
      andamento: pend.some(emAndamento),
      ocupada: !vago&&!proprio,
      situacao: proprio?'Uso próprio':(vago?'Unidade vaga':(junto?'Locado · valor a confirmar':(pend.length?'Locado':'Locado · sem previsão'))),
      classe: (proprio||vago)?'no':(junto?'at':'ok')
    };
  }).sort((a,b)=>a.sig===b.sig?String(a.unidade).localeCompare(String(b.unidade),'pt-BR'):a.sig.localeCompare(b.sig));
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

  const linhas=L=>L.map(c=>`<tr>
     <td>${esc(c.cliente)}</td><td>${esc(curto(c.unidade))}</td>
     <td class="r">${c.m2?br2(c.m2):'—'}</td>
     <td class="r">${c.valor?'R$ '+brl(c.valor):'—'}</td>
     <td class="r">${c.valor&&c.m2?'R$ '+br2(c.valor/c.m2):'—'}</td>
     <td class="r">${dbr(c.ini)}</td>
     <td class="r">${c.indet?'—':dbr(c.fim)}</td>
     <td><span class="tag ${c.indet?'at':'ok'}">${c.indet?'Indeterminado':'Prazo de contrato'}</span></td>
     <td class="r">${c.ultRep?dbr(c.ultRep):'—'}</td>
     <td class="r">${c.proxRep?dbr(c.proxRep):'—'}</td>
     <td><span class="tag ${c.classe}">${esc(c.situacao)}</span></td></tr>`).join('');

  const s=`
   <h2>1. Panorama da carteira</h2>
   <table class="kpi"><tr>
     <td><span>Contratos de locação</span><b>${oc.length}</b></td>
     <td><span>Receita mensal</span><b>R$ ${brl(rec)}</b></td>
     <td><span>Área locada</span><b>${brl(areaOc)} m²</b></td>
     <td><span>R$/m² médio</span><b>R$ ${areaOc?br2(rec/areaOc):'—'}</b></td>
     <td><span>Unidades vagas / uso próprio</span><b>${vagas.length}</b></td>
     <td><span>Empreendimentos</span><b>${sigs.length}</b></td>
   </tr></table>
   <p class="sub">A carteira reúne <b>${C.length} unidades</b> em ${sigs.length} empreendimentos, das quais ${oc.length} estão locadas e ${vagas.length} figuram como vagas ou em uso próprio. A receita contratada soma <b>R$ ${brl(rec)} por mês</b>, o equivalente a R$ ${brl(rec*12)} ao ano.</p>

   <h2>2. Situação da vigência</h2>
   <table><tr><th>Situação</th><th class="r">Contratos</th><th class="r">Área m²</th><th class="r">Receita mensal</th><th class="r">% da receita</th></tr>
     <tr><td>Dentro do prazo de contrato</td><td class="r">${det.length}</td><td class="r">${brl(soma(det,c=>c.m2))}</td><td class="r">R$ ${brl(soma(det,c=>c.valor))}</td><td class="r">${pc(soma(det,c=>c.valor))}</td></tr>
     <tr><td>Prorrogado por prazo indeterminado</td><td class="r">${ind.length}</td><td class="r">${brl(soma(ind,c=>c.m2))}</td><td class="r">R$ ${brl(soma(ind,c=>c.valor))}</td><td class="r">${pc(soma(ind,c=>c.valor))}</td></tr>
     <tr class="tot"><td>Total locado</td><td class="r">${oc.length}</td><td class="r">${brl(areaOc)}</td><td class="r">R$ ${brl(rec)}</td><td class="r">100%</td></tr></table>
   <h3>Contratos por prazo indeterminado <span class="lt">· ${ind.length} contrato${ind.length>1?'s':''} · R$ ${brl(soma(ind,c=>c.valor))}/mês</span></h3>
   <table><tr><th>Empreendimento</th><th>Cliente</th><th>Unidade</th><th class="r">Área m²</th><th class="r">Valor mensal</th><th class="r">Fim do prazo original</th><th class="r">Próxima repactuação</th></tr>
     ${ind.map(c=>`<tr><td>${esc(EMPN[c.sig]||c.sig)}</td><td>${esc(c.cliente)}</td><td>${esc(curto(c.unidade,44))}</td>
       <td class="r">${c.m2?br2(c.m2):'—'}</td><td class="r">${c.valor?'R$ '+brl(c.valor):'a confirmar'}</td>
       <td class="r">${c.fim?dbr(c.fim):'—'}</td><td class="r">${c.proxRep?dbr(c.proxRep):'—'}</td></tr>`).join('')}
     <tr class="tot"><td colspan="3">Subtotal</td><td class="r">${brl(soma(ind,c=>c.m2))}</td><td class="r">R$ ${brl(soma(ind,c=>c.valor))}</td><td colspan="2"></td></tr></table>
   <p class="obs">A locação por prazo indeterminado permanece válida e regida pelo contrato original (Lei 8.245/91), mas pode ser denunciada por qualquer das partes com aviso prévio. São ${ind.length} contratos nessa condição, ${pc(soma(ind,c=>c.valor))} da receita — recomenda-se avaliar a renovação formal junto com a repactuação.</p>

   <h2 class="qbr">3. Repactuações de ${ANO_C}</h2>
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

   <h2>4. Tratativas em andamento</h2>
   ${emAnd.length?`<table><tr><th>Cliente</th><th>Local</th><th>Unidade</th><th>Etapa</th><th>Responsável</th><th class="r">Próximo contato</th><th class="r">Valor atual</th><th class="r">Pretendido</th></tr>
     ${emAnd.map(i=>`<tr><td>${esc(i.cliente)}</td><td>${i.sig}</td><td>${esc(curto(i.unidade,44))}</td>
       <td><span class="tag at">${esc(wf(i))}</span></td><td>${esc(ac(i.id).resp||'—')}</td>
       <td class="r">${ac(i.id).prox?dbr(ac(i.id).prox):'—'}</td>
       <td class="r">R$ ${brl(i.valor)}</td><td class="r">R$ ${brl(prev(i))}</td></tr>`).join('')}</table>`
    :'<p class="obs">Nenhuma tratativa em andamento nesta data. As demais repactuações do ano ainda não atingiram o prazo de abertura de negociação.</p>'}

   <h2>5. Calendário de repactuações ${futuros.length?futuros[0]+' a '+futuros[futuros.length-1]:''}</h2>
   <table><tr><th>Ano</th><th class="r">Contratos</th><th class="r">Área m²</th><th class="r">Valor atual</th><th class="r">Valor previsto</th><th class="r">Diferença mensal</th><th class="r">Impacto anual</th></tr>
     ${futuros.map(a=>{const S=IT.filter(i=>i.ano===a),x=soma(S,i=>i.valor),y=soma(S,prev);
       return `<tr><td>${a}</td><td class="r">${S.length}</td><td class="r">${brl(soma(S,i=>i.m2))}</td>
         <td class="r">R$ ${brl(x)}</td><td class="r">R$ ${brl(y)}</td><td class="r">+R$ ${brl(y-x)}</td>
         <td class="r">+R$ ${brl((y-x)*12)}</td></tr>`;}).join('')}</table>
   <p class="obs">O valor previsto só incorpora meta de R$/m² onde o Comercial já a definiu — hoje, apenas no plano de ${ANO_C}. Nos anos seguintes o previsto repete o valor atual, de modo que os números acima são o piso, não a expectativa de ganho.</p>

   <h2 class="qbr">6. Listagem de locatários e situação de cada contrato</h2>
   <p class="sub">Todas as ${C.length} unidades da carteira, agrupadas por empreendimento. Inclui as unidades vagas e as de uso próprio, sinalizadas na coluna de situação.</p>
   ${sigs.map(sg=>{const S=C.filter(c=>c.sig===sg);
     return `<h3>${esc(EMPN[sg]||sg)} <span class="lt">· ${sg} · ${S.length} unidade${S.length>1?'s':''} · R$ ${brl(soma(S,c=>c.valor))}/mês</span></h3>
      <table><tr><th>Cliente / locatário</th><th>Unidade</th><th class="r">Área m²</th><th class="r">Valor mensal</th><th class="r">R$/m²</th>
        <th class="r">Início</th><th class="r">Fim</th><th>Vigência</th><th class="r">Última repact.</th><th class="r">Próxima repact.</th><th>Situação</th></tr>
      ${linhas(S)}
      <tr class="tot"><td colspan="2">Subtotal</td><td class="r">${brl(soma(S,c=>c.m2))}</td><td class="r">R$ ${brl(soma(S,c=>c.valor))}</td><td colspan="7"></td></tr></table>`;}).join('')}
   <table><tr class="tot"><td>Total geral · ${C.length} unidades</td><td class="r">${brl(area)} m²</td><td class="r">R$ ${brl(rec)}/mês</td><td class="r">R$ ${brl(rec*12)}/ano</td></tr></table>

   <h2>7. Nota metodológica</h2>
   <p class="obs"><b>Regra de repactuação:</b> a cada três anos, contada da última ou da próxima renegociação registrada no controle de locações, projetada até o fim da vigência. Contratos prorrogados por prazo indeterminado tiveram dois ciclos projetados.<br><br>
   <b>Valor previsto:</b> o valor efetivamente repactuado quando a negociação já foi fechada; o valor simulado no painel quando houver; o valor alvo do Comercial quando definido; na falta de todos, repete o valor atual.<br><br>
   <b>Fonte:</b> planilha “Controle Contratos de Locação 2023 / 2024 / 2025 e 2026”, aba “Consolidado - Imóveis”, e plano de repactuação de ${ANO_C}. Posição em ${dbr(HOJE)}. Minutas e aditivos no SharePoint; tratativas registradas no ClickUp.<br><br>
   <b>Pontos em conferência:</b> Zenith (L01) e Orbis (L02) constam com o mesmo valor de contrato, o que distorce o R$/m² das duas unidades; B2B (S502) e AMAX/AGAH (S221) estão sem valor de contrato no controle e por isso não somam receita neste relatório; e o registro de última repactuação do IG Centro de Fisioterapia (S1002) está com data futura. Todos aguardam confirmação do Comercial.<br><br>
   <b>Identificação das unidades:</b> descrições muito longas de vagas de garagem aparecem abreviadas nas tabelas; a relação completa está no painel e no controle de locações.<br><br>
   <b>Confidencialidade:</b> documento interno da Cena Empreendimentos. Contém dados de locatários protegidos pela LGPD — não distribuir a terceiros. Alterações societárias, de garantia ou de fiança devem ser validadas com a Diretoria.</p>`;

  return `<html><head><meta charset="utf-8"><title>Locações e Repactuações — ${mesExt(HOJE)} — Cena Empreendimentos</title>
  <style>${ESTILO_REL(false)}</style></head><body>
  <div class="cab">
    <div><img src="${LOGO}" alt="Cena Empreendimentos">
      <div class="ov" style="margin-top:10px">Relatório mensal · Diretoria</div>
      <h1>Locações e Repactuações</h1>
      <div class="s">Referência: ${mesExt(HOJE)} · carteira completa, vigências e cronograma de repactuação</div></div>
    <div class="dt">Posição em ${dbr(HOJE)}<br>${C.length} unidades · ${oc.length} locadas<br>Emitido por ${esc(DB.usuario?DB.usuario.nome:'painel interno')}</div>
  </div>
  <div class="cap"><b>Receita mensal R$ ${brl(rec)}</b><b>${det.length} em prazo de contrato</b><b>${ind.length} por prazo indeterminado</b><b>${fe.length} de ${doAnoC.length} repactuações de ${ANO_C} concluídas</b></div>
  ${s}
  <div class="rod">Cena Empreendimentos · Du Lac · Av. Osvaldo Rodrigues Cabral, 1570, sala 213 · Florianópolis/SC<br>Documento interno de uso restrito · dados de locatários protegidos pela LGPD · emitido pelo Painel de Repactuações.</div>
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
