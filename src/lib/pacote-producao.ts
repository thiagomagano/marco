import Decimal from "decimal.js";
import { formatQuantity } from "./money.ts";
import { formatYmdBr, toYmdString } from "./date-utils.ts";
import {
  type PedidoShareData,
  validarPedidosParaPacote,
  wrapTextLines,
  loadBrandLogoImage,
  drawCanvasLetterhead,
  getPrintableLetterheadHtml,
  imprimirHtmlEmPapel,
  escapeHtml,
  sliceMasterCanvasToA4Pages,
  gerarPdfDeCanvases,
} from "./pedido-share.ts";

export interface ProdutoResumoProducao {
  codigo: string;
  nome: string;
  embalagem: string | null;
  unidade: string;
  quantidadeTotal: number;
  qtdPedidosComItem: number;
}

export interface ResumoProducaoData {
  frigorificoNome: string;
  dataGeracao: string;
  totalPedidos: number;
  numerosPedidos: string[];
  datasEmbarque: string[];
  embarquesPorPedido: Array<{ numero: string; dataEmbarqueBr: string | null }>;
  itens: ProdutoResumoProducao[];
  totalPesoKg: number;
  totaisOutrasUnidades: Array<{ unidade: string; quantidade: number }>;
}

/**
 * Consolida múltiplos pedidos CONFIRMADOS de um mesmo frigorífico em um
 * resumo agrupado por produto (código + embalagem + unidade) para produção/separação.
 * Não inclui preços ou valores financeiros.
 */
export function compilarDadosResumoProducao(
  pedidos: PedidoShareData[]
): ResumoProducaoData {
  const { frigorificoNome } = validarPedidosParaPacote(pedidos);

  const grupos = new Map<
    string,
    {
      codigo: string;
      nome: string;
      embalagem: string | null;
      unidade: string;
      quantidade: Decimal;
      pedidoKeys: Set<string>;
    }
  >();

  let totalPesoKg = new Decimal(0);
  const outrasUnidadesMap = new Map<string, Decimal>();
  const numerosPedidos = pedidos
    .map((p) => p.numero)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const datasEmbarqueYmd = new Set<string>();
  const embarquesPorPedido = [...pedidos]
    .sort((a, b) => (a.numero || "").localeCompare(b.numero || "", "pt-BR"))
    .map((p) => {
      const ymd = toYmdString(p.dataEmbarque);
      if (ymd) datasEmbarqueYmd.add(ymd);
      return {
        numero: p.numero,
        dataEmbarqueBr: ymd ? formatYmdBr(ymd) : null,
      };
    });
  const datasEmbarque = Array.from(datasEmbarqueYmd)
    .sort()
    .map((ymd) => formatYmdBr(ymd));

  pedidos.forEach((pedido, pedidoIdx) => {
    const pedidoKey = pedido.id || pedido.numero || `idx-${pedidoIdx}`;

    for (const item of pedido.itens || []) {
      const codigo = (item.produtoCodigoSnapshot || "").trim();
      const nome = (item.produtoNomeSnapshot || "-").trim();
      const embalagem = item.produtoEmbalagemSnapshot?.trim() || null;
      const unidadeOriginal = (item.produtoUnidadeSnapshot || "kg").trim();
      const unidadeNorm = unidadeOriginal.toLowerCase();

      const chave = [
        (codigo || nome).toLowerCase(),
        (embalagem || "").toLowerCase(),
        unidadeNorm,
      ].join("|");

      const qtd = new Decimal(item.quantidade || 0);

      const existente = grupos.get(chave);
      if (existente) {
        existente.quantidade = existente.quantidade.plus(qtd);
        existente.pedidoKeys.add(pedidoKey);
      } else {
        grupos.set(chave, {
          codigo: codigo || "-",
          nome,
          embalagem,
          unidade: unidadeOriginal,
          quantidade: qtd,
          pedidoKeys: new Set([pedidoKey]),
        });
      }

      if (unidadeNorm === "kg") {
        totalPesoKg = totalPesoKg.plus(qtd);
      } else {
        const atualOutra = outrasUnidadesMap.get(unidadeOriginal) || new Decimal(0);
        outrasUnidadesMap.set(unidadeOriginal, atualOutra.plus(qtd));
      }
    }
  });

  const itens: ProdutoResumoProducao[] = Array.from(grupos.values())
    .map((g) => {
      const isKg = g.unidade.toLowerCase() === "kg";
      return {
        codigo: g.codigo,
        nome: g.nome,
        embalagem: g.embalagem,
        unidade: g.unidade,
        quantidadeTotal: isKg
          ? g.quantidade.toDecimalPlaces(3).toNumber()
          : g.quantidade.toDecimalPlaces(0).toNumber(),
        qtdPedidosComItem: g.pedidoKeys.size,
      };
    })
    .sort((a, b) => {
      const cmpNome = a.nome.localeCompare(b.nome, "pt-BR", {
        sensitivity: "base",
      });
      if (cmpNome !== 0) return cmpNome;

      const cmpEmb = (a.embalagem || "").localeCompare(
        b.embalagem || "",
        "pt-BR",
        { sensitivity: "base" }
      );
      if (cmpEmb !== 0) return cmpEmb;

      const cmpCod = a.codigo.localeCompare(b.codigo, "pt-BR", {
        sensitivity: "base",
      });
      if (cmpCod !== 0) return cmpCod;

      return a.unidade.localeCompare(b.unidade, "pt-BR", {
        sensitivity: "base",
      });
    });

  const totaisOutrasUnidades = Array.from(outrasUnidadesMap.entries())
    .map(([unidade, qtd]) => ({
      unidade,
      quantidade: qtd.toDecimalPlaces(0).toNumber(),
    }))
    .sort((a, b) =>
      a.unidade.localeCompare(b.unidade, "pt-BR", { sensitivity: "base" })
    );

  return {
    frigorificoNome,
    dataGeracao: new Date().toISOString(),
    totalPedidos: pedidos.length,
    numerosPedidos,
    datasEmbarque,
    embarquesPorPedido,
    itens,
    totalPesoKg: totalPesoKg.toDecimalPlaces(3).toNumber(),
    totaisOutrasUnidades,
  };
}

