import { formatCurrency, formatQuantity } from "./money.ts";

export interface PedidoShareItem {
  id?: string;
  produtoCodigoSnapshot: string;
  produtoNomeSnapshot: string;
  produtoUnidadeSnapshot: string;
  produtoEmbalagemSnapshot?: string | null;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface PedidoShareData {
  id?: string;
  numero: string;
  status: string;
  observacoes: string | null;
  totalEstimado: number;
  pesoInformadoKg: number | null;
  justificativaCancelamento?: string | null;
  dataCriacao: string;
  dataConfirmacao: string | null;
  dataCancelamento?: string | null;
  frigorifico: {
    nomeFantasia: string;
    cnpj: string | null;
    telefone: string | null;
  };
  cliente: {
    razaoSocialOuNome: string;
    nomeFantasia: string | null;
    cnpj: string | null;
    telefone: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    cep: string | null;
  };
  vendedor: {
    nome: string;
    telefone: string | null;
  };
  itens: PedidoShareItem[];
}

export function gerarNomeArquivoPrint(numeroPedido: string): string {
  const limpo = (numeroPedido || "pedido")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  return `pedido-${limpo}.png`;
}

export function formatarEnderecoCliente(
  cliente: PedidoShareData["cliente"]
): string {
  const partes = [
    cliente.endereco?.trim() || null,
    cliente.bairro?.trim() ? `Bairro ${cliente.bairro.trim()}` : null,
    cliente.cidade?.trim() || null,
    cliente.cep?.trim() ? `CEP ${cliente.cep.trim()}` : null,
  ].filter(Boolean);

  return partes.join(" • ");
}

export function gerarTextoResumoWhatsApp(pedido: PedidoShareData): string {
  const linhas: string[] = [];

  linhas.push(`*RESUMO DO PEDIDO ${pedido.numero}*`);
  linhas.push(`Status: *${pedido.status}*`);
  linhas.push(
    `Data: ${new Date(pedido.dataCriacao).toLocaleDateString("pt-BR")}`
  );
  linhas.push("");

  linhas.push(`*Frigorífico:* ${pedido.frigorifico.nomeFantasia}`);
  if (pedido.frigorifico.cnpj) {
    linhas.push(`CNPJ Frigorífico: ${pedido.frigorifico.cnpj}`);
  }

  const nomeCliente =
    pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome;
  linhas.push(`*Cliente:* ${nomeCliente}`);
  if (
    pedido.cliente.nomeFantasia &&
    pedido.cliente.razaoSocialOuNome &&
    pedido.cliente.nomeFantasia !== pedido.cliente.razaoSocialOuNome
  ) {
    linhas.push(`Razão Social: ${pedido.cliente.razaoSocialOuNome}`);
  }
  if (pedido.cliente.cnpj) {
    linhas.push(`CNPJ Cliente: ${pedido.cliente.cnpj}`);
  }
  const enderecoCompleto = formatarEnderecoCliente(pedido.cliente);
  if (enderecoCompleto) {
    linhas.push(`Endereço: ${enderecoCompleto}`);
  }
  if (pedido.cliente.telefone) {
    linhas.push(`Tel. Cliente: ${pedido.cliente.telefone}`);
  }

  linhas.push(`*Vendedor:* ${pedido.vendedor.nome}`);
  linhas.push("");

  linhas.push(`*ITENS DO PEDIDO (${pedido.itens.length}):*`);
  for (const item of pedido.itens) {
    const emb = item.produtoEmbalagemSnapshot
      ? ` [${item.produtoEmbalagemSnapshot}]`
      : "";
    const qtd = formatQuantity(item.quantidade, item.produtoUnidadeSnapshot);
    const preco = formatCurrency(item.precoUnitario);
    const sub = formatCurrency(item.subtotal);
    linhas.push(
      `• (${item.produtoCodigoSnapshot}) *${item.produtoNomeSnapshot}*${emb}: ${qtd} x ${preco} = *${sub}*`
    );
  }

  linhas.push("");
  if (pedido.pesoInformadoKg) {
    linhas.push(
      `Peso Informado: *${formatQuantity(pedido.pesoInformadoKg, "kg")}*`
    );
  }
  linhas.push(`*TOTAL ESTIMADO: ${formatCurrency(pedido.totalEstimado)}*`);

  if (pedido.observacoes && pedido.observacoes.trim()) {
    linhas.push("");
    linhas.push(`*Observações:* ${pedido.observacoes.trim()}`);
  }

  if (pedido.status === "CANCELADO" && pedido.justificativaCancelamento) {
    linhas.push("");
    linhas.push(
      `*Justificativa do Cancelamento:* ${pedido.justificativaCancelamento}`
    );
  }

  return linhas.join("\n");
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Gera uma imagem PNG de alta definição (2x DPI) com o resumo completo do pedido,
 * ideal para compartilhar via WhatsApp Web/Desktop (Ctrl+V) ou aplicativo móvel.
 */
export async function gerarImagemPrintPedido(
  pedido: PedidoShareData
): Promise<Blob> {
  const FONT_FAMILY =
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const MONO_FAMILY =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

  const WIDTH = 920;
  const OUTER_PAD = 24;
  const CARD_X = OUTER_PAD;
  const CARD_W = WIDTH - OUTER_PAD * 2;
  const INNER_PAD = 32;
  const CONTENT_X = CARD_X + INNER_PAD;
  const CONTENT_W = CARD_W - INNER_PAD * 2;

  // Canvas temporário para medição precisa de linhas
  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Contexto Canvas 2D indisponível neste navegador.");
  }

  // 1. Medir linhas da seção de partes comerciais (3 colunas)
  const colGap = 24;
  const colW = (CONTENT_W - colGap * 2) / 3;

  mCtx.font = `700 14px ${FONT_FAMILY}`;
  const frigNomeLines = wrapTextLines(
    mCtx,
    pedido.frigorifico.nomeFantasia,
    colW
  );

  const clienteTitulo =
    pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome;
  const clienteNomeLines = wrapTextLines(mCtx, clienteTitulo, colW);

  const vendNomeLines = wrapTextLines(mCtx, pedido.vendedor.nome, colW);

  mCtx.font = `400 12px ${FONT_FAMILY}`;
  const clienteRazaoLines =
    pedido.cliente.nomeFantasia &&
    pedido.cliente.razaoSocialOuNome &&
    pedido.cliente.nomeFantasia !== pedido.cliente.razaoSocialOuNome
      ? wrapTextLines(mCtx, pedido.cliente.razaoSocialOuNome, colW)
      : [];

  const enderecoStr = formatarEnderecoCliente(pedido.cliente);
  const clienteEndLines = enderecoStr
    ? wrapTextLines(mCtx, `Endereço: ${enderecoStr}`, colW)
    : [];

  const col1Height =
    20 +
    frigNomeLines.length * 18 +
    (pedido.frigorifico.cnpj ? 17 : 0) +
    (pedido.frigorifico.telefone ? 17 : 0);

  const col2Height =
    20 +
    clienteNomeLines.length * 18 +
    clienteRazaoLines.length * 16 +
    (pedido.cliente.cnpj ? 17 : 0) +
    (pedido.cliente.telefone ? 17 : 0) +
    clienteEndLines.length * 16;

  const col3Height =
    20 +
    vendNomeLines.length * 18 +
    (pedido.vendedor.telefone ? 17 : 0);

  const commercialSectionH =
    Math.max(col1Height, col2Height, col3Height) + 44;

  // 2. Medir linhas da tabela de itens
  // Colunas da tabela:
  // Código (90) | Produto (280) | Embalagem (120) | Unid (65) | Qtd (95) | Preço Unit (100) | Subtotal (114) = 864 (CONTENT_W = 808)
  // Ajustando para CONTENT_W = 808:
  // Código: 80 | Produto: 258 | Embalagem: 115 | Unid: 60 | Qtd: 90 | Preço: 100 | Subtotal: 105 = 808
  const COL_PROD_W = 245;
  mCtx.font = `600 12px ${FONT_FAMILY}`;
  const itemRowMeasurements = pedido.itens.map((it) => {
    const prodLines = wrapTextLines(
      mCtx,
      it.produtoNomeSnapshot || "-",
      COL_PROD_W
    );
    const rowH = Math.max(38, prodLines.length * 16 + 18);
    return { prodLines, rowH };
  });

  const totalItemsRowsH = itemRowMeasurements.reduce(
    (acc, cur) => acc + cur.rowH,
    0
  );

  // 3. Medir observações e justificativa de cancelamento
  mCtx.font = `400 12px ${FONT_FAMILY}`;
  const obsLines =
    pedido.observacoes && pedido.observacoes.trim()
      ? wrapTextLines(mCtx, pedido.observacoes.trim(), CONTENT_W - 24)
      : [];
  const obsSectionH = obsLines.length > 0 ? 44 + obsLines.length * 17 + 16 : 0;

  const cancelLines =
    pedido.status === "CANCELADO" && pedido.justificativaCancelamento
      ? wrapTextLines(
          mCtx,
          `Justificativa: "${pedido.justificativaCancelamento}"`,
          CONTENT_W - 36
        )
      : [];
  const cancelBannerH =
    pedido.status === "CANCELADO"
      ? Math.max(64, 38 + cancelLines.length * 16 + 16)
      : 0;

  const headerSectionH = 104;
  const tableHeaderAreaH = 44 + 36; // Título "Itens do Pedido" + cabeçalho da tabela
  const tableFooterH = 46;
  const cardBottomPad = 44; // Rodapé com data de geração

  const CARD_H =
    cancelBannerH +
    headerSectionH +
    commercialSectionH +
    24 +
    tableHeaderAreaH +
    totalItemsRowsH +
    tableFooterH +
    obsSectionH +
    cardBottomPad;

  const TOTAL_H = CARD_H + OUTER_PAD * 2;
  const SCALE = 2; // 2x Retina / Alta Definição

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = TOTAL_H * SCALE;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível inicializar o canvas para exportação.");
  }

  ctx.scale(SCALE, SCALE);

