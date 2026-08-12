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
   <div class="fset"><h5>Empreendimentos</h5><div class="opts">
     <button class="op ${!R.sigs.length?'on':''}" data-sig="todos">Todos</button>
     ${sigsAll().map(s=>`<button class="op ${R.sigs.includes(s)?'on':''}" data-sig="${s}" title="${esc(EMPN[s]||s)}">${s} <span style="opacity:.6">(${IT.filter(i=>i.sig===s).length})</span></button>`).join('')}
   </div></div>
   <div class="fset"><h5>Seções do relatório</h5><div class="opts">
     ${RSECS.map(s=>`<button class="chk ${R.secs.includes(s.id)?'on':''}" data-sec="${s.id}" title="${s.d}">${tick}${s.t}</button>`).join('')}
   </div></div>
   <div class="fset"><h5>Colunas do detalhamento</h5><div class="opts">
     ${RCOLS.map(c=>`<button class="chk ${R.cols.includes(c.id)?'on':''}" data-col="${c.id}">${tick}${c.t}</button>`).join('')}
   </div>
   <div style="display:flex;gap:8px;margin-top:11px">
     <button class="b sm" data-colset="padrao">Colunas padrão</button>
     <button class="b sm" data-colset="todas">Todas</button>
     <button class="b sm" data-colset="minimo">Só o essencial</button>
   </div></div>`;

  const mb=document.getElementById('mbody');
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

  const estilo = `
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
   @media print{@page{size:A4 landscape;margin:12mm} h2{page-break-after:avoid} table{page-break-inside:auto} tr{page-break-inside:avoid}}`;

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
document.getElementById('bRelGeral').onclick=()=>abrirModal(null);
document.getElementById('bRel').onclick=()=>abrirModal(ANO);
document.getElementById('cRel').onclick=()=>abrirModal(null);
document.getElementById('cRel').onclick=()=>abrirModal(CFIL.ano==='todos'?null:+CFIL.ano);
