/* ============================================================
   Camada de dados — Supabase (online) com fallback local (offline)
   ============================================================ */
const DB = (() => {
  let sb = null;              // cliente supabase
  let usuario = null;         // { email, nome, papel }
  let online = false;

  const cfg = window.CENA_CONFIG || {};
  const configurado = !!(cfg.supabaseUrl && cfg.supabaseAnonKey &&
                         !/SUA_URL|SUA_CHAVE/.test(cfg.supabaseUrl + cfg.supabaseAnonKey));

  /* ---------- armazenamento local (fallback) ---------- */
  const _mem = {};
  function lsGet(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return _mem[k]??null; } }
  function lsSet(k,v){ _mem[k]=v; try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

  /* ---------- inicialização ---------- */
  async function iniciar(){
    if(!configurado) return { online:false, motivo:'sem-config' };
    if(!window.supabase) return { online:false, motivo:'sdk' };
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth:{ persistSession:true, autoRefreshToken:true }
    });
    const { data:{ session } } = await sb.auth.getSession();
    if(session) await carregarUsuario(session.user);
    online = true;
    return { online:true, autenticado: !!session };
  }

  async function carregarUsuario(u){
    const { data } = await sb.from('perfis').select('nome,email,papel').eq('id', u.id).maybeSingle();
    usuario = { id:u.id, email:u.email, nome:(data&&data.nome)||u.email.split('@')[0], papel:(data&&data.papel)||'leitor' };
    return usuario;
  }

  async function entrar(email, senha){
    const { data, error } = await sb.auth.signInWithPassword({ email:email.trim(), password:senha });
    if(error) throw error;
    await carregarUsuario(data.user);
    return usuario;
  }
  async function sair(){ if(sb) await sb.auth.signOut(); usuario=null; }
  async function redefinirSenha(email){
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href.split('#')[0] });
    if(error) throw error;
  }

  /* ---------- leitura dos dados ---------- */
  async function carregar(){
    if(!online || !usuario) return dadosLocais();

    const [{ data:emp, error:e1 }, { data:rep, error:e2 }, { data:anot, error:e3 }] = await Promise.all([
      sb.from('empreendimentos').select('*'),
      sb.from('repactuacoes').select('*').order('data',{ ascending:true, nullsFirst:false }),
      sb.from('anotacoes').select('*').order('criado_em',{ ascending:false })
    ]);
    if(e1||e2||e3) throw (e1||e2||e3);

    const empresas={}, cores={};
    (emp||[]).forEach(e=>{ empresas[e.sigla]=e.nome; cores[e.sigla]=e.cor; });

    const itens=[], sem=[], revisar=[], sim={}, acomp={};
    (rep||[]).forEach(r=>{
      const o = {
        id:r.id, ano:r.ano, data:r.data, sig:r.sigla, emp:empresas[r.sigla]||r.sigla,
        cliente:r.cliente, unidade:r.unidade||'-', gar:r.garagem||'-',
        m2:num(r.m2), valor:num(r.valor),
        alvoM2:num(r.alvo_m2), valorAlvo:num(r.valor_alvo),
        rm2Rep:num(r.rm2_rep), valorRep:num(r.valor_rep), pct:num(r.pct),
        status:r.status, mesCom:r.mes_com, mesRep:r.mes_rep, prazo:r.prazo,
        ini:r.inicio, fim:r.fim, ult:r.ult_repactuacao, origem:r.origem,
        locador:r.locador, admin:r.administracao, rm2src:num(r.rm2_controle),
        plano:!!r.plano_2026, sit:r.situacao_contrato, vista:r.vista||'',
        revisar:!!r.revisar, fonte:r.fonte||''
      };
      if(r.sem_previsao) sem.push(o);
      else if(r.revisar) revisar.push(o);
      else itens.push(o);
      if(r.simulacao!=null) sim[r.id]=num(r.simulacao);
      if(r.etapa||r.responsavel||r.proximo_contato)
        acomp[r.id]={ st:r.etapa||undefined, resp:r.responsavel||'', prox:r.proximo_contato||'', obs:[] };
    });
    (anot||[]).forEach(a=>{
      if(!acomp[a.repactuacao_id]) acomp[a.repactuacao_id]={ obs:[] };
      if(!acomp[a.repactuacao_id].obs) acomp[a.repactuacao_id].obs=[];
      acomp[a.repactuacao_id].obs.push({ id:a.id, d:a.criado_em, t:a.texto, autor:a.autor });
    });

    return { itens, sem, revisar, empresas, cores, hoje: cfg.dataPosicao || hojeISO(), sim, acomp, online:true };
  }

  function dadosLocais(){
    // A cópia local (src/dados-iniciais.js) não é versionada, para não expor dados de
    // locatários num repositório público. Se ela existir, o painel funciona sem conexão.
    if(!window.DADOS_INICIAIS) return { vazio:true, itens:[], sem:[], revisar:[], empresas:{}, cores:{}, hoje:(cfg.dataPosicao||hojeISO()), sim:{}, acomp:{}, online:false };
    const base = JSON.parse(JSON.stringify(window.DADOS_INICIAIS));
    base.sim   = lsGet('rp_sim')   || {};
    base.acomp = lsGet('rp_acomp') || {};
    base.cores = base.cores || {};
    base.revisar = base.revisar || [];
    base.online = false;
    return base;
  }

  /* ---------- escrita ---------- */
  const podeEditar = () => !online || (usuario && usuario.papel === 'editor');

  async function salvarCampo(id, campo, valor){
    if(!online){
      const chave = campo==='simulacao' ? 'rp_sim' : 'rp_acomp';
      const atual = lsGet(chave) || {};
      if(campo==='simulacao'){ if(valor==null) delete atual[id]; else atual[id]=valor; }
      else {
        const mapa = { etapa:'st', responsavel:'resp', proximo_contato:'prox' };
        atual[id] = Object.assign({}, atual[id], { [mapa[campo]]: valor });
      }
      lsSet(chave, atual);
      return { ok:true, local:true };
    }
    if(!podeEditar()) return { ok:false, motivo:'sem-permissao' };
    const { error } = await sb.from('repactuacoes').update({ [campo]: valor }).eq('id', id);
    if(error) return { ok:false, motivo:error.message };
    return { ok:true };
  }

  async function addAnotacao(id, texto){
    if(!online){
      const a = lsGet('rp_acomp') || {};
      a[id] = a[id] || {};
      a[id].obs = [{ id: Date.now(), d: new Date().toISOString(), t: texto, autor:'local' }, ...(a[id].obs||[])];
      lsSet('rp_acomp', a);
      return { ok:true, local:true, nota:a[id].obs[0] };
    }
    if(!podeEditar()) return { ok:false, motivo:'sem-permissao' };
    const { data, error } = await sb.from('anotacoes')
      .insert({ repactuacao_id:id, texto, autor: usuario.email }).select().single();
    if(error) return { ok:false, motivo:error.message };
    return { ok:true, nota:{ id:data.id, d:data.criado_em, t:data.texto, autor:data.autor } };
  }

  async function delAnotacao(id, notaId){
    if(!online){
      const a = lsGet('rp_acomp') || {};
      if(a[id]&&a[id].obs) a[id].obs = a[id].obs.filter(o=>o.id!==notaId);
      lsSet('rp_acomp', a);
      return { ok:true, local:true };
    }
    if(!podeEditar()) return { ok:false, motivo:'sem-permissao' };
    const { error } = await sb.from('anotacoes').delete().eq('id', notaId);
    return error ? { ok:false, motivo:error.message } : { ok:true };
  }

  /* vista é preenchida por editor no painel e aplicada a todos os ciclos do contrato */
  async function salvarVista(contratoId, valor){
    if(!online) return { ok:false, motivo:'painel em modo local' };
    if(!podeEditar()) return { ok:false, motivo:'sem-permissao' };
    const { error } = await sb.rpc('definir_vista', { p_contrato: contratoId, p_vista: valor || null });
    return error ? { ok:false, motivo:error.message } : { ok:true };
  }

  async function rpc(nome, args){
    if(!online) return { ok:false, motivo:'painel em modo local' };
    const { data, error } = await sb.rpc(nome, args);
    return error ? { ok:false, motivo:error.message } : { ok:true, dados:data };
  }

  async function historico(id){
    if(!online) return [];
    const { data } = await sb.from('historico').select('*').eq('repactuacao_id', id).order('criado_em',{ascending:false}).limit(30);
    return data||[];
  }

  /* ---------- utilidades ---------- */
  const num = v => (v===null||v===undefined||v==='') ? null : Number(v);
  function hojeISO(){ const d=new Date(); return d.toISOString().slice(0,10); }

  return {
    configurado, iniciar, entrar, sair, redefinirSenha, carregar,
    salvarCampo, addAnotacao, delAnotacao, historico, rpc, salvarVista,
    prefLocal: { get: lsGet, set: lsSet },
    get usuario(){ return usuario; },
    get online(){ return online; },
    podeEditar
  };
})();