export function gerarNomeArquivoProducao(
  prefixo: string,
  ext: "png" | "pdf" | "txt"
): string {
  const dataStr = new Date().toISOString().slice(0, 10);
  const limpo = (prefixo || "producao")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `producao-${limpo}-${dataStr}.${ext}`;
}

function formatarContagemPedidos(qtd: number): string {
  return qtd === 1 ? "1 pedido" : `${qtd} pedidos`;
}

export function gerarTextoWhatsAppProducao(resumo: ResumoProducaoData): string {
  const linhas: string[] = [];

  linhas.push(
    `*🏭 RESUMO DE PRODUÇÃO / SEPARAÇÃO - ${resumo.frigorificoNome.toUpperCase()}*`
  );
  linhas.push(`Data: ${new Date(resumo.dataGeracao).toLocaleDateString("pt-BR")}`);
  linhas.push(
    `Pedidos incluídos (${resumo.totalPedidos}): ${resumo.numerosPedidos.join(", ")}`
  );
  if (resumo.datasEmbarque.length === 1) {
    linhas.push(`Embarque/Carregamento: *${resumo.datasEmbarque[0]}*`);
  } else if (resumo.datasEmbarque.length > 1) {
    const detalhes = resumo.embarquesPorPedido
      .filter((e) => e.dataEmbarqueBr)
      .map((e) => `${e.numero} (${e.dataEmbarqueBr})`)
      .join(", ");
    linhas.push(`Embarques: *${resumo.datasEmbarque.join(", ")}* (${detalhes})`);
  }
  linhas.push("===============================");
  linhas.push("");

  linhas.push(`*RESUMO DE PRODUTOS (${resumo.itens.length}):*`);
  for (const item of resumo.itens) {
    const emb = item.embalagem ? ` [${item.embalagem}]` : "";
    const qtd = formatQuantity(item.quantidadeTotal, item.unidade);
    const pedLabel = formatarContagemPedidos(item.qtdPedidosComItem);
    linhas.push(
      `• (${item.codigo}) *${item.nome}*${emb}: *${qtd}* _(${pedLabel})_`
    );
  }

  linhas.push("");
  linhas.push("===============================");
  linhas.push(`*📊 TOTAIS DA SEPARAÇÃO:*`);
  linhas.push(`• Total de Pedidos: *${resumo.totalPedidos}*`);
  linhas.push(`• Total de Produtos: *${resumo.itens.length}*`);
  linhas.push(
    `• *Total de peso em ${formatarContagemPedidos(resumo.totalPedidos)}: ${formatQuantity(
      resumo.totalPesoKg,
      "kg"
    )}*`
  );
  if (resumo.totaisOutrasUnidades.length > 0) {
    const outrasStr = resumo.totaisOutrasUnidades
      .map((u) => formatQuantity(u.quantidade, u.unidade))
      .join(" • ");
    linhas.push(`• Outras Unidades: *${outrasStr}*`);
  }
  linhas.push("===============================");

  return linhas.join("\n");
}