  // Fundo externo suave
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, WIDTH, TOTAL_H);

  // Sombra discreta e Card Principal
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.06)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  drawRoundedRect(ctx, CARD_X, OUTER_PAD, CARD_W, CARD_H, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // Clip no formato do Card Principal para seções internas
  ctx.save();
  drawRoundedRect(ctx, CARD_X, OUTER_PAD, CARD_W, CARD_H, 16);
  ctx.clip();

  let cursorY = OUTER_PAD;

  // Banner de Cancelamento (se CANCELADO)
  if (pedido.status === "CANCELADO") {
    ctx.fillStyle = "#fef2f2";
    ctx.fillRect(CARD_X, cursorY, CARD_W, cancelBannerH);

    ctx.strokeStyle = "#fecaca";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CARD_X, cursorY + cancelBannerH);
    ctx.lineTo(CARD_X + CARD_W, cursorY + cancelBannerH);
    ctx.stroke();

    ctx.fillStyle = "#7f1d1d";
    ctx.font = `700 13px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillText("PEDIDO CANCELADO", CONTENT_X, cursorY + 24);

    ctx.fillStyle = "#b91c1c";
    ctx.font = `400 12px ${FONT_FAMILY}`;
    let cY = cursorY + 42;
    for (const line of cancelLines) {
      ctx.fillText(line, CONTENT_X, cY);
      cY += 16;
    }

    cursorY += cancelBannerH;
  }

  // Seção 1: Topo (Número, Status, Datas, Total Estimado e Peso)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(CARD_X, cursorY, CARD_W, headerSectionH);

  // Número do Pedido
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 24px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.fillText(pedido.numero, CONTENT_X, cursorY + 42);
  const numWidth = ctx.measureText(pedido.numero).width;

  // Badge de Status
  const statusText = pedido.status.toUpperCase();
  ctx.font = `700 11px ${FONT_FAMILY}`;
  const badgeW = ctx.measureText(statusText).width + 20;
  const badgeH = 24;
  const badgeX = CONTENT_X + numWidth + 14;
  const badgeY = cursorY + 23;

  const badgeColors =
    pedido.status === "CONFIRMADO"
      ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" }
      : pedido.status === "RASCUNHO"
      ? { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }
      : { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" };

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = badgeColors.bg;
  ctx.fill();
  ctx.strokeStyle = badgeColors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = badgeColors.text;
  ctx.fillText(statusText, badgeX + 10, badgeY + 16);

  // Datas
  ctx.fillStyle = "#64748b";
  ctx.font = `400 12px ${FONT_FAMILY}`;
  const dataCriacaoStr = `Criado em: ${new Date(
    pedido.dataCriacao
  ).toLocaleString("pt-BR")}`;
  const dataConfStr = pedido.dataConfirmacao
    ? `  •  Confirmado em: ${new Date(
        pedido.dataConfirmacao
      ).toLocaleString("pt-BR")}`
    : "";
  ctx.fillText(`${dataCriacaoStr}${dataConfStr}`, CONTENT_X, cursorY + 68);

  // Lado Direito do Topo: Total Estimado e Peso
  const rightEdge = CONTENT_X + CONTENT_W;
  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillText("Total Estimado", rightEdge, cursorY + 30);

  ctx.fillStyle = "#1d4ed8";
  ctx.font = `800 26px ${FONT_FAMILY}`;
  ctx.fillText(formatCurrency(pedido.totalEstimado), rightEdge, cursorY + 58);

  if (pedido.pesoInformadoKg) {
    ctx.fillStyle = "#475569";
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillText(
      `Peso Informado: ${formatQuantity(pedido.pesoInformadoKg, "kg")}`,
      rightEdge,
      cursorY + 78
    );
  }

  cursorY += headerSectionH;

  // Linha divisória após topo
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_X, cursorY);
  ctx.lineTo(CARD_X + CARD_W, cursorY);
  ctx.stroke();

  // Seção 2: Informações Comerciais (Frigorífico, Cliente, Vendedor)
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(CARD_X, cursorY, CARD_W, commercialSectionH);

  ctx.textAlign = "left";
  const col1X = CONTENT_X;
  const col2X = CONTENT_X + colW + colGap;
  const col3X = CONTENT_X + (colW + colGap) * 2;
  const commTopY = cursorY + 26;

  // Coluna 1: Frigorífico
  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.fillText("FRIGORÍFICO REPRESENTADO", col1X, commTopY);

  let c1Y = commTopY + 20;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 14px ${FONT_FAMILY}`;
  for (const line of frigNomeLines) {
    ctx.fillText(line, col1X, c1Y);
    c1Y += 18;
  }
  ctx.fillStyle = "#64748b";
  ctx.font = `400 12px ${FONT_FAMILY}`;
  if (pedido.frigorifico.cnpj) {
    ctx.fillText(`CNPJ: ${pedido.frigorifico.cnpj}`, col1X, c1Y);
    c1Y += 17;
  }
  if (pedido.frigorifico.telefone) {
    ctx.fillText(`Tel: ${pedido.frigorifico.telefone}`, col1X, c1Y);
    c1Y += 17;
  }

  // Coluna 2: Cliente Comprador
  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.fillText("CLIENTE COMPRADOR", col2X, commTopY);

  let c2Y = commTopY + 20;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 14px ${FONT_FAMILY}`;
  for (const line of clienteNomeLines) {
    ctx.fillText(line, col2X, c2Y);
    c2Y += 18;
  }
  ctx.fillStyle = "#475569";
  ctx.font = `400 12px ${FONT_FAMILY}`;
  for (const line of clienteRazaoLines) {
    ctx.fillText(line, col2X, c2Y);
    c2Y += 16;
  }
  ctx.fillStyle = "#64748b";
  if (pedido.cliente.cnpj) {
    ctx.fillText(`CNPJ: ${pedido.cliente.cnpj}`, col2X, c2Y);
    c2Y += 17;
  }
  if (pedido.cliente.telefone) {
    ctx.fillText(`Tel: ${pedido.cliente.telefone}`, col2X, c2Y);
    c2Y += 17;
  }
  for (const line of clienteEndLines) {
    ctx.fillText(line, col2X, c2Y);
    c2Y += 16;
  }

  // Coluna 3: Vendedor Responsável
  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.fillText("VENDEDOR RESPONSÁVEL", col3X, commTopY);

  let c3Y = commTopY + 20;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 14px ${FONT_FAMILY}`;
  for (const line of vendNomeLines) {
    ctx.fillText(line, col3X, c3Y);
    c3Y += 18;
  }
  ctx.fillStyle = "#64748b";
  ctx.font = `400 12px ${FONT_FAMILY}`;
  if (pedido.vendedor.telefone) {
    ctx.fillText(`Tel: ${pedido.vendedor.telefone}`, col3X, c3Y);
    c3Y += 17;
  }

  cursorY += commercialSectionH;

  // Linha divisória após seção comercial
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(CARD_X, cursorY);
  ctx.lineTo(CARD_X + CARD_W, cursorY);
  ctx.stroke();

  // Seção 3: Tabela de Itens
  cursorY += 24;

  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 16px ${FONT_FAMILY}`;
  ctx.fillText("Itens do Pedido", CONTENT_X, cursorY + 16);

  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.fillText(
    `${pedido.itens.length} ${pedido.itens.length === 1 ? "produto" : "produtos"}`,
    rightEdge,
    cursorY + 16
  );

  cursorY += 32;

  // Cabeçalho da Tabela
  const thH = 34;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(CONTENT_X, cursorY, CONTENT_W, thH);

  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, cursorY + thH);
  ctx.lineTo(CONTENT_X + CONTENT_W, cursorY + thH);
  ctx.stroke();

  // Posições X das colunas da tabela
  const colCodX = CONTENT_X + 10;
  const colProdX = CONTENT_X + 92;
  const colEmbX = CONTENT_X + 350;
  const colUnidX = CONTENT_X + 475;
  const colQtdRightX = CONTENT_X + 615;
  const colPrecoRightX = CONTENT_X + 708;
  const colSubRightX = CONTENT_X + CONTENT_W - 10;

  ctx.fillStyle = "#64748b";
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.fillText("CÓDIGO", colCodX, cursorY + 21);
  ctx.fillText("PRODUTO", colProdX, cursorY + 21);
  ctx.fillText("EMBALAGEM", colEmbX, cursorY + 21);
  ctx.fillText("UNID.", colUnidX, cursorY + 21);

  ctx.textAlign = "right";
  ctx.fillText("QUANTIDADE", colQtdRightX, cursorY + 21);
  ctx.fillText("PREÇO UNIT.", colPrecoRightX, cursorY + 21);
  ctx.fillText("SUBTOTAL", colSubRightX, cursorY + 21);

  cursorY += thH;

  // Linhas de Itens
  pedido.itens.forEach((it, idx) => {
    const { prodLines, rowH } = itemRowMeasurements[idx];

    if (idx % 2 === 1) {
      ctx.fillStyle = "#fcfcfd";
      ctx.fillRect(CONTENT_X, cursorY, CONTENT_W, rowH);
    }

    const textBaseY = cursorY + 22;

    // Código
    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 12px ${MONO_FAMILY}`;
    ctx.fillText(it.produtoCodigoSnapshot || "-", colCodX, textBaseY);

    // Produto (múltiplas linhas se necessário)
    ctx.fillStyle = "#1e293b";
    ctx.font = `600 12px ${FONT_FAMILY}`;
    prodLines.forEach((pLine, pIdx) => {
      ctx.fillText(pLine, colProdX, textBaseY + pIdx * 16);
    });

    // Embalagem
    if (it.produtoEmbalagemSnapshot) {
      ctx.fillStyle = "#475569";
      ctx.font = `500 11px ${FONT_FAMILY}`;
      ctx.fillText(it.produtoEmbalagemSnapshot, colEmbX, textBaseY);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = `400 11px ${FONT_FAMILY}`;
      ctx.fillText("-", colEmbX, textBaseY);
    }

    // Unidade
    ctx.fillStyle = "#334155";
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.fillText(it.produtoUnidadeSnapshot, colUnidX, textBaseY);

    // Quantidade
    ctx.textAlign = "right";
    ctx.fillStyle = "#334155";
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillText(
      formatQuantity(it.quantidade, it.produtoUnidadeSnapshot),
      colQtdRightX,
      textBaseY
    );

    // Preço Unitário
    ctx.fillStyle = "#475569";
    ctx.font = `500 12px ${FONT_FAMILY}`;
    ctx.fillText(formatCurrency(it.precoUnitario), colPrecoRightX, textBaseY);

    // Subtotal
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.fillText(formatCurrency(it.subtotal), colSubRightX, textBaseY);

    cursorY += rowH;

    // Linha separadora entre itens
    ctx.strokeStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(CONTENT_X, cursorY);
    ctx.lineTo(CONTENT_X + CONTENT_W, cursorY);
    ctx.stroke();
  });

  // Rodapé da Tabela com Soma Total
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(CONTENT_X, cursorY, CONTENT_W, tableFooterH);

  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, cursorY);
  ctx.lineTo(CONTENT_X + CONTENT_W, cursorY);
  ctx.moveTo(CONTENT_X, cursorY + tableFooterH);
  ctx.lineTo(CONTENT_X + CONTENT_W, cursorY + tableFooterH);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.fillStyle = "#475569";
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText("TOTAL ESTIMADO DO PEDIDO:", colPrecoRightX, cursorY + 28);

  ctx.fillStyle = "#1d4ed8";
  ctx.font = `800 14px ${FONT_FAMILY}`;
  ctx.fillText(formatCurrency(pedido.totalEstimado), colSubRightX, cursorY + 28);

  cursorY += tableFooterH;

  // Seção 4: Observações (se houver)
  if (obsLines.length > 0) {
    cursorY += 16;
    ctx.textAlign = "left";
    ctx.fillStyle = "#334155";
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.fillText("Observações:", CONTENT_X, cursorY + 16);

    ctx.fillStyle = "#475569";
    ctx.font = `400 12px ${FONT_FAMILY}`;
    let obsY = cursorY + 34;
    for (const line of obsLines) {
      ctx.fillText(line, CONTENT_X, obsY);
      obsY += 17;
    }
    cursorY = obsY + 6;
  }

  // Rodapé discreto do card
  const footerY = OUTER_PAD + CARD_H - 16;
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 11px ${FONT_FAMILY}`;
  ctx.fillText(
    `Resumo do Pedido • ${pedido.numero} • ${pedido.frigorifico.nomeFantasia}`,
    CONTENT_X,
    footerY
  );

  ctx.textAlign = "right";
  ctx.fillText(
    `Exportado em ${new Date().toLocaleString("pt-BR")}`,
    rightEdge,
    footerY
  );

  ctx.restore();

  // Borda externa do card
  drawRoundedRect(ctx, CARD_X, OUTER_PAD, CARD_W, CARD_H, 16);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Falha ao converter o print do pedido em imagem PNG."));
      }
    }, "image/png");
  });
}


export function gerarNomeArquivoPdf(numeroPedido: string): string {
  const limpo = (numeroPedido || "pedido")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  return `pedido-${limpo}.pdf`;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gera o documento HTML completo otimizado para impressão em papel A4 (retrato),
 * com fundo 100% branco, bordas definidas de alto contraste e economia de tinta.
 */
export function gerarHtmlImpressaoA4(pedido: PedidoShareData): string {
  const nomeCliente =
    pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome;
  const mostrarRazaoCliente =
    pedido.cliente.nomeFantasia &&
    pedido.cliente.razaoSocialOuNome &&
    pedido.cliente.nomeFantasia !== pedido.cliente.razaoSocialOuNome;
  const enderecoCompleto = formatarEnderecoCliente(pedido.cliente);

  const dataCriacaoStr = new Date(pedido.dataCriacao).toLocaleString("pt-BR");
  const dataConfirmacaoStr = pedido.dataConfirmacao
    ? new Date(pedido.dataConfirmacao).toLocaleString("pt-BR")
    : null;
  const dataEmissaoPdf = new Date().toLocaleString("pt-BR");

  const linhasItensHtml = pedido.itens
    .map(
      (it, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="mono bold">${escapeHtml(it.produtoCodigoSnapshot || "-")}</td>
        <td class="bold">${escapeHtml(it.produtoNomeSnapshot)}</td>
        <td>${escapeHtml(it.produtoEmbalagemSnapshot || "-")}</td>
        <td class="center">${escapeHtml(it.produtoUnidadeSnapshot)}</td>
        <td class="right bold">${escapeHtml(
          formatQuantity(it.quantidade, it.produtoUnidadeSnapshot)
        )}</td>
        <td class="right">${escapeHtml(formatCurrency(it.precoUnitario))}</td>
        <td class="right bold">${escapeHtml(formatCurrency(it.subtotal))}</td>
      </tr>`
    )
    .join("");

  const bannerCanceladoHtml =
    pedido.status === "CANCELADO"
      ? `<div class="cancel-box">
          <strong>PEDIDO CANCELADO</strong>
          ${
            pedido.justificativaCancelamento
              ? `<div>Justificativa: "${escapeHtml(
                  pedido.justificativaCancelamento
                )}"</div>`
              : ""
          }
        </div>`
      : "";

  const observacoesHtml =
    pedido.observacoes && pedido.observacoes.trim()
      ? `<div class="obs-box">
          <div class="section-label">OBSERVAÇÕES DO PEDIDO</div>
          <div class="obs-text">${escapeHtml(pedido.observacoes.trim())}</div>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pedido ${escapeHtml(pedido.numero)}</title>
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
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
    }
    .page {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
    }
    .header-box {
      border: 1.5px solid #000000;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .doc-title {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #333333;
    }
    .order-number {
      font-size: 20px;
      font-weight: 800;
      margin: 2px 0;
    }
    .status-badge {
      display: inline-block;
      border: 1px solid #000000;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      margin-left: 8px;
      vertical-align: middle;
    }
    .dates {
      font-size: 10px;
      color: #222222;
    }
    .header-totals {
      text-align: right;
    }
    .total-label {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .total-value {
      font-size: 18px;
      font-weight: 800;
    }
    .weight-value {
      font-size: 10.5px;
      font-weight: bold;
      margin-top: 2px;
    }
    .cancel-box {
      border: 1.5px solid #000000;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .parties-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .parties-grid td {
      border: 1px solid #000000;
      padding: 8px 10px;
      vertical-align: top;
      width: 33.33%;
    }
    .section-label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333333;
      margin-bottom: 4px;
      border-bottom: 1px solid #cccccc;
      padding-bottom: 2px;
    }
    .party-name {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .party-detail {
      font-size: 10.5px;
      color: #111111;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th,
    .items-table td {
      border: 1px solid #000000;
      padding: 5px 7px;
      font-size: 10.5px;
    }
    .items-table th {
      background: #f0f0f0;
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: left;
    }
    .items-table tfoot td {
      background: #f5f5f5;
      font-weight: bold;
      font-size: 11.5px;
      padding: 7px;
    }
    .center { text-align: center !important; }
    .right { text-align: right !important; }
    .bold { font-weight: bold; }
    .mono { font-family: "Courier New", Courier, monospace; }
    .obs-box {
      border: 1px solid #000000;
      padding: 8px 10px;
      margin-bottom: 14px;
    }
    .obs-text {
      white-space: pre-wrap;
      font-size: 10.5px;
    }
    .signatures {
      margin-top: 26px;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      page-break-inside: avoid;
    }
    .sig-block {
      flex: 1;
      border-top: 1px solid #000000;
      padding-top: 4px;
      text-align: center;
      font-size: 10px;
    }
    .footer-meta {
      margin-top: 16px;
      border-top: 1px dashed #666666;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #333333;
    }
  </style>
</head>
<body>
  <div class="page">
    ${bannerCanceladoHtml}

    <div class="header-box">
      <div>
        <div class="doc-title">Pedido Comercial de Representação</div>
        <div>
          <span class="order-number">${escapeHtml(pedido.numero)}</span>
          <span class="status-badge">${escapeHtml(pedido.status)}</span>
        </div>
        <div class="dates">
          Criado em: ${escapeHtml(dataCriacaoStr)}
          ${
            dataConfirmacaoStr
              ? ` &bull; Confirmado em: ${escapeHtml(dataConfirmacaoStr)}`
              : ""
          }
        </div>
      </div>

      <div class="header-totals">
        <div class="total-label">Total Estimado do Pedido</div>
        <div class="total-value">${escapeHtml(
          formatCurrency(pedido.totalEstimado)
        )}</div>
        ${
          pedido.pesoInformadoKg
            ? `<div class="weight-value">Peso Informado: ${escapeHtml(
                formatQuantity(pedido.pesoInformadoKg, "kg")
              )}</div>`
            : ""
        }
      </div>
    </div>

    <table class="parties-grid">
      <tr>
        <td>
          <div class="section-label">Frigorífico Representado</div>
          <div class="party-name">${escapeHtml(
            pedido.frigorifico.nomeFantasia
          )}</div>
          ${
            pedido.frigorifico.cnpj
              ? `<div class="party-detail">CNPJ: ${escapeHtml(
                  pedido.frigorifico.cnpj
                )}</div>`
              : ""
          }
          ${
            pedido.frigorifico.telefone
              ? `<div class="party-detail">Tel: ${escapeHtml(
                  pedido.frigorifico.telefone
                )}</div>`
              : ""
          }
        </td>
        <td>
          <div class="section-label">Cliente Comprador</div>
          <div class="party-name">${escapeHtml(nomeCliente)}</div>
          ${
            mostrarRazaoCliente
              ? `<div class="party-detail">${escapeHtml(
                  pedido.cliente.razaoSocialOuNome
                )}</div>`
              : ""
          }
          ${
            pedido.cliente.cnpj
              ? `<div class="party-detail">CNPJ: ${escapeHtml(
                  pedido.cliente.cnpj
                )}</div>`
              : ""
          }
          ${
            pedido.cliente.telefone
              ? `<div class="party-detail">Tel: ${escapeHtml(
                  pedido.cliente.telefone
                )}</div>`
              : ""
          }
          ${
            enderecoCompleto
              ? `<div class="party-detail"><strong>End.:</strong> ${escapeHtml(
                  enderecoCompleto
                )}</div>`
              : ""
          }
        </td>
        <td>
          <div class="section-label">Vendedor Responsável</div>
          <div class="party-name">${escapeHtml(pedido.vendedor.nome)}</div>
          ${
            pedido.vendedor.telefone
              ? `<div class="party-detail">Tel: ${escapeHtml(
                  pedido.vendedor.telefone
                )}</div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width: 34px;">#</th>
          <th style="width: 72px;">Código</th>
          <th>Descrição do Produto</th>
          <th style="width: 105px;">Embalagem</th>
          <th class="center" style="width: 48px;">Unid.</th>
          <th class="right" style="width: 85px;">Quantidade</th>
          <th class="right" style="width: 92px;">Preço Unit.</th>
          <th class="right" style="width: 100px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5">
            Total de Itens: ${pedido.itens.length}
            ${
              pedido.pesoInformadoKg
                ? ` &nbsp;|&nbsp; Peso Informado (kg): ${escapeHtml(
                    formatQuantity(pedido.pesoInformadoKg, "kg")
                  )}`
                : ""
            }
          </td>
          <td colspan="2" class="right">TOTAL ESTIMADO:</td>
          <td class="right">${escapeHtml(
            formatCurrency(pedido.totalEstimado)
          )}</td>
        </tr>
      </tfoot>
    </table>

    ${observacoesHtml}

    <div class="signatures">
      <div class="sig-block">
        Vendedor / Representação (${escapeHtml(pedido.vendedor.nome)})
      </div>
      <div class="sig-block">
        Conferência / Cliente (${escapeHtml(nomeCliente)})
      </div>
    </div>

    <div class="footer-meta">
      <span>Pedido ${escapeHtml(pedido.numero)} &bull; ${escapeHtml(
        pedido.frigorifico.nomeFantasia
      )}</span>
      <span>Impresso em ${escapeHtml(dataEmissaoPdf)}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Abre a caixa de diálogo de impressão nativa do navegador com o layout A4 pronto para papel.
 */
export function imprimirPedidoEmPapel(pedido: PedidoShareData): void {
  const html = gerarHtmlImpressaoA4(pedido);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível inicializar a janela de impressão.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}

/**
 * Desenha a folha A4 imprimível (fundo branco, bordas pretas, alto contraste)
 * em um ou mais canvases de proporção A4 (794 x 1123 px lógicos em 2x DPI).
 */
export async function renderizarPaginasA4Canvas(
  pedido: PedidoShareData
): Promise<HTMLCanvasElement[]> {
  const FONT_SANS = "Arial, Helvetica, sans-serif";
  const FONT_MONO = "'Courier New', Courier, monospace";

  const PAGE_W = 794; // Largura A4 em 96 DPI
  const PAGE_H = 1123; // Altura A4 em 96 DPI
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2; // 714px
  const SCALE = 2; // 2x DPI para nitidez de impressão

  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Contexto Canvas 2D indisponível.");
  }

  // Desenha todo o conteúdo em um canvas mestre de largura A4 e altura dinâmica,
  // e depois fatia em páginas A4 exatas caso ultrapasse 1 página.
  const colW = CONTENT_W / 3;
  mCtx.font = `700 12px ${FONT_SANS}`;
  const frigLines = wrapTextLines(
    mCtx,
    pedido.frigorifico.nomeFantasia,
    colW - 16
  );
  const nomeCliente =
    pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome;
  const cliNomeLines = wrapTextLines(mCtx, nomeCliente, colW - 16);
  const vendLines = wrapTextLines(mCtx, pedido.vendedor.nome, colW - 16);

  mCtx.font = `400 10.5px ${FONT_SANS}`;
  const cliRazaoLines =
    pedido.cliente.nomeFantasia &&
    pedido.cliente.razaoSocialOuNome &&
    pedido.cliente.nomeFantasia !== pedido.cliente.razaoSocialOuNome
      ? wrapTextLines(mCtx, pedido.cliente.razaoSocialOuNome, colW - 16)
      : [];
  const endStr = formatarEnderecoCliente(pedido.cliente);
  const cliEndLines = endStr
    ? wrapTextLines(mCtx, `End.: ${endStr}`, colW - 16)
    : [];

  const p1H =
    26 +
    frigLines.length * 15 +
    (pedido.frigorifico.cnpj ? 15 : 0) +
    (pedido.frigorifico.telefone ? 15 : 0);
  const p2H =
    26 +
    cliNomeLines.length * 15 +
    cliRazaoLines.length * 14 +
    (pedido.cliente.cnpj ? 15 : 0) +
    (pedido.cliente.telefone ? 15 : 0) +
    cliEndLines.length * 14;
  const p3H =
    26 +
    vendLines.length * 15 +
    (pedido.vendedor.telefone ? 15 : 0);

  const partiesBoxH = Math.max(p1H, p2H, p3H) + 14;

  // Medição das linhas da tabela de itens
  // Colunas: # (30) | Código (68) | Produto (236) | Embalagem (98) | Unid (44) | Qtd (76) | Preço (80) | Subtotal (82) = 714
  const PROD_COL_W = 224;
  mCtx.font = `700 10.5px ${FONT_SANS}`;
  const itemRows = pedido.itens.map((it) => {
    const lines = wrapTextLines(
      mCtx,
      it.produtoNomeSnapshot || "-",
      PROD_COL_W
    );
    const h = Math.max(26, lines.length * 14 + 10);
    return { lines, h };
  });
  const totalItemsH = itemRows.reduce((a, b) => a + b.h, 0);

  mCtx.font = `400 10.5px ${FONT_SANS}`;
  const obsLines =
    pedido.observacoes && pedido.observacoes.trim()
      ? wrapTextLines(mCtx, pedido.observacoes.trim(), CONTENT_W - 20)
      : [];
  const obsBoxH = obsLines.length > 0 ? 30 + obsLines.length * 15 + 10 : 0;

  const totalLogicalH =
    MARGIN * 2 +
    86 + // Header
    12 +
    partiesBoxH +
    14 +
    28 + // Table header
    totalItemsH +
    32 + // Table footer
    (obsBoxH > 0 ? 14 + obsBoxH : 0) +
    90; // Assinaturas e rodapé

  const usablePageH = PAGE_H - MARGIN * 2;
  const numPages = Math.max(
    1,
    Math.ceil((totalLogicalH - MARGIN * 2) / usablePageH)
  );
  const masterH = Math.max(PAGE_H, MARGIN * 2 + numPages * usablePageH);

  const masterCanvas = document.createElement("canvas");
  masterCanvas.width = PAGE_W * SCALE;
  masterCanvas.height = masterH * SCALE;
  const ctx = masterCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Falha ao criar contexto 2D para PDF.");
  }

  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, masterH);

  let y = MARGIN;
  const x0 = MARGIN;
  const xRight = MARGIN + CONTENT_W;

  // 1. Cabeçalho Formal com Borda Preta
  const headerH = 82;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y, CONTENT_W, headerH);

  ctx.fillStyle = "#333333";
  ctx.font = `700 10px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("PEDIDO COMERCIAL DE REPRESENTAÇÃO", x0 + 12, y + 20);

  ctx.fillStyle = "#000000";
  ctx.font = `800 20px ${FONT_SANS}`;
  ctx.fillText(pedido.numero, x0 + 12, y + 46);
  const numW = ctx.measureText(pedido.numero).width;

  // Badge Status P&B Imprimível
  ctx.font = `700 10px ${FONT_SANS}`;
  const stText = pedido.status.toUpperCase();
  const stW = ctx.measureText(stText).width + 14;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 12 + numW + 10, y + 31, stW, 19);
  ctx.fillText(stText, x0 + 12 + numW + 17, y + 44);

  ctx.fillStyle = "#222222";
  ctx.font = `400 10px ${FONT_SANS}`;
  const dtCriacao = `Criado em: ${new Date(pedido.dataCriacao).toLocaleString(
    "pt-BR"
  )}`;
  const dtConf = pedido.dataConfirmacao
    ? `  •  Confirmado em: ${new Date(pedido.dataConfirmacao).toLocaleString(
        "pt-BR"
      )}`
    : "";
  ctx.fillText(`${dtCriacao}${dtConf}`, x0 + 12, y + 68);

  // Total no Cabeçalho Direito
  ctx.textAlign = "right";
  ctx.fillStyle = "#222222";
  ctx.font = `700 10px ${FONT_SANS}`;
  ctx.fillText("TOTAL ESTIMADO DO PEDIDO", xRight - 12, y + 22);

  ctx.fillStyle = "#000000";
  ctx.font = `800 19px ${FONT_SANS}`;
  ctx.fillText(formatCurrency(pedido.totalEstimado), xRight - 12, y + 46);

  if (pedido.pesoInformadoKg) {
    ctx.font = `700 10.5px ${FONT_SANS}`;
    ctx.fillText(
      `Peso Informado: ${formatQuantity(pedido.pesoInformadoKg, "kg")}`,
      xRight - 12,
      y + 66
    );
  }

  y += headerH + 12;

  // 2. Quadro de Partes Envolvidas (3 Colunas Gradeadas)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y, CONTENT_W, partiesBoxH);
  ctx.beginPath();
  ctx.moveTo(x0 + colW, y);
  ctx.lineTo(x0 + colW, y + partiesBoxH);
  ctx.moveTo(x0 + colW * 2, y);
  ctx.lineTo(x0 + colW * 2, y + partiesBoxH);
  ctx.stroke();

  const drawPartyHeader = (label: string, colX: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#333333";
    ctx.font = `700 9px ${FONT_SANS}`;
    ctx.fillText(label, colX + 8, y + 15);
    ctx.strokeStyle = "#cccccc";
    ctx.beginPath();
    ctx.moveTo(colX + 8, y + 19);
    ctx.lineTo(colX + colW - 8, y + 19);
    ctx.stroke();
  };

  // Coluna 1: Frigorífico
  drawPartyHeader("FRIGORÍFICO REPRESENTADO", x0);
  let py1 = y + 34;
  ctx.fillStyle = "#000000";
  ctx.font = `700 12px ${FONT_SANS}`;
  for (const l of frigLines) {
    ctx.fillText(l, x0 + 8, py1);
    py1 += 15;
  }
  ctx.font = `400 10.5px ${FONT_SANS}`;
  if (pedido.frigorifico.cnpj) {
    ctx.fillText(`CNPJ: ${pedido.frigorifico.cnpj}`, x0 + 8, py1);
    py1 += 15;
  }
  if (pedido.frigorifico.telefone) {
    ctx.fillText(`Tel: ${pedido.frigorifico.telefone}`, x0 + 8, py1);
    py1 += 15;
  }

  // Coluna 2: Cliente
  const col2X = x0 + colW;
  drawPartyHeader("CLIENTE COMPRADOR", col2X);
  let py2 = y + 34;
  ctx.fillStyle = "#000000";
  ctx.font = `700 12px ${FONT_SANS}`;
  for (const l of cliNomeLines) {
    ctx.fillText(l, col2X + 8, py2);
    py2 += 15;
  }
  ctx.font = `400 10.5px ${FONT_SANS}`;
  for (const l of cliRazaoLines) {
    ctx.fillText(l, col2X + 8, py2);
    py2 += 14;
  }
  if (pedido.cliente.cnpj) {
    ctx.fillText(`CNPJ: ${pedido.cliente.cnpj}`, col2X + 8, py2);
    py2 += 15;
  }
  if (pedido.cliente.telefone) {
    ctx.fillText(`Tel: ${pedido.cliente.telefone}`, col2X + 8, py2);
    py2 += 15;
  }
  for (const l of cliEndLines) {
    ctx.fillText(l, col2X + 8, py2);
    py2 += 14;
  }

  // Coluna 3: Vendedor
  const col3X = x0 + colW * 2;
  drawPartyHeader("VENDEDOR RESPONSÁVEL", col3X);
  let py3 = y + 34;
  ctx.fillStyle = "#000000";
  ctx.font = `700 12px ${FONT_SANS}`;
  for (const l of vendLines) {
    ctx.fillText(l, col3X + 8, py3);
    py3 += 15;
  }
  ctx.font = `400 10.5px ${FONT_SANS}`;
  if (pedido.vendedor.telefone) {
    ctx.fillText(`Tel: ${pedido.vendedor.telefone}`, col3X + 8, py3);
    py3 += 15;
  }

  y += partiesBoxH + 14;

  // 3. Tabela Gradeada de Itens
  const colWidths = [30, 68, 236, 98, 44, 76, 80, 82]; // Soma = 714 (CONTENT_W)
  const colStarts: number[] = [];
  let accX = x0;
  for (const w of colWidths) {
    colStarts.push(accX);
    accX += w;
  }

  const thH = 26;
  ctx.fillStyle = "#efefef";
  ctx.fillRect(x0, y, CONTENT_W, thH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y, CONTENT_W, thH);

  const headers = [
    { text: "#", align: "center" as const },
    { text: "CÓDIGO", align: "left" as const },
    { text: "DESCRIÇÃO DO PRODUTO", align: "left" as const },
    { text: "EMBALAGEM", align: "left" as const },
    { text: "UNID.", align: "center" as const },
    { text: "QUANTIDADE", align: "right" as const },
    { text: "PREÇO UNIT.", align: "right" as const },
    { text: "SUBTOTAL", align: "right" as const },
  ];

  ctx.fillStyle = "#000000";
  ctx.font = `700 9.5px ${FONT_SANS}`;
  headers.forEach((h, i) => {
    const cx = colStarts[i];
    const cw = colWidths[i];
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + thH);
      ctx.stroke();
    }
    if (h.align === "center") {
      ctx.textAlign = "center";
      ctx.fillText(h.text, cx + cw / 2, y + 17);
    } else if (h.align === "right") {
      ctx.textAlign = "right";
      ctx.fillText(h.text, cx + cw - 6, y + 17);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(h.text, cx + 6, y + 17);
    }
  });

  y += thH;

  // Linhas de Itens
  pedido.itens.forEach((it, idx) => {
    const { lines, h } = itemRows[idx];
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y, CONTENT_W, h);

    for (let c = 1; c < colStarts.length; c++) {
      ctx.beginPath();
      ctx.moveTo(colStarts[c], y);
      ctx.lineTo(colStarts[c], y + h);
      ctx.stroke();
    }

    const ty = y + 17;
    ctx.fillStyle = "#000000";

    // #
    ctx.font = `400 10px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(String(idx + 1), colStarts[0] + colWidths[0] / 2, ty);

    // Código
    ctx.font = `700 10.5px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(it.produtoCodigoSnapshot || "-", colStarts[1] + 6, ty);

    // Produto
    ctx.font = `700 10.5px ${FONT_SANS}`;
    lines.forEach((line, lIdx) => {
      ctx.fillText(line, colStarts[2] + 6, ty + lIdx * 14);
    });

    // Embalagem
    ctx.font = `400 10px ${FONT_SANS}`;
    ctx.fillText(it.produtoEmbalagemSnapshot || "-", colStarts[3] + 6, ty);

    // Unidade
    ctx.textAlign = "center";
    ctx.fillText(
      it.produtoUnidadeSnapshot,
      colStarts[4] + colWidths[4] / 2,
      ty
    );

    // Quantidade
    ctx.textAlign = "right";
    ctx.font = `700 10.5px ${FONT_SANS}`;
    ctx.fillText(
      formatQuantity(it.quantidade, it.produtoUnidadeSnapshot),
      colStarts[5] + colWidths[5] - 6,
      ty
    );

    // Preço Unit.
    ctx.font = `400 10.5px ${FONT_SANS}`;
    ctx.fillText(
      formatCurrency(it.precoUnitario),
      colStarts[6] + colWidths[6] - 6,
      ty
    );

    // Subtotal
    ctx.font = `700 10.5px ${FONT_SANS}`;
    ctx.fillText(
      formatCurrency(it.subtotal),
      colStarts[7] + colWidths[7] - 6,
      ty
    );

    y += h;
  });

  // Rodapé da Tabela
  const tfH = 30;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(x0, y, CONTENT_W, tfH);
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(x0, y, CONTENT_W, tfH);

  ctx.fillStyle = "#000000";
  ctx.font = `700 10.5px ${FONT_SANS}`;
  ctx.textAlign = "left";
  const pesoResumo = pedido.pesoInformadoKg
    ? `   |   Peso Informado: ${formatQuantity(pedido.pesoInformadoKg, "kg")}`
    : "";
  ctx.fillText(
    `Total de Itens: ${pedido.itens.length}${pesoResumo}`,
    x0 + 8,
    y + 19
  );

  ctx.textAlign = "right";
  ctx.font = `800 12px ${FONT_SANS}`;
  ctx.fillText(
    `TOTAL ESTIMADO: ${formatCurrency(pedido.totalEstimado)}`,
    xRight - 8,
    y + 19
  );

  y += tfH;

  // 4. Observações (se houver)
  if (obsLines.length > 0) {
    y += 14;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(x0, y, CONTENT_W, obsBoxH);
    ctx.textAlign = "left";
    ctx.fillStyle = "#333333";
    ctx.font = `700 9.5px ${FONT_SANS}`;
    ctx.fillText("OBSERVAÇÕES DO PEDIDO:", x0 + 8, y + 16);

    ctx.fillStyle = "#000000";
    ctx.font = `400 10.5px ${FONT_SANS}`;
    let oy = y + 32;
    for (const l of obsLines) {
      ctx.fillText(l, x0 + 8, oy);
      oy += 15;
    }
    y += obsBoxH;
  }

  // 5. Linhas de Assinatura / Conferência no Papel
  y += 42;
  const sigW = (CONTENT_W - 48) / 2;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + sigW, y);
  ctx.moveTo(x0 + sigW + 48, y);
  ctx.lineTo(xRight, y);
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = `400 10px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(
    `Vendedor / Representação (${pedido.vendedor.nome})`,
    x0 + sigW / 2,
    y + 15
  );
  ctx.fillText(
    `Conferência / Cliente (${nomeCliente})`,
    x0 + sigW + 48 + sigW / 2,
    y + 15
  );

  // Rodapé de Data/Hora
  y += 32;
  ctx.fillStyle = "#444444";
  ctx.font = `400 9.5px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `Documento Imprimível A4 • Pedido ${pedido.numero} • ${pedido.frigorifico.nomeFantasia}`,
    x0,
    y
  );
  ctx.textAlign = "right";
  ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, xRight, y);

  // Fatia em páginas A4 individuais
  const pages: HTMLCanvasElement[] = [];
  for (let p = 0; p < numPages; p++) {
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_W * SCALE;
    pageCanvas.height = PAGE_H * SCALE;
    const pCtx = pageCanvas.getContext("2d");
    if (!pCtx) continue;

    pCtx.fillStyle = "#ffffff";
    pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    const srcY = p * usablePageH * SCALE;
    const sliceH = Math.min(
      (usablePageH + MARGIN * 2) * SCALE,
      masterCanvas.height - srcY
    );

    pCtx.drawImage(
      masterCanvas,
      0,
      srcY,
      PAGE_W * SCALE,
      sliceH,
      0,
      0,
      PAGE_W * SCALE,
      sliceH
    );

    pages.push(pageCanvas);
  }

  return pages;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Empacota uma ou mais páginas A4 em um arquivo binário PDF 1.4 válido (application/pdf)
 * pronto para download ou envio direto como documento.
 */
