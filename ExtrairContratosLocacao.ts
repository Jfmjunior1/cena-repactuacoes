/**
 * Office Script — "Extrair contratos de locação"
 * Arquivo: Controle Contratos de Locação 2023 , 2024 ,  2025 e 2026.xlsx
 * Aba lida: "Consolidado - Imóveis"
 *
 * Lê a aba de cadastro e devolve um objeto JSON com uma entrada por contrato,
 * no formato que a função sincronizar_planilha() do Supabase espera.
 *
 * Como instalar: abra a planilha no Excel para a web → Automatizar → Novo script →
 * cole este conteúdo → salve com o nome "Extrair contratos de locacao".
 *
 * O script NÃO usa números de linha fixos: ele identifica cada empreendimento pela
 * faixa de título, então continua funcionando quando o Financeiro inserir ou apagar linhas.
 */

const EMPREENDIMENTOS: { [nome: string]: string } = {
  "BAIA SUL MEDICAL CENTER": "BMC",
  "CENTRO EMPRESARIAL FLORIANÓPOLIS": "CEF",
  "CENTRO EXECUTIVO CARL HOEPCKE": "CECH",
  "CENTRO EXECUTIVO FERREIRA LIMA": "CEFL",
  "PLAZA DANÚBIO RESIDENCE": "PDR",
  "GALPÃO CAIS DO PORTO": "CAIS",
  "SHOPPING DEODORO": "DEO",
  "TERRENO TROMPOWSKY": "TROMP",
  "CASA CRISPIM MIRA": "CCM",
  "SQUARE CORPORATE": "SQR",
  "EDIFÍCIO COMERCIAL PRIMER TOWER": "PRIMER",
  "ALBERTO SANTIAGO RESIDENCE": "ASR",
  "MARINE": "MAR",
  "SAINT-TROPEZ": "STZ",
  "CÔTE D'AZUR VILLE": "CAV"
};

// colunas (base 0) da aba Consolidado - Imóveis
const COL = {
  admin: 0, locador: 1, cliente: 2, unidade: 3, garagem: 4,
  valor: 5, m2a: 6, m2b: 7, rm2: 8,
  inicio: 13, fim: 14, ultima: 15, proxima: 16, historico: 17
};

type Contrato = {
  sigla: string; cliente: string; unidade: string; garagem: string;
  m2: string; valor: string; rm2: string;
  inicio: string; fim: string; ultima: string; proxima: string;
  historico: string; locador: string; administracao: string; situacao: string;
};

function main(workbook: ExcelScript.Workbook): { contratos: Contrato[]; lidoEm: string; linhas: number } {
  const aba = workbook.getWorksheet("Consolidado - Imóveis");
  if (!aba) throw new Error("Aba 'Consolidado - Imóveis' não encontrada.");

  const faixa = aba.getUsedRange();
  const val = faixa.getValues();
  const txt = faixa.getTexts();

  const contratos: Contrato[] = [];
  let sigla = "";

  for (let i = 0; i < val.length; i++) {
    const linha = val[i];

    // a linha é uma faixa de título de empreendimento?
    const novaSigla = detectaEmpreendimento(linha);
    if (novaSigla) { sigla = novaSigla; continue; }
    if (!sigla) continue;

    const cliente = limpa(linha[COL.cliente]);
    const unidade = limpa(linha[COL.unidade]);
    if (!cliente && !unidade) continue;                       // linha em branco ou separador
    if (ehCabecalho(cliente)) continue;                       // linha "CLIENTE / UNIDADE / ..."
    if (cliente.toUpperCase().indexOf("TOTAL") === 0) continue;

    const m2 = num(linha[COL.m2a]) + num(linha[COL.m2b]);

    contratos.push({
      sigla: sigla,
      cliente: cliente || "VAGO",
      unidade: unidade || "-",
      garagem: limpa(linha[COL.garagem]) || "-",
      m2: m2 > 0 ? String(m2) : "",
      valor: num(linha[COL.valor]) > 0 ? String(num(linha[COL.valor])) : "",
      rm2: num(linha[COL.rm2]) > 0 ? String(num(linha[COL.rm2])) : "",
      inicio: data(linha[COL.inicio], txt[i][COL.inicio]),
      fim: data(linha[COL.fim], txt[i][COL.fim]),
      ultima: data(linha[COL.ultima], txt[i][COL.ultima]),
      proxima: data(linha[COL.proxima], txt[i][COL.proxima]),
      historico: limpa(linha[COL.historico]),
      locador: limpa(linha[COL.locador]),
      administracao: limpa(linha[COL.admin]),
      // texto livre que o Financeiro escreve no lugar da data entra como situação
      situacao: textoLivre(txt[i][COL.proxima]) || textoLivre(txt[i][COL.ultima]) || ""
    });
  }

  if (contratos.length < 20) {
    throw new Error("Foram lidos apenas " + contratos.length + " contratos. A aba pode ter mudado de formato — sincronização interrompida.");
  }

  return { contratos: contratos, lidoEm: new Date().toISOString(), linhas: val.length };
}

/* ---------- auxiliares ---------- */

function limpa(v: string | number | boolean): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: string | number | boolean): number {
  return typeof v === "number" && !isNaN(v) ? v : 0;
}

function ehCabecalho(c: string): boolean {
  const u = c.toUpperCase();
  return u === "CLIENTE" || u === "PROPRIETÁRIO" || u === "PROPRIETARIO" || u === "ADMINISTRAÇÃO";
}

function detectaEmpreendimento(linha: (string | number | boolean)[]): string {
  for (let c = 0; c < Math.min(linha.length, 6); c++) {
    const t = limpa(linha[c]).toUpperCase();
    if (!t) continue;
    for (const nome of Object.keys(EMPREENDIMENTOS)) {
      if (t === nome.toUpperCase()) return EMPREENDIMENTOS[nome];
    }
  }
  return "";
}

/** Converte serial do Excel ou texto dd/mm/aaaa em AAAA-MM-DD. Texto livre volta vazio. */
function data(bruto: string | number | boolean, exibido: string): string {
  if (typeof bruto === "number" && bruto > 20000 && bruto < 80000) {
    const ms = Math.round((bruto - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(exibido || bruto || ""));
  if (!m) return "";
  const d = ("0" + m[1]).slice(-2);
  const mes = ("0" + m[2]).slice(-2);
  if (Number(mes) < 1 || Number(mes) > 12) return "";
  return m[3] + "-" + mes + "-" + d;
}

/** Devolve o conteúdo da célula quando ela traz uma observação em vez de uma data. */
function textoLivre(exibido: string): string {
  const t = limpa(exibido);
  if (!t || t === "-") return "";
  if (/(\d{1,2})\/(\d{1,2})\/(\d{4})/.test(t)) return "";
  return t;
}
