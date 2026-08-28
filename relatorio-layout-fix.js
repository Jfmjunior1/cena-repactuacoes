/* Ajustes de layout aprovados para os relatórios da Cena.
   Carregado após o gerador principal para preservar a lógica e alterar apenas a apresentação. */
(function () {
  const originalDocHTML = window.docHTML;
  const originalDocMensal = window.docMensal;

  if (typeof originalDocHTML !== 'function' || typeof originalDocMensal !== 'function') return;

  const palette = ['#173B57', '#275A70', '#416878', '#546F7B', '#3D5E70', '#6B7E86'];
  const bandColor = sig => {
    let h = 0;
    String(sig || '').split('').forEach(ch => { h = ((h << 5) - h) + ch.charCodeAt(0); h |= 0; });
    return palette[Math.abs(h) % palette.length];
  };

  function semCapa(html) {
    return html.replace(/\s*<section class="capa">[\s\S]*?<\/section>\s*/i, '\n');
  }

  function cabecalhoCena(html) {
    const css = `
      .phead{min-height:13mm;border-bottom:1px solid #e2e8ec;padding:0 0 3mm!important;margin-bottom:3mm;}
      .phead img{height:11mm!important;width:auto!important;max-width:42mm;object-fit:contain;image-rendering:auto;}
      .band{break-after:avoid;page-break-after:avoid;border-radius:2px 2px 0 0;margin-top:7mm!important;}
      .band + table{margin-top:0;}
      @media print{.phead{min-height:13mm}.phead img{height:11mm!important;width:auto!important}}
    `;
    return html.replace('</style>', css + '</style>');
  }

  function separaEmpreendimentos(html) {
    return html.replace(
      /<h3>([\s\S]*?)\s*<span class="lt">·\s*([^·<]+?)\s*·\s*([^<]+)<\/span><\/h3>/g,
      (_, nome, sig, qtd) => `<div class="band" style="background:${bandColor(sig.trim())}">${nome.trim()}<span>${sig.trim()} · ${qtd.trim()}</span></div>`
    );
  }

  window.docHTML = function (paraExcel) {
    let html = originalDocHTML(paraExcel);
    if (!paraExcel) html = semCapa(html);
    html = separaEmpreendimentos(html);
    return cabecalhoCena(html);
  };

  window.docMensal = function () {
    let html = originalDocMensal();
    html = semCapa(html);
    return cabecalhoCena(html);
  };
})();