export async function gerarArquivoPdfPedido(
  pedido: PedidoShareData
): Promise<Blob> {
  const pageCanvases = await renderizarPaginasA4Canvas(pedido);
  const A4_PT_W = 595.28;
  const A4_PT_H = 841.89;

  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets: number[] = [0]; // Índice 0 reservado para o objeto livre 0
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr as unknown as BlobPart);
    byteLength += arr.byteLength;
  };

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr as unknown as BlobPart);
    byteLength += arr.byteLength;
  };

  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  // Objetos:
  // 1: Catalog
  // 2: Pages
  // Para cada página i (0..N-1):
  //   pageObjId = 3 + i * 3
  //   contentObjId = 4 + i * 3
  //   imageObjId = 5 + i * 3
  const numPages = pageCanvases.length;
  const pageObjIds: number[] = [];

  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(3 + i * 3);
  }

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${numPages} >>`
  );
  endObj();

  for (let i = 0; i < numPages; i++) {
    const canvas = pageCanvases[i];
    const jpegBytes = dataUrlToUint8Array(
      canvas.toDataURL("image/jpeg", 0.95)
    );

    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    // Page object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] /Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content stream que posiciona a imagem cobrindo a folha A4
    const streamCmd = `q\n${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm\n${imgName} Do\nQ`;
    const streamBytes = encoder.encode(streamCmd);
    startObj(contentObjId);
    pushStr(`<< /Length ${streamBytes.byteLength} >>\nstream\n`);
    pushBytes(streamBytes);
    pushStr(`\nendstream`);
    endObj();

    // Image XObject (DCTDecode / JPEG)
    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  }

  const totalObjs = 2 + numPages * 3;
  const xrefOffset = byteLength;

  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    const offStr = String(offsets[id] || 0).padStart(10, "0");
    pushStr(`${offStr} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob(chunks, { type: "application/pdf" });
}


