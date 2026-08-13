/* ============ ATUALIZAR A PARTIR DA PLANILHA DO FINANCEIRO ============
   Lê o arquivo "Controle Contratos de Locação ....xlsx", aba "Consolidado - Imóveis",
   compara com o que está no painel e grava as diferenças no banco.
   Roda inteiramente no navegador: a planilha não sai do computador de quem importa. */

const EMPS_PLAN = {
  'BAIA SUL MEDICAL CENTER':'BMC','CENTRO EMPRESARIAL FLORIANÓPOLIS':'CEF',
  'CENTRO EXECUTIVO CARL HOEPCKE':'CECH','CENTRO EXECUTIVO FERREIRA LIMA':'CEFL',
  'PLAZA DANÚBIO RESIDENCE':'PDR','GALPÃO CAIS DO PORTO':'CAIS','SHOPPING DEODORO':'DEO',
  'TERRENO TROMPOWSKY':'TROMP','CASA CRISPIM MIRA':'CCM','SQUARE CORPORATE':'SQR',
  'EDIFÍCIO COMERCIAL PRIMER TOWER':'PRIMER','ALBERTO SANTIAGO RESIDENCE':'ASR',
  'MARINE':'MAR','SAINT-TROPEZ':'STZ','CÔTE D\'AZUR VILLE':'CAV'
};
const CP = {admin:0,locador:1,cliente:2,unidade:3,garagem:4,valor:5,m2a:6,m2b:7,rm2:8,
            inicio:13,fim:14,ultima:15,proxima:16,historico:17};