export function gerarHtmlImpressaoA4Producao(
  resumo: ResumoProducaoData
): string {
  const dataGeracaoStr = new Date(resumo.dataGeracao).toLocaleString("pt-BR");
  const pedidosLabel = formatarContagemPedidos(resumo.totalPedidos);

  const linhasItensHtml = resumo.itens
    .map(
      (it, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="mono bold">${escapeHtml(it.codigo)}</td>
        <td class="bold">${escapeHtml(it.nome)}</td>
        <td>${escapeHtml(it.embalagem || "-")}</td>
        <td class="center">${escapeHtml(it.unidade)}</td>
        <td class="center">${escapeHtml(
          formatarContagemPedidos(it.qtdPedidosComItem)
        )}</td>
        <td class="right bold qty-cell">${escapeHtml(
          formatQuantity(it.quantidadeTotal, it.unidade)
        )}</td>
      </tr>`
    )
    .join("");

  const outrasUnidadesHtml =
    resumo.totaisOutrasUnidades.length > 0
      ? `<div class="summary-extra">Outras unidades: <strong>${escapeHtml(
          resumo.totaisOutrasUnidades
            .map((u) => formatQuantity(u.quantidade, u.unidade))
            .join(" • ")
        )}</strong></div>`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Resumo de Produção - ${escapeHtml(resumo.frigorificoNome)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.35;
    }
    .page {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
    }
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1.5px solid #000000;
      border-bottom: 3px solid #000000;
      background: #f8fafc;
      padding: 10px 14px;
      margin-bottom: 10px;
    }
    .letterhead-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .letterhead-logo {
      max-height: 46px;
      max-width: 125px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      border-radius: 4px;
    }
    .letterhead-company {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.3px;
      color: #0f172a;
    }
    .letterhead-subtitle {
      font-size: 9.5px;
      font-weight: 600;
      color: #475569;
      margin-top: 1px;
    }
    .letterhead-doc {
      text-align: right;
    }
    .letterhead-doc-type {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
    }
    .letterhead-doc-ref {
      font-size: 12.5px;
      font-weight: 800;
      margin-top: 1px;
    }
    .letterhead-doc-date {
      font-size: 9px;
      color: #475569;
      margin-top: 1px;
    }
    .main-header {
      border: 1.5px solid #000000;
      padding: 10px 14px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .main-title {
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .main-subtitle {
      font-size: 10px;
      color: #333333;
      margin-top: 2px;
    }
    .main-totals-badge {
      text-align: right;
      border-left: 1.5px solid #000000;
      padding-left: 14px;
      shrink: 0;
      white-space: nowrap;
    }
    .main-totals-val {
      font-size: 18px;
      font-weight: 800;
    }
    .orders-ref-box {
      border: 1px solid #444444;
      background: #fafafa;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 9.5px;
      color: #222222;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
    }
    .items-table th {
      background: #eeeeee;
      font-size: 9px;
      text-transform: uppercase;
      text-align: left;
      padding: 6px 7px;
      border-bottom: 1.5px solid #000000;
      border-right: 1px solid #cccccc;
    }
    .items-table th:last-child {
      border-right: none;
    }
    .items-table td {
      padding: 6px 7px;
      border-bottom: 1px solid #dddddd;
      border-right: 1px solid #eeeeee;
      font-size: 10.5px;
      vertical-align: middle;
    }
    .items-table td:last-child {
      border-right: none;
    }
    .items-table tr:nth-child(even) td {
      background: #fafafa;
    }
    .center { text-align: center !important; }
    .right { text-align: right !important; }
    .bold { font-weight: 700; }
    .mono { font-family: "Courier New", Courier, monospace; }
    .qty-cell { font-size: 11px; }
    .summary-box {
      border: 1.5px solid #000000;
      background: #f5f5f5;
      padding: 10px 14px;
      margin-top: 12px;
      page-break-inside: avoid;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .summary-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .summary-details {
      font-size: 10px;
      color: #333333;
      margin-top: 2px;
    }
    .summary-extra {
      font-size: 10px;
      color: #222222;
      margin-top: 2px;
    }
    .summary-total {
      text-align: right;
      white-space: nowrap;
    }
    .summary-total-val {
      font-size: 18px;
      font-weight: 800;
    }
    .footer-meta {
      margin-top: 14px;
      border-top: 1px dashed #777777;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #444444;
    }
  </style>
</head>
<body>
  <div class="page">
    ${getPrintableLetterheadHtml(
      "Resumo de Produção • Separação",
      resumo.frigorificoNome,
      `Gerado em ${dataGeracaoStr}`
    )}
    <div class="main-header">
      <div>
        <div class="main-title">Resumo de Produtos &bull; ${escapeHtml(
          resumo.frigorificoNome
        )}</div>
        <div class="main-subtitle">
          Separação / Produção &bull; <strong>${resumo.totalPedidos}</strong> ${
            resumo.totalPedidos === 1 ? "pedido" : "pedidos"
          } &bull; <strong>${resumo.itens.length}</strong> ${
            resumo.itens.length === 1 ? "produto" : "produtos"
          }
        </div>
      </div>
      <div class="main-totals-badge">
        <div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Total de Peso (${escapeHtml(
          pedidosLabel
        )})</div>
        <div class="main-totals-val">${escapeHtml(
          formatQuantity(resumo.totalPesoKg, "kg")
        )}</div>
      </div>
    </div>

    <div class="orders-ref-box">
      <div><strong>Pedidos incluídos (${resumo.totalPedidos}):</strong> ${escapeHtml(
        resumo.numerosPedidos.join(", ")
      )}</div>
      ${
        resumo.datasEmbarque.length > 0
          ? `<div style="margin-top: 3px;"><strong>${escapeHtml(
              resumo.datasEmbarque.length === 1
                ? "Embarque/Carregamento:"
                : "Datas de Embarque:"
            )}</strong> ${escapeHtml(resumo.datasEmbarque.join(", "))}</div>`
          : ""
      }
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width: 28px;">#</th>
          <th style="width: 68px;">Código</th>
          <th>Produto</th>
          <th style="width: 110px;">Embalagem</th>
          <th class="center" style="width: 48px;">Unid.</th>
          <th class="center" style="width: 78px;">Pedidos</th>
          <th class="right" style="width: 105px;">Qtd. / Peso Total</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
    </table>

    <div class="summary-box">
      <div>
        <div class="summary-title">Total de peso em ${escapeHtml(
          pedidosLabel
        )}</div>
        <div class="summary-details">
          Total de Pedidos: <strong>${resumo.totalPedidos}</strong> &bull;
          Total de Produtos: <strong>${resumo.itens.length}</strong>
        </div>
        ${outrasUnidadesHtml}
      </div>
      <div class="summary-total">
        <div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Peso Total (kg)</div>
        <div class="summary-total-val">${escapeHtml(
          formatQuantity(resumo.totalPesoKg, "kg")
        )}</div>
      </div>
    </div>

    <div class="footer-meta">
      <span>Sistema de Pedidos Comerciais &bull; Resumo de Produção/Separação</span>
      <span>${escapeHtml(dataGeracaoStr)}</span>
    </div>
  </div>
</body>
</html>`;
}

export function imprimirResumoProducaoEmPapel(
  resumo: ResumoProducaoData
): void {
  imprimirHtmlEmPapel(gerarHtmlImpressaoA4Producao(resumo));
}

export async function renderizarPaginasA4ProducaoCanvas(
  resumo: ResumoProducaoData
): Promise<HTMLCanvasElement[]> {
  const FONT_SANS = "Arial, Helvetica, sans-serif";
  const FONT_MONO = "'Courier New', Courier, monospace";

  const PAGE_W = 794;
  const PAGE_H = 1123;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2; // 714
  const SCALE = 2;

  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Contexto Canvas 2D indisponível.");
  }

  const brandLogo = await loadBrandLogoImage();

  const letterheadH = 72;
  const headerH = 68;

  mCtx.font = `400 9.5px ${FONT_SANS}`;
  const pedidosRefText = `Pedidos incluídos (${resumo.totalPedidos}): ${resumo.numerosPedidos.join(", ")}`;
  const pedidosRefLines = wrapTextLines(mCtx, pedidosRefText, CONTENT_W - 20);
  const embarqueRefText =
    resumo.datasEmbarque.length === 1
      ? `Embarque/Carregamento: ${resumo.datasEmbarque[0]}`
      : resumo.datasEmbarque.length > 1
      ? `Datas de Embarque: ${resumo.datasEmbarque.join(", ")}`
      : "";
  const embarqueRefLines = embarqueRefText
    ? wrapTextLines(mCtx, embarqueRefText, CONTENT_W - 20)
    : [];
  const totalRefLines = pedidosRefLines.length + embarqueRefLines.length;
  const pedidosRefBoxH = Math.max(28, totalRefLines * 13 + 12);

  // Colunas: # (30) | Código (68) | Produto (252) | Embalagem (114) | Unid (52) | Pedidos (78) | Qtd/Peso (120) = 714
  const colWidths = [30, 68, 252, 114, 52, 78, 120];
  const colStarts: number[] = [];
  let curX = MARGIN;
  for (const w of colWidths) {
    colStarts.push(curX);
    curX += w;
  }

  mCtx.font = `700 10.5px ${FONT_SANS}`;
  const measuredRows = resumo.itens.map((it) => {
    const prodLines = wrapTextLines(mCtx, it.nome || "-", colWidths[2] - 10);
    const embLines = wrapTextLines(
      mCtx,
      it.embalagem || "-",
      colWidths[3] - 10
    );
    const maxLines = Math.max(prodLines.length, embLines.length);
    const h = Math.max(26, maxLines * 14 + 10);
    return { prodLines, embLines, h };
  });

  const tableHeaderH = 24;
  const totalRowsH = measuredRows.reduce((acc, r) => acc + r.h, 0);
  const sumH = resumo.totaisOutrasUnidades.length > 0 ? 64 : 52;
  const footerH = 34;

  const dynamicHeight =
    MARGIN * 2 +
    letterheadH +
    10 +
    headerH +
    10 +
    pedidosRefBoxH +
    10 +
    tableHeaderH +
    totalRowsH +
    14 +
    sumH +
    footerH;

  const usablePageH = PAGE_H - MARGIN * 2;
  const numPages = Math.max(1, Math.ceil(dynamicHeight / usablePageH));
  const masterH = Math.max(PAGE_H, MARGIN * 2 + numPages * usablePageH);

  const masterCanvas = document.createElement("canvas");
  masterCanvas.width = PAGE_W * SCALE;
  masterCanvas.height = masterH * SCALE;
  const ctx = masterCanvas.getContext("2d");
  if (!ctx) throw new Error("Erro ao criar canvas do resumo de produção.");

  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, masterH);

  let y = MARGIN;
  const x0 = MARGIN;
  const xRight = MARGIN + CONTENT_W;
  const dataGeracaoStr = new Date(resumo.dataGeracao).toLocaleString("pt-BR");
  const pedidosLabel = formatarContagemPedidos(resumo.totalPedidos);

  // 0. Cabeçalho Institucional Timbrado
  drawCanvasLetterhead(ctx, brandLogo, {
    x: x0,
    y,
    width: CONTENT_W,
    height: letterheadH,
    padX: 12,
    fontFamily: FONT_SANS,
    docTitle: "Resumo de Produção • Separação",
    docRef: resumo.frigorificoNome.toUpperCase(),
    docDate: `Gerado em ${dataGeracaoStr}`,
    borderColor: "#000000",
    outerBorder: true,
  });
  y += letterheadH + 10;

  // 1. Caixa Principal do Resumo
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y, CONTENT_W, headerH);

  ctx.fillStyle = "#000000";
  ctx.font = `800 14.5px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `RESUMO DE PRODUTOS • ${resumo.frigorificoNome.toUpperCase()}`,
    x0 + 12,
    y + 26
  );

  ctx.font = `400 10px ${FONT_SANS}`;
  ctx.fillStyle = "#333333";
  ctx.fillText(
    `Separação / Produção • ${pedidosLabel} • ${resumo.itens.length} ${
      resumo.itens.length === 1 ? "produto distinto" : "produtos distintos"
    }`,
    x0 + 12,
    y + 47
  );

  // Badge à direita com Peso Total
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xRight - 195, y + 8);
  ctx.lineTo(xRight - 195, y + headerH - 8);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.font = `700 8.5px ${FONT_SANS}`;
  ctx.fillText(
    `TOTAL DE PESO (${pedidosLabel.toUpperCase()})`,
    xRight - 12,
    y + 22
  );

  ctx.fillStyle = "#000000";
  ctx.font = `800 18px ${FONT_SANS}`;
  ctx.fillText(
    formatQuantity(resumo.totalPesoKg, "kg"),
    xRight - 12,
    y + 48
  );

  y += headerH + 10;

  // 2. Caixa de Referência dos Pedidos
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(x0, y, CONTENT_W, pedidosRefBoxH);
  ctx.strokeStyle = "#444444";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y, CONTENT_W, pedidosRefBoxH);

  ctx.fillStyle = "#222222";
  ctx.font = `400 9.5px ${FONT_SANS}`;
  ctx.textAlign = "left";
  let refY = y + 16;
  for (const line of pedidosRefLines) {
    ctx.fillText(line, x0 + 10, refY);
    refY += 13;
  }
  if (embarqueRefLines.length > 0) {
    ctx.font = `700 9.5px ${FONT_SANS}`;
    for (const line of embarqueRefLines) {
      ctx.fillText(line, x0 + 10, refY);
      refY += 13;
    }
  }
  y += pedidosRefBoxH + 10;

  // 3. Tabela Consolidada de Produtos
  const tableStartY = y;
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(x0, y, CONTENT_W, tableHeaderH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y + tableHeaderH);
  ctx.lineTo(xRight, y + tableHeaderH);
  ctx.stroke();

  const headers = [
    { text: "#", align: "center" as const },
    { text: "CÓDIGO", align: "left" as const },
    { text: "PRODUTO", align: "left" as const },
    { text: "EMBALAGEM", align: "left" as const },
    { text: "UNID.", align: "center" as const },
    { text: "PEDIDOS", align: "center" as const },
    { text: "QTD. / PESO TOTAL", align: "right" as const },
  ];

  ctx.fillStyle = "#000000";
  ctx.font = `700 8.5px ${FONT_SANS}`;
  headers.forEach((h, i) => {
    ctx.textAlign = h.align;
    const xPos =
      h.align === "center"
        ? colStarts[i] + colWidths[i] / 2
        : h.align === "right"
        ? colStarts[i] + colWidths[i] - 8
        : colStarts[i] + 6;
    ctx.fillText(h.text, xPos, y + 15);
  });

  y += tableHeaderH;

  resumo.itens.forEach((it, idx) => {
    const { prodLines, embLines, h } = measuredRows[idx];

    if (idx % 2 === 1) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(x0, y, CONTENT_W, h);
    }

    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y + h);
    ctx.lineTo(xRight, y + h);
    ctx.stroke();

    const midY = y + 16;

    // #
    ctx.fillStyle = "#333333";
    ctx.font = `400 10px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(String(idx + 1), colStarts[0] + colWidths[0] / 2, midY);

    // Código
    ctx.fillStyle = "#000000";
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(it.codigo, colStarts[1] + 6, midY);

    // Produto
    ctx.font = `700 10.5px ${FONT_SANS}`;
    let pY = y + 16;
    for (const line of prodLines) {
      ctx.fillText(line, colStarts[2] + 6, pY);
      pY += 14;
    }

    // Embalagem
    ctx.fillStyle = "#333333";
    ctx.font = `400 10px ${FONT_SANS}`;
    let eY = y + 16;
    for (const line of embLines) {
      ctx.fillText(line, colStarts[3] + 6, eY);
      eY += 14;
    }

    // Unidade
    ctx.fillStyle = "#222222";
    ctx.textAlign = "center";
    ctx.fillText(it.unidade, colStarts[4] + colWidths[4] / 2, midY);

    // Pedidos
    ctx.fillStyle = "#333333";
    ctx.font = `600 9.5px ${FONT_SANS}`;
    ctx.fillText(
      formatarContagemPedidos(it.qtdPedidosComItem),
      colStarts[5] + colWidths[5] / 2,
      midY
    );

    // Quantidade / Peso Total
    ctx.fillStyle = "#000000";
    ctx.font = `800 11px ${FONT_SANS}`;
    ctx.textAlign = "right";
    ctx.fillText(
      formatQuantity(it.quantidadeTotal, it.unidade),
      colStarts[6] + colWidths[6] - 8,
      midY
    );

    y += h;
  });

  // Borda externa da tabela
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, tableStartY, CONTENT_W, y - tableStartY);

  y += 14;

  // 4. Caixa de Totais da Separação
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(x0, y, CONTENT_W, sumH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y, CONTENT_W, sumH);

  ctx.fillStyle = "#000000";
  ctx.font = `800 11px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `TOTAL DE PESO EM ${pedidosLabel.toUpperCase()}`,
    x0 + 12,
    y + 20
  );

  ctx.font = `600 10px ${FONT_SANS}`;
  ctx.fillStyle = "#333333";
  ctx.fillText(
    `Total de Pedidos: ${resumo.totalPedidos}   •   Total de Produtos: ${resumo.itens.length}`,
    x0 + 12,
    y + 37
  );

  if (resumo.totaisOutrasUnidades.length > 0) {
    const outrasStr = resumo.totaisOutrasUnidades
      .map((u) => formatQuantity(u.quantidade, u.unidade))
      .join(" • ");
    ctx.fillStyle = "#222222";
    ctx.fillText(`Outras unidades: ${outrasStr}`, x0 + 12, y + 53);
  }

  ctx.textAlign = "right";
  ctx.font = `700 9px ${FONT_SANS}`;
  ctx.fillStyle = "#222222";
  ctx.fillText("PESO TOTAL (KG):", xRight - 12, y + 18);

  ctx.font = `800 18px ${FONT_SANS}`;
  ctx.fillStyle = "#000000";
  ctx.fillText(
    formatQuantity(resumo.totalPesoKg, "kg"),
    xRight - 12,
    y + 41
  );

  y += sumH + 18;

  // 5. Rodapé
  ctx.fillStyle = "#666666";
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("Resumo de Produção / Separação • Sistema Marco", x0, y);
  ctx.textAlign = "right";
  ctx.fillText(`Emitido em ${dataGeracaoStr}`, xRight, y);

  return sliceMasterCanvasToA4Pages(
    masterCanvas,
    PAGE_W,
    PAGE_H,
    MARGIN,
    usablePageH,
    numPages,
    SCALE
  );
}

export async function gerarImagemPrintProducao(
  resumo: ResumoProducaoData
): Promise<Blob> {
  const pages = await renderizarPaginasA4ProducaoCanvas(resumo);
  const firstPage = pages[0] || document.createElement("canvas");

  return new Promise<Blob>((resolve, reject) => {
    firstPage.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Falha ao gerar imagem do resumo de produção."));
      }
    }, "image/png");
  });
}

export async function gerarArquivoPdfProducao(
  resumo: ResumoProducaoData
): Promise<Blob> {
  const pageCanvases = await renderizarPaginasA4ProducaoCanvas(resumo);
  return gerarPdfDeCanvases(pageCanvases);
}