export interface PacotePedidosData {
  frigorificoNome: string;
  dataGeracao: string;
  pedidos: PedidoShareData[];
  totalGeralValor: number;
  totalGeralPesoKg: number;
}

export function compilarDadosPacote(pedidos: PedidoShareData[]): PacotePedidosData {
  if (!pedidos || pedidos.length === 0) {
    throw new Error("Selecione pelo menos 1 pedido para gerar o resumo do pacote.");
  }

  const naoConfirmados = pedidos.filter((p) => p.status !== "CONFIRMADO");
  if (naoConfirmados.length > 0) {
    throw new Error(
      "Apenas pedidos CONFIRMADOS podem entrar no pacote. Pedidos em rascunho ou cancelados não são permitidos."
    );
  }

  const frigorificoKeys = Array.from(
    new Set(
      pedidos.map(
        (p) =>
          (p.frigorifico as { id?: string; nomeFantasia?: string })?.id ||
          p.frigorifico?.nomeFantasia ||
          "Frigorífico"
      )
    )
  );

  if (frigorificoKeys.length > 1) {
    throw new Error(
      "Não é permitido gerar um resumo com pedidos de frigoríficos diferentes. Selecione pedidos de apenas 1 frigorífico."
    );
  }

  const frigorificoNome = pedidos[0].frigorifico?.nomeFantasia || "Frigorífico";

  let totalValor = 0;
  let totalPeso = 0;

  for (const p of pedidos) {
    totalValor += Number(p.totalEstimado || 0);
    if (p.pesoInformadoKg) {
      totalPeso += Number(p.pesoInformadoKg);
    }
  }

  return {
    frigorificoNome,
    dataGeracao: new Date().toISOString(),
    pedidos,
    totalGeralValor: Math.round(totalValor * 100) / 100,
    totalGeralPesoKg: Math.round(totalPeso * 1000) / 1000,
  };
}

