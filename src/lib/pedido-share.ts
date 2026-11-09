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