const nz = s => String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[´`'’]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const MAPA_EMP = {}; for(const n in EMPS_PLAN) MAPA_EMP[nz(n)] = EMPS_PLAN[n];
const limp = v => v==null ? '' : String(v).trim();
const semPav = t => String(t||'').replace(/pavimento\s+/ig,'').trim();
const nmr  = v => typeof v==='number' && !isNaN(v) ? v : 0;

function dataPlan(v){
  if(v instanceof Date) return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10);
  if(typeof v==='number' && v>20000 && v<80000)
    return new Date(Math.round((v-25569)*86400*1000)).toISOString().slice(0,10);
  const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v==null?'':v));
  if(!m) return '';
  const dia=+m[1], mes=+m[2], ano=+m[3];
  if(mes<1||mes>12||dia<1) return '';
  const d=new Date(Date.UTC(ano,mes-1,dia));
  if(d.getUTCMonth()!==mes-1) return '';            // 31/04 e afins: data inexistente
  return ano+'-'+('0'+mes).slice(-2)+'-'+('0'+dia).slice(-2);
}
function textoLivre(v){
  if(v instanceof Date) return '';
  const t=limp(v);
  if(!t||t==='-'||/(\d{1,2})\/(\d{1,2})\/(\d{4})/.test(t)) return '';
  return t;
}
/* faixa de título do empreendimento: linha sem unidade e sem valor de contrato */
function faixaEmp(l){
  if(limp(l[CP.unidade])!=='' || nmr(l[CP.valor])>0) return '';
  for(let c=0;c<Math.min(l.length,6);c++){ const t=nz(l[c]); if(t && MAPA_EMP[t]) return MAPA_EMP[t]; }
  return '';
}

function lerPlanilha(buf){
  const wb = XLSX.read(buf, {type:'array', cellDates:true});
  const aba = wb.Sheets['Consolidado - Imóveis'];
  if(!aba) throw new Error('A aba “Consolidado - Imóveis” não foi encontrada neste arquivo.');
  const linhas = XLSX.utils.sheet_to_json(aba, {header:1, defval:null, raw:true});
  const out=[]; let sig='';
  for(const l of linhas){
    if(!l) continue;
    const s=faixaEmp(l); if(s){ sig=s; continue; }
    if(!sig) continue;
    const cliente=limp(l[CP.cliente]), unidade=limp(l[CP.unidade]);
    if(!cliente && !unidade) continue;
    /* linha de continuação: mesmo contrato, outro pavimento */
    if(!cliente && unidade && out.length && out[out.length-1].sigla===sig){
      if(nz(unidade).indexOf('TOTAL')===0) continue;          // linha de totais, não é pavimento
      const p=out[out.length-1];
      p.m2 = String((+p.m2||0) + nmr(l[CP.m2a]) + nmr(l[CP.m2b]));
      p.unidade = semPav(p.unidade) + ' + ' + semPav(unidade); // "Pavimento" é redundante
      continue;
    }
    const u=nz(cliente);
    if(u==='CLIENTE'||u==='PROPRIETARIO'||u==='0'||u.indexOf('TOTAL')===0) continue;
    if(l.slice(2,6).some(x=>nz(x).indexOf('TOTAL DOS CONTRATOS')===0)) continue;
    const m2=nmr(l[CP.m2a])+nmr(l[CP.m2b]), vl=nmr(l[CP.valor]);
    out.push({
      sigla:sig, cliente:cliente||'VAGO', unidade:unidade||'-',
      garagem:limp(l[CP.garagem])||'-',
      m2:m2>0?String(m2):'', valor:vl>0?String(vl):'', rm2:nmr(l[CP.rm2])>0?String(nmr(l[CP.rm2])):'',
      inicio:dataPlan(l[CP.inicio]), fim:dataPlan(l[CP.fim]),
      ultima:dataPlan(l[CP.ultima]), proxima:dataPlan(l[CP.proxima]),
      historico:limp(l[CP.historico]), locador:limp(l[CP.locador]),
      administracao:limp(l[CP.admin]),
      situacao: textoLivre(l[CP.proxima]) || textoLivre(l[CP.ultima]) || ''
    });
  }
  if(out.length < 20) throw new Error('Só foram lidos '+out.length+' contratos. A aba pode ter mudado de formato — importação cancelada por segurança.');
  return out;
}

/* ---------- comparação com o que está no painel ---------- */
const chaveC = c => `${c.sigla}|${c.unidade||'-'}|${String(c.cliente).slice(0,16)}`;
function atuais(){
  const m=new Map();
  IT.concat(SEM).forEach(i=>{
    const k=`${i.sig}|${i.unidade||'-'}|${String(i.cliente).slice(0,16)}`;
    if(!m.has(k)) m.set(k,{sig:i.sig,cliente:i.cliente,unidade:i.unidade,valor:i.valor,
      m2:i.m2, fim:i.fim, ini:i.ini, ult:i.ult, prox:i.prox});
  });
  return m;
}
const dif2 = (a,b) => String(a==null?'':a) !== String(b==null?'':b);
/* tolerância: o painel guarda valores arredondados; só acusa mudança de verdade */
const difNum = (a,b,tol) => {
  const x = (a==null||a==='') ? null : +a, y = (b==null||b==='') ? null : +b;
  if(x===null && y===null) return false;
  if(x===null) return y!==0;      // vazio e zero são a mesma coisa
  if(y===null) return x!==0;
  return Math.abs(x-y) > tol;
};
function comparar(lidos){
  const atual=atuais(), vistos=new Set(), novos=[], alterados=[];
  /* índice auxiliar por (local + cliente) para quando só a redação da unidade mudou */
  const porCli=new Map();
  atual.forEach((v,k)=>{ const kk=v.sig+'|'+String(v.cliente).slice(0,16);
    porCli.set(kk, porCli.has(kk) ? null : k); });   // null = ambíguo, não usar
  lidos.forEach(c=>{
    let k=chaveC(c);
    if(!atual.has(k)){
      const alt=porCli.get(c.sigla+'|'+String(c.cliente).slice(0,16));
      if(alt && !vistos.has(alt)) k=alt;
    }
    vistos.add(k);
    const a=atual.get(k);
    if(!a){ novos.push(c); return; }
    const mud=[];
    if(difNum(a.valor, c.valor, 1))   mud.push({campo:'Valor', de:a.valor, para:c.valor?+c.valor:null});
    if(dif2(a.fim||'', c.fim))        mud.push({campo:'Fim do contrato', de:a.fim, para:c.fim});
    if(difNum(a.m2, c.m2, 0.5))       mud.push({campo:'Área m²', de:a.m2, para:c.m2?+c.m2:null});
    if(mud.length) alterados.push({c, mud});
  });
  const ausentes=[...atual.entries()].filter(([k])=>!vistos.has(k)).map(([,v])=>v);
  return {novos, alterados, ausentes, total:lidos.length};
}

/* ---------- tela ---------- */
let IMP_DADOS=null;
const mimp=document.getElementById('mimp');
function abrirImport(){
  IMP_DADOS=null;
  document.getElementById('impBody').innerHTML=`
    <div class="fset"><h5>Arquivo</h5>
      <div class="sumline">Selecione a planilha <b>Controle Contratos de Locação</b> do SharePoint (pasta Financeiro → Controles financeiros diversos). O arquivo é lido aqui no seu navegador e não é enviado a lugar nenhum.</div>
      <div class="opts" style="margin-top:12px"><input type="file" id="impFile" accept=".xlsx,.xlsm"></div>
    </div>
    <div id="impPrev"></div>`;
  document.getElementById('impFile').onchange=lerArquivo;
  document.getElementById('impGo').disabled=true;
  mimp.classList.add('on');
}
function fecharImport(){ mimp.classList.remove('on'); }

function lerArquivo(e){
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  const prev=document.getElementById('impPrev');
  prev.innerHTML='<div class="fset"><h5>Lendo</h5><div class="sumline">Processando a planilha…</div></div>';
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      const lidos=lerPlanilha(new Uint8Array(fr.result));
      IMP_DADOS=lidos;
      mostrarPrevia(comparar(lidos));
    }catch(err){
      IMP_DADOS=null;
      document.getElementById('impGo').disabled=true;
      prev.innerHTML=`<div class="fset"><h5>Não foi possível ler</h5><div class="sumline" style="color:#a5321f">${esc(err.message)}</div></div>`;
    }
  };
  fr.readAsArrayBuffer(f);
}

function mostrarPrevia(d){
  const l=[];
  l.push(`<div class="fset"><h5>O que mudou</h5>
    <div class="sumline"><b>${d.total}</b> contratos lidos · <b>${d.novos.length}</b> novo${d.novos.length===1?'':'s'} ·
    <b>${d.alterados.length}</b> alterado${d.alterados.length===1?'':'s'} ·
    <b>${d.ausentes.length}</b> ausente${d.ausentes.length===1?'':'s'} na planilha</div></div>`);

  if(d.novos.length) l.push(`<div class="fset"><h5>Contratos novos</h5><table class="imp"><tr><th>Local</th><th>Cliente</th><th>Unidade</th><th class="r">Valor</th></tr>
    ${d.novos.map(c=>`<tr><td>${esc(c.sigla)}</td><td>${esc(c.cliente)}</td><td>${esc(c.unidade)}</td><td class="r">${c.valor?'R$ '+brl(+c.valor):'—'}</td></tr>`).join('')}</table></div>`);

  if(d.alterados.length) l.push(`<div class="fset"><h5>Valores alterados</h5><table class="imp"><tr><th>Local</th><th>Cliente</th><th>Unidade</th><th>Campo</th><th class="r">No painel</th><th class="r">Na planilha</th></tr>
    ${d.alterados.map(a=>a.mud.map(m=>`<tr><td>${esc(a.c.sigla)}</td><td>${esc(a.c.cliente)}</td><td>${esc(a.c.unidade)}</td>
      <td>${m.campo}</td>
      <td class="r">${m.campo==='Fim do contrato'?dbr(m.de):(m.de==null?'—':br2(m.de))}</td>
      <td class="r"><b>${m.campo==='Fim do contrato'?dbr(m.para):(m.para==null?'—':br2(m.para))}</b></td></tr>`).join('')).join('')}</table></div>`);

  if(d.ausentes.length) l.push(`<div class="fset"><h5>Não encontrados na planilha</h5>
    <div class="sumline">Estes contratos continuam no painel e <b>não serão apagados</b> — apenas ficam marcados para revisão.</div>
    <table class="imp"><tr><th>Local</th><th>Cliente</th><th>Unidade</th></tr>
    ${d.ausentes.map(c=>`<tr><td>${esc(c.sig)}</td><td>${esc(c.cliente)}</td><td>${esc(c.unidade)}</td></tr>`).join('')}</table></div>`);

  if(!d.novos.length && !d.alterados.length && !d.ausentes.length)
    l.push('<div class="fset"><div class="sumline">Nada mudou desde a última atualização. Pode fechar.</div></div>');

  document.getElementById('impPrev').innerHTML=l.join('');
  document.getElementById('impGo').disabled = !(d.novos.length || d.alterados.length || d.ausentes.length);
}

async function aplicarImport(){
  if(!IMP_DADOS) return;
  const b=document.getElementById('impGo');
  b.disabled=true; b.textContent='Gravando…';
  const r=await DB.rpc('sincronizar_do_painel', {p_dados: IMP_DADOS});
  b.textContent='Aplicar no banco';
  if(!r.ok){ toast('Não foi possível gravar: '+r.motivo); b.disabled=false; return; }
  const d=r.dados||{};
  toast(`Atualizado — ${d.novos||0} novos, ${d.alterados||0} alterados, ${d.ciclos_criados||0} ciclos criados`);
  fecharImport();
  setTimeout(()=>location.reload(), 1200);
}

document.getElementById('impClose').onclick=fecharImport;
document.getElementById('impCancel').onclick=fecharImport;
document.getElementById('impGo').onclick=aplicarImport;
mimp.onclick=e=>{ if(e.target===mimp) fecharImport(); };
document.getElementById('bImport').onclick=abrirImport;