export function gerarNomeArquivoPacote(prefixo: string, ext: "png" | "pdf" | "txt"): string {
  const dataStr = new Date().toISOString().slice(0, 10);
  const limpo = (prefixo || "pacote-pedidos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `pacote-${limpo}-${dataStr}.${ext}`;
}

export function gerarTextoWhatsAppPacote(pacote: PacotePedidosData): string {
  const linhas: string[] = [];

  linhas.push(`*📦 PACOTE DE PEDIDOS - ${pacote.frigorificoNome.toUpperCase()}*`);
  linhas.push(`Data: ${new Date(pacote.dataGeracao).toLocaleDateString("pt-BR")}`);
  linhas.push(`Total de Pedidos: *${pacote.pedidos.length}*`);
  linhas.push("===============================");
  linhas.push("");

  pacote.pedidos.forEach((p, index) => {
    const nomeCliente = p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome;
    linhas.push(`*PEDIDO ${index + 1}: ${p.numero}* [${p.status}]`);
    linhas.push(`*Cliente:* ${nomeCliente}`);
    if (p.cliente.cnpj) {
      linhas.push(`*CNPJ:* ${p.cliente.cnpj}`);
    }
    if (p.cliente.cidade) {
      linhas.push(`*Cidade:* ${p.cliente.cidade}`);
    }
    if (p.vendedor?.nome) {
      linhas.push(`*Vendedor:* ${p.vendedor.nome}`);
    }

    linhas.push(`*Itens (${p.itens.length}):*`);
    for (const item of p.itens) {
      const emb = item.produtoEmbalagemSnapshot
        ? ` [${item.produtoEmbalagemSnapshot}]`
        : "";
      const qtd = formatQuantity(item.quantidade, item.produtoUnidadeSnapshot);
      const preco = formatCurrency(item.precoUnitario);
      const sub = formatCurrency(item.subtotal);
      linhas.push(
        `  • (${item.produtoCodigoSnapshot}) ${item.produtoNomeSnapshot}${emb}: ${qtd} x ${preco} = *${sub}*`
      );
    }

    const subtotalPed = formatCurrency(p.totalEstimado);
    const pesoPed = p.pesoInformadoKg
      ? `*Peso do Pedido: ${formatQuantity(p.pesoInformadoKg, "kg")}* | `
      : "";
    linhas.push(`${pesoPed}Subtotal: ${subtotalPed}`);

    if (p.observacoes && p.observacoes.trim()) {
      linhas.push(`Obs: ${p.observacoes.trim()}`);
    }

    linhas.push("-------------------------------");
  });

  linhas.push("");
  linhas.push(`*📊 TOTAIS CONSOLIDADOS DO PACOTE:*`);
  linhas.push(`• Total de Pedidos: *${pacote.pedidos.length}*`);
  if (pacote.totalGeralPesoKg > 0) {
    linhas.push(
      `• *PESO TOTAL DO PACOTE: ${formatQuantity(pacote.totalGeralPesoKg, "kg")}*`
    );
  }
  linhas.push(`• Valor Total do Pacote: ${formatCurrency(pacote.totalGeralValor)}`);
  linhas.push("===============================");

  return linhas.join("\n");
}

export function gerarHtmlImpressaoA4Pacote(pacote: PacotePedidosData): string {
  const dataGeracaoStr = new Date(pacote.dataGeracao).toLocaleString("pt-BR");

  const blocosPedidosHtml = pacote.pedidos
    .map((p, idx) => {
      const nomeCliente = p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome;
      const razaoComplemento =
        p.cliente.nomeFantasia &&
        p.cliente.razaoSocialOuNome &&
        p.cliente.nomeFantasia !== p.cliente.razaoSocialOuNome
          ? ` (${p.cliente.razaoSocialOuNome})`
          : "";
      const linhasItens = p.itens
        .map(
          (it, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="mono bold">${escapeHtml(it.produtoCodigoSnapshot || "-")}</td>
          <td class="bold">${escapeHtml(it.produtoNomeSnapshot)}</td>
          <td>${escapeHtml(it.produtoEmbalagemSnapshot || "-")}</td>
          <td class="center">${escapeHtml(it.produtoUnidadeSnapshot)}</td>
          <td class="right bold">${escapeHtml(
            formatQuantity(it.quantidade, it.produtoUnidadeSnapshot)
          )}</td>
          <td class="right">${escapeHtml(formatCurrency(it.precoUnitario))}</td>
          <td class="right bold">${escapeHtml(formatCurrency(it.subtotal))}</td>
        </tr>`
        )
        .join("");

      return `
      <div class="order-block">
        <div class="order-header">
          <div>
            <span class="order-idx">#${idx + 1}</span>
            <span class="order-num">${escapeHtml(p.numero)}</span>
            <span class="order-status">[${escapeHtml(p.status)}]</span>
          </div>
          <div class="order-subtotal">
            ${
              p.pesoInformadoKg
                ? `<span class="order-weight-highlight">Peso: ${escapeHtml(
                    formatQuantity(p.pesoInformadoKg, "kg")
                  )}</span>`
                : ""
            }
            <span class="order-val-sub">Valor: ${escapeHtml(
              formatCurrency(p.totalEstimado)
            )}</span>
          </div>
        </div>

        <div class="client-info-box">
          <div class="client-name-row">
            <span class="info-label">Cliente:</span>
            <strong>${escapeHtml(nomeCliente)}${escapeHtml(razaoComplemento)}</strong>
          </div>
          <div class="client-meta-row">
            <div><span class="info-label">CNPJ:</span> ${escapeHtml(p.cliente.cnpj || "-")}</div>
            <div><span class="info-label">Cidade:</span> ${escapeHtml(p.cliente.cidade || "-")}</div>
            <div><span class="info-label">Vendedor:</span> ${escapeHtml(p.vendedor?.nome || "-")}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="center" style="width: 28px;">#</th>
              <th style="width: 60px;">Código</th>
              <th>Produto</th>
              <th style="width: 95px;">Embalagem</th>
              <th class="center" style="width: 44px;">Unid.</th>
              <th class="right" style="width: 80px;">Qtd.</th>
              <th class="right" style="width: 85px;">Preço Unit.</th>
              <th class="right" style="width: 90px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${linhasItens}
          </tbody>
        </table>
        ${
          p.observacoes && p.observacoes.trim()
            ? `<div class="order-obs"><strong>Obs:</strong> ${escapeHtml(
                p.observacoes.trim()
              )}</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pacote de Pedidos - ${escapeHtml(pacote.frigorificoNome)}</title>
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
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .page {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
    }
    .main-header {
      border: 1.5px solid #000000;
      padding: 10px 14px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .main-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .main-subtitle {
      font-size: 10px;
      color: #333333;
      margin-top: 2px;
    }
    .main-totals-badge {
      text-align: right;
    }
    .main-totals-val {
      font-size: 16px;
      font-weight: 800;
    }
    .order-block {
      border: 1px solid #000000;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .order-header {
      background: #f0f0f0;
      border-bottom: 1px solid #000000;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
    }
    .order-idx {
      font-weight: 800;
      margin-right: 6px;
    }
    .order-num {
      font-weight: 800;
      font-size: 11px;
      margin-right: 6px;
    }
    .order-status {
      font-weight: bold;
      color: #444444;
    }
    .order-subtotal {
      font-size: 10.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .order-weight-highlight {
      font-size: 12px;
      font-weight: 800;
      border: 1px solid #000000;
      background: #ffffff;
      padding: 1px 6px;
    }
    .order-val-sub {
      font-size: 10px;
      color: #333333;
      font-weight: bold;
    }
    .client-info-box {
      background: #ffffff;
      border-bottom: 1px solid #000000;
      padding: 6px 10px;
      font-size: 10px;
    }
    .client-name-row {
      margin-bottom: 3px;
      font-size: 10.5px;
      word-break: break-word;
    }
    .client-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 9.5px;
      color: #222222;
    }
    .info-label {
      font-weight: bold;
      color: #444444;
      text-transform: uppercase;
      font-size: 8.5px;
      margin-right: 3px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table th,
    .items-table td {
      border-bottom: 1px solid #cccccc;
      border-right: 1px solid #cccccc;
      padding: 4px 6px;
      font-size: 9.5px;
    }
    .items-table th:last-child,
    .items-table td:last-child {
      border-right: none;
    }
    .items-table tr:last-child td {
      border-bottom: none;
    }
    .items-table th {
      background: #fafafa;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 8.5px;
      text-align: left;
    }
    .center { text-align: center !important; }
    .right { text-align: right !important; }
    .bold { font-weight: bold; }
    .mono { font-family: "Courier New", Courier, monospace; }
    .order-obs {
      padding: 4px 8px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #333333;
      background: #fff;
    }
    .summary-box {
      border: 1.5px solid #000000;
      background: #f9f9f9;
      padding: 10px 14px;
      margin-top: 14px;
      page-break-inside: avoid;
      display: flex;
      justify-content: space-between;
      align-items: center;
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
    .summary-total {
      text-align: right;
    }
    .summary-total-val {
      font-size: 18px;
      font-weight: 800;
    }
    .footer-meta {
      margin-top: 16px;
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
    <div class="main-header">
      <div>
        <div class="main-title">Pacote de Pedidos &bull; ${escapeHtml(
          pacote.frigorificoNome
        )}</div>
        <div class="main-subtitle">
          Gerado em ${escapeHtml(dataGeracaoStr)} &bull; <strong>${
            pacote.pedidos.length
          }</strong> pedidos consolidados
        </div>
      </div>
      <div class="main-totals-badge">
        ${
          pacote.totalGeralPesoKg > 0
            ? `<div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Peso Total do Pacote</div>
               <div class="main-totals-val">${escapeHtml(
                 formatQuantity(pacote.totalGeralPesoKg, "kg")
               )}</div>
               <div style="font-size: 10.5px; font-weight: bold; color: #333333; margin-top: 2px;">Valor Total: ${escapeHtml(
                 formatCurrency(pacote.totalGeralValor)
               )}</div>`
            : `<div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Valor Total do Pacote</div>
               <div class="main-totals-val">${escapeHtml(
                 formatCurrency(pacote.totalGeralValor)
               )}</div>`
        }
      </div>
    </div>

    ${blocosPedidosHtml}

    <div class="summary-box">
      <div>
        <div class="summary-title">Resumo Geral Consolidado</div>
        <div class="summary-details">
          Total de Pedidos: <strong>${pacote.pedidos.length}</strong>
          &bull; Valor Total Estimado: <strong>${escapeHtml(
            formatCurrency(pacote.totalGeralValor)
          )}</strong>
        </div>
      </div>
      <div class="summary-total">
        ${
          pacote.totalGeralPesoKg > 0
            ? `<div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Peso Total Consolidado</div>
               <div class="summary-total-val">${escapeHtml(
                 formatQuantity(pacote.totalGeralPesoKg, "kg")
               )}</div>`
            : `<div style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Total Geral</div>
               <div class="summary-total-val">${escapeHtml(
                 formatCurrency(pacote.totalGeralValor)
               )}</div>`
        }
      </div>
    </div>

    <div class="footer-meta">
      <span>Sistema de Pedidos Comerciais &bull; Pacote Consolidado</span>
      <span>${escapeHtml(dataGeracaoStr)}</span>
    </div>
  </div>
</body>
</html>`;
}

export function imprimirPacoteEmPapel(pacote: PacotePedidosData): void {
  const html = gerarHtmlImpressaoA4Pacote(pacote);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível inicializar a janela de impressão.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}


export async function renderizarPaginasA4PacoteCanvas(
  pacote: PacotePedidosData
): Promise<HTMLCanvasElement[]> {
  const FONT_SANS = "Arial, Helvetica, sans-serif";
  const FONT_MONO = "'Courier New', Courier, monospace";

  const PAGE_W = 794;
  const PAGE_H = 1123;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const SCALE = 2;

  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Contexto Canvas 2D indisponível.");
  }

  // Medição da altura dinâmica necessária
  let dynamicHeight = MARGIN * 2 + 86 + 24; // Header e margens

  const PROD_COL_W = 230;
  const CLIENT_NAME_MAX_W = CONTENT_W - 72;

  const measuredOrders = pacote.pedidos.map((p) => {
    const nomeCliente = p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome;
    const razaoComplemento =
      p.cliente.nomeFantasia &&
      p.cliente.razaoSocialOuNome &&
      p.cliente.nomeFantasia !== p.cliente.razaoSocialOuNome
        ? ` (${p.cliente.razaoSocialOuNome})`
        : "";

    mCtx.font = `700 10.5px ${FONT_SANS}`;
    const clientNameLines = wrapTextLines(
      mCtx,
      `${nomeCliente}${razaoComplemento}`,
      CLIENT_NAME_MAX_W
    );
    const clientBoxH = 16 + clientNameLines.length * 14 + 20;

    mCtx.font = `700 10px ${FONT_SANS}`;
    const itemRows = p.itens.map((it) => {
      const lines = wrapTextLines(
        mCtx,
        it.produtoNomeSnapshot || "-",
        PROD_COL_W
      );
      const h = Math.max(22, lines.length * 13 + 8);
      return { lines, h };
    });
    const itemsH = itemRows.reduce((a, b) => a + b.h, 0);
    const obsH = p.observacoes && p.observacoes.trim() ? 22 : 0;
    const pHeaderH = 26;
    const thH = 20;
    const blockH = pHeaderH + clientBoxH + thH + itemsH + obsH + 12;
    dynamicHeight += blockH;
    return { clientNameLines, clientBoxH, itemRows, blockH };
  });

  dynamicHeight += 76 + 40; // Summary box e footer

  const usablePageH = PAGE_H - MARGIN * 2;
  const numPages = Math.max(1, Math.ceil(dynamicHeight / usablePageH));
  const masterH = Math.max(PAGE_H, MARGIN * 2 + numPages * usablePageH);

  const masterCanvas = document.createElement("canvas");
  masterCanvas.width = PAGE_W * SCALE;
  masterCanvas.height = masterH * SCALE;
  const ctx = masterCanvas.getContext("2d");
  if (!ctx) throw new Error("Erro ao criar canvas do pacote.");

  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, masterH);

  let y = MARGIN;
  const x0 = MARGIN;
  const xRight = MARGIN + CONTENT_W;

  // Header do Pacote
  const headerH = 74;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y, CONTENT_W, headerH);

  ctx.fillStyle = "#000000";
  ctx.font = `800 15px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `PACOTE DE PEDIDOS • ${pacote.frigorificoNome.toUpperCase()}`,
    x0 + 12,
    y + 28
  );

  ctx.font = `400 10px ${FONT_SANS}`;
  ctx.fillStyle = "#444444";
  ctx.fillText(
    `Gerado em ${new Date(pacote.dataGeracao).toLocaleString("pt-BR")} • ${
      pacote.pedidos.length
    } pedidos consolidados`,
    x0 + 12,
    y + 50
  );

  ctx.textAlign = "right";
  if (pacote.totalGeralPesoKg > 0) {
    ctx.fillStyle = "#222222";
    ctx.font = `700 9px ${FONT_SANS}`;
    ctx.fillText("PESO TOTAL DO PACOTE", xRight - 12, y + 20);

    ctx.fillStyle = "#000000";
    ctx.font = `800 18px ${FONT_SANS}`;
    ctx.fillText(
      formatQuantity(pacote.totalGeralPesoKg, "kg"),
      xRight - 12,
      y + 42
    );

    ctx.fillStyle = "#333333";
    ctx.font = `700 10.5px ${FONT_SANS}`;
    ctx.fillText(
      `Valor Total: ${formatCurrency(pacote.totalGeralValor)}`,
      xRight - 12,
      y + 60
    );
  } else {
    ctx.fillStyle = "#222222";
    ctx.font = `700 9.5px ${FONT_SANS}`;
    ctx.fillText("VALOR TOTAL DO PACOTE", xRight - 12, y + 24);

    ctx.fillStyle = "#000000";
    ctx.font = `800 18px ${FONT_SANS}`;
    ctx.fillText(formatCurrency(pacote.totalGeralValor), xRight - 12, y + 48);
  }

  y += headerH + 14;

  // Blocos de Pedidos
  const colWidths = [28, 64, 240, 96, 44, 76, 80, 86]; // 714
  const colStarts: number[] = [];
  let curX = x0;
  for (const w of colWidths) {
    colStarts.push(curX);
    curX += w;
  }

  pacote.pedidos.forEach((p, idx) => {
    const { clientNameLines, clientBoxH, itemRows, blockH } = measuredOrders[idx];

    // Borda externa do Bloco do Pedido
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y, CONTENT_W, blockH - 12);

    // Faixa 1: Header do Pedido (#, Número, Status | Peso em destaque + Valor)
    const pHeaderH = 26;
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(x0, y, CONTENT_W, pHeaderH);
    ctx.strokeRect(x0, y, CONTENT_W, pHeaderH);

    ctx.fillStyle = "#000000";
    ctx.font = `800 10.5px ${FONT_SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(
      `#${idx + 1}   ${p.numero}   [${p.status}]`,
      x0 + 8,
      y + 17
    );

    ctx.textAlign = "right";
    const valTxt = `Valor: ${formatCurrency(p.totalEstimado)}`;
    ctx.font = `700 9.5px ${FONT_SANS}`;
    ctx.fillStyle = "#333333";
    ctx.fillText(valTxt, xRight - 8, y + 17);
    const valW = ctx.measureText(valTxt).width;

    if (p.pesoInformadoKg) {
      ctx.fillStyle = "#000000";
      ctx.font = `800 11.5px ${FONT_SANS}`;
      ctx.fillText(
        `Peso: ${formatQuantity(p.pesoInformadoKg, "kg")}`,
        xRight - 18 - valW,
        y + 17
      );
    }

    // Faixa 2: Caixa separada com dados do Cliente (Nome, CNPJ, Cidade, Vendedor)
    let py = y + pHeaderH;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x0, py, CONTENT_W, clientBoxH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, py, CONTENT_W, clientBoxH);

    ctx.textAlign = "left";
    ctx.fillStyle = "#444444";
    ctx.font = `700 8.5px ${FONT_SANS}`;
    ctx.fillText("CLIENTE:", x0 + 8, py + 15);

    ctx.fillStyle = "#000000";
    ctx.font = `700 10.5px ${FONT_SANS}`;
    clientNameLines.forEach((line, lIdx) => {
      ctx.fillText(line, x0 + 56, py + 15 + lIdx * 14);
    });

    const metaY = py + 16 + clientNameLines.length * 14 + 4;
    const metaColW = CONTENT_W / 3;

    ctx.fillStyle = "#444444";
    ctx.font = `700 8.5px ${FONT_SANS}`;
    ctx.fillText("CNPJ:", x0 + 8, metaY);
    ctx.fillStyle = "#111111";
    ctx.font = `600 9.5px ${FONT_SANS}`;
    ctx.fillText(p.cliente.cnpj || "-", x0 + 40, metaY);

    ctx.fillStyle = "#444444";
    ctx.font = `700 8.5px ${FONT_SANS}`;
    ctx.fillText("CIDADE:", x0 + metaColW, metaY);
    ctx.fillStyle = "#111111";
    ctx.font = `600 9.5px ${FONT_SANS}`;
    ctx.fillText(p.cliente.cidade || "-", x0 + metaColW + 44, metaY);

    ctx.fillStyle = "#444444";
    ctx.font = `700 8.5px ${FONT_SANS}`;
    ctx.fillText("VENDEDOR:", x0 + metaColW * 2, metaY);
    ctx.fillStyle = "#111111";
    ctx.font = `600 9.5px ${FONT_SANS}`;
    ctx.fillText(p.vendedor?.nome || "-", x0 + metaColW * 2 + 56, metaY);

    py += clientBoxH;

    // Cabeçalho da Tabela
    const thH = 20;
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(x0, py, CONTENT_W, thH);
    ctx.strokeRect(x0, py, CONTENT_W, thH);

    const headers = [
      { text: "#", align: "center" as const },
      { text: "CÓDIGO", align: "left" as const },
      { text: "PRODUTO", align: "left" as const },
      { text: "EMBALAGEM", align: "left" as const },
      { text: "UNID.", align: "center" as const },
      { text: "QTD.", align: "right" as const },
      { text: "PREÇO UNIT.", align: "right" as const },
      { text: "SUBTOTAL", align: "right" as const },
    ];

    ctx.fillStyle = "#333333";
    ctx.font = `700 8.5px ${FONT_SANS}`;
    headers.forEach((h, i) => {
      const cx = colStarts[i];
      const cw = colWidths[i];
      if (h.align === "center") {
        ctx.textAlign = "center";
        ctx.fillText(h.text, cx + cw / 2, py + 13);
      } else if (h.align === "right") {
        ctx.textAlign = "right";
        ctx.fillText(h.text, cx + cw - 4, py + 13);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(h.text, cx + 4, py + 13);
      }
    });

    py += thH;

    // Itens
    p.itens.forEach((it, iIdx) => {
      const { lines, h } = itemRows[iIdx];
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x0, py, CONTENT_W, h);

      for (let c = 1; c < colStarts.length; c++) {
        ctx.beginPath();
        ctx.moveTo(colStarts[c], py);
        ctx.lineTo(colStarts[c], py + h);
        ctx.stroke();
      }

      ctx.fillStyle = "#000000";
      const ty = py + 14;

      ctx.font = `400 9px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.fillText(String(iIdx + 1), colStarts[0] + colWidths[0] / 2, ty);

      ctx.font = `700 9px ${FONT_MONO}`;
      ctx.textAlign = "left";
      ctx.fillText(it.produtoCodigoSnapshot || "-", colStarts[1] + 4, ty);

      ctx.font = `700 9px ${FONT_SANS}`;
      lines.forEach((l, lIdx) => {
        ctx.fillText(l, colStarts[2] + 4, ty + lIdx * 13);
      });

      ctx.font = `400 8.5px ${FONT_SANS}`;
      ctx.fillText(it.produtoEmbalagemSnapshot || "-", colStarts[3] + 4, ty);

      ctx.textAlign = "center";
      ctx.fillText(it.produtoUnidadeSnapshot, colStarts[4] + colWidths[4] / 2, ty);

      ctx.textAlign = "right";
      ctx.font = `700 9px ${FONT_SANS}`;
      ctx.fillText(
        formatQuantity(it.quantidade, it.produtoUnidadeSnapshot),
        colStarts[5] + colWidths[5] - 4,
        ty
      );

      ctx.font = `400 9px ${FONT_SANS}`;
      ctx.fillText(
        formatCurrency(it.precoUnitario),
        colStarts[6] + colWidths[6] - 4,
        ty
      );

      ctx.font = `700 9px ${FONT_SANS}`;
      ctx.fillText(
        formatCurrency(it.subtotal),
        colStarts[7] + colWidths[7] - 4,
        ty
      );

      py += h;
    });

    if (p.observacoes && p.observacoes.trim()) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x0, py, CONTENT_W, 20);
      ctx.strokeStyle = "#cccccc";
      ctx.strokeRect(x0, py, CONTENT_W, 20);

      ctx.fillStyle = "#333333";
      ctx.font = `400 8.5px ${FONT_SANS}`;
      ctx.textAlign = "left";
      ctx.fillText(`Obs: ${p.observacoes.trim()}`, x0 + 6, py + 13);
    }

    y += blockH;
  });

  // Caixa de Totais do Pacote (com destaque ao Peso Total)
  const sumH = 50;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(x0, y, CONTENT_W, sumH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y, CONTENT_W, sumH);

  ctx.fillStyle = "#000000";
  ctx.font = `800 11px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("RESUMO GERAL DO PACOTE", x0 + 10, y + 19);

  ctx.font = `600 10px ${FONT_SANS}`;
  ctx.fillStyle = "#333333";
  ctx.fillText(
    `Total de Pedidos: ${pacote.pedidos.length}   •   Valor Total Estimado: ${formatCurrency(pacote.totalGeralValor)}`,
    x0 + 10,
    y + 36
  );

  ctx.textAlign = "right";
  if (pacote.totalGeralPesoKg > 0) {
    ctx.font = `700 9px ${FONT_SANS}`;
    ctx.fillStyle = "#222222";
    ctx.fillText("PESO TOTAL CONSOLIDADO:", xRight - 10, y + 17);

    ctx.font = `800 17px ${FONT_SANS}`;
    ctx.fillStyle = "#000000";
    ctx.fillText(
      formatQuantity(pacote.totalGeralPesoKg, "kg"),
      xRight - 10,
      y + 38
    );
  } else {
    ctx.font = `700 9.5px ${FONT_SANS}`;
    ctx.fillStyle = "#222222";
    ctx.fillText("TOTAL GERAL:", xRight - 10, y + 17);

    ctx.font = `800 16px ${FONT_SANS}`;
    ctx.fillStyle = "#000000";
    ctx.fillText(formatCurrency(pacote.totalGeralValor), xRight - 10, y + 38);
  }

  y += sumH + 20;

  // Rodapé
  ctx.fillStyle = "#666666";
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("Documento Consolidado de Pedidos • Sistema Marco", x0, y);
  ctx.textAlign = "right";
  ctx.fillText(`Emitido em ${new Date().toLocaleString("pt-BR")}`, xRight, y);

  // Fatiamento A4
  const pages: HTMLCanvasElement[] = [];
  for (let p = 0; p < numPages; p++) {
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_W * SCALE;
    pageCanvas.height = PAGE_H * SCALE;
    const pCtx = pageCanvas.getContext("2d");
    if (!pCtx) continue;

    pCtx.fillStyle = "#ffffff";
    pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    const srcY = p * usablePageH * SCALE;
    const sliceH = Math.min(
      (usablePageH + MARGIN * 2) * SCALE,
      masterCanvas.height - srcY
    );

    pCtx.drawImage(
      masterCanvas,
      0,
      srcY,
      PAGE_W * SCALE,
      sliceH,
      0,
      0,
      PAGE_W * SCALE,
      sliceH
    );

    pages.push(pageCanvas);
  }

  return pages;
}

export async function gerarImagemPrintPacote(
  pacote: PacotePedidosData
): Promise<Blob> {
  const pages = await renderizarPaginasA4PacoteCanvas(pacote);
  const firstPage = pages[0] || document.createElement("canvas");

  return new Promise<Blob>((resolve, reject) => {
    firstPage.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Falha ao gerar imagem do pacote de pedidos."));
      }
    }, "image/png");
  });
}

export async function gerarArquivoPdfPacote(
  pacote: PacotePedidosData
): Promise<Blob> {
  const pageCanvases = await renderizarPaginasA4PacoteCanvas(pacote);
  const A4_PT_W = 595.28;
  const A4_PT_H = 841.89;

  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr as unknown as BlobPart);
    byteLength += arr.byteLength;
  };

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr as unknown as BlobPart);
    byteLength += arr.byteLength;
  };

  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  const numPages = pageCanvases.length;
  const pageObjIds: number[] = [];

  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(3 + i * 3);
  }

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${numPages} >>`
  );
  endObj();

  for (let i = 0; i < numPages; i++) {
    const canvas = pageCanvases[i];
    const jpegBytes = dataUrlToUint8Array(
      canvas.toDataURL("image/jpeg", 0.95)
    );

    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] /Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    const streamCmd = `q\n${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm\n${imgName} Do\nQ`;
    const streamBytes = encoder.encode(streamCmd);
    startObj(contentObjId);
    pushStr(`<< /Length ${streamBytes.byteLength} >>\nstream\n`);
    pushBytes(streamBytes);
    pushStr(`\nendstream`);
    endObj();

    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  }

  const totalObjs = 2 + numPages * 3;
  const xrefOffset = byteLength;

  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    const offStr = String(offsets[id] || 0).padStart(10, "0");
    pushStr(`${offStr} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob(chunks, { type: "application/pdf" });
}
