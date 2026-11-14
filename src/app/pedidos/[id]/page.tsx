"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  UserCheck,
  Ban,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  XCircle,
  Pencil,
  Share2,
  Copy,
  Download,
  Check,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";
import { formatInscricaoEstadual } from "@/lib/inscricao-estadual.ts";
import {
  gerarImagemPrintPedido,
  gerarNomeArquivoPrint,
  gerarNomeArquivoPdf,
  gerarTextoResumoWhatsApp,
  gerarArquivoPdfPedido,
  renderizarPaginasA4Canvas,
  imprimirPedidoEmPapel,
} from "@/lib/pedido-share.ts";

interface PedidoItem {
  id: string;
  produtoCodigoSnapshot: string;
  produtoNomeSnapshot: string;
  produtoUnidadeSnapshot: string;
  produtoEmbalagemSnapshot?: string | null;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

interface PedidoDetalhes {
  id: string;
  numero: string;
  status: string;
  observacoes: string | null;
  totalEstimado: number;
  pesoInformadoKg: number | null;
  justificativaCancelamento: string | null;
  dataCriacao: string;
  dataConfirmacao: string | null;
  dataCancelamento: string | null;
  frigorifico: {
    nomeFantasia: string;
    cnpj: string | null;
    telefone: string | null;
  };
  cliente: {
    razaoSocialOuNome: string;
    nomeFantasia: string | null;
    cnpj: string | null;
    inscricaoEstadual?: string | null;
    prazoPagamentoBoleto?: string | null;
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
  itens: PedidoItem[];
}

export default function DetalhesPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [pedido, setPedido] = useState<PedidoDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de cancelamento
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [cancelErro, setCancelErro] = useState<string | null>(null);

  // Ação de confirmar rascunho
  const [confirmando, setConfirmando] = useState(false);

  // Modal de compartilhamento / print / PDF A4 do pedido
  const [modalShareAberto, setModalShareAberto] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState<"PRINT" | "A4">(
    "PRINT"
  );
  const [gerandoPrint, setGerandoPrint] = useState(false);
  const [printBlob, setPrintBlob] = useState<Blob | null>(null);
  const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [a4PreviewUrl, setA4PreviewUrl] = useState<string | null>(null);
  const [feedbackShare, setFeedbackShare] = useState<string | null>(null);
  const [erroShare, setErroShare] = useState<string | null>(null);

  const abrirModalCompartilhamento = async (
    dadosPedido: PedidoDetalhes,
    modoInicial: "PRINT" | "A4" = "PRINT"
  ) => {
    setModalShareAberto(true);
    setModoVisualizacao(modoInicial);
    setFeedbackShare(null);
    setErroShare(null);
    setGerandoPrint(true);
    try {
      const [blobPng, blobPdf, paginasA4] = await Promise.all([
        gerarImagemPrintPedido(dadosPedido),
        gerarArquivoPdfPedido(dadosPedido),
        renderizarPaginasA4Canvas(dadosPedido),
      ]);

      setPrintBlob(blobPng);
      setPrintPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blobPng);
      });

      setPdfBlob(blobPdf);
      if (paginasA4.length > 0) {
        setA4PreviewUrl(paginasA4[0].toDataURL("image/png"));
      }
    } catch (err) {
      setErroShare(
        (err as Error).message || "Erro ao gerar arquivos de exportação."
      );
    } finally {
      setGerandoPrint(false);
    }
  };

  const handleCopiarImagemPrint = async () => {
    if (!printBlob) return;
    setErroShare(null);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": printBlob }),
        ]);
        setFeedbackShare(
          "Imagem copiada! Abra a conversa no WhatsApp e aperte Ctrl + V para colar o print."
        );
      } else {
        throw new Error(
          "Seu navegador não suporta cópia direta de imagem. Use o botão 'Baixar Print (PNG)'."
        );
      }
    } catch (err) {
      setErroShare(
        (err as Error).message ||
          "Não foi possível copiar a imagem automaticamente. Use 'Baixar Print (PNG)'."
      );
    }
  };

  const handleBaixarPrint = () => {
    if (!printPreviewUrl || !pedido) return;
    const link = document.createElement("a");
    link.href = printPreviewUrl;
    link.download = gerarNomeArquivoPrint(pedido.numero);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFeedbackShare("Download do print PNG iniciado!");
  };

  const handleBaixarPdfA4 = async () => {
    if (!pedido) return;
    setErroShare(null);
    try {
      const blob = pdfBlob || (await gerarArquivoPdfPedido(pedido));
      if (!pdfBlob) setPdfBlob(blob);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = gerarNomeArquivoPdf(pedido.numero);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setFeedbackShare(
        "Download do PDF A4 (pronto para impressão em papel) iniciado!"
      );
    } catch (err) {
      setErroShare(
        (err as Error).message || "Não foi possível gerar o arquivo PDF."
      );
    }
  };

  const handleImprimirPapelA4 = () => {
    if (!pedido) return;
    setErroShare(null);
    try {
      imprimirPedidoEmPapel(pedido);
      setFeedbackShare("Janela de impressão em folha A4 aberta!");
    } catch (err) {
      setErroShare(
        (err as Error).message || "Erro ao abrir janela de impressão."
      );
    }
  };

  const handleCompartilharNativo = async () => {
    if (!pedido) return;
    setErroShare(null);
    try {
      if (modoVisualizacao === "A4" && pdfBlob) {
        const nomePdf = gerarNomeArquivoPdf(pedido.numero);
        const arqPdf = new File([pdfBlob], nomePdf, {
          type: "application/pdf",
        });
        if (navigator.canShare && navigator.canShare({ files: [arqPdf] })) {
          await navigator.share({
            title: `Pedido ${pedido.numero} (PDF)`,
            text: `Pedido ${pedido.numero} em PDF para impressão - ${
              pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome
            }`,
            files: [arqPdf],
          });
          setFeedbackShare("PDF compartilhado com sucesso!");
          return;
        }
      }

      if (printBlob) {
        const nomeArquivo = gerarNomeArquivoPrint(pedido.numero);
        const arquivo = new File([printBlob], nomeArquivo, {
          type: "image/png",
        });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          await navigator.share({
            title: `Pedido ${pedido.numero}`,
            text: `Resumo do Pedido ${pedido.numero} - ${
              pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome
            }`,
            files: [arquivo],
          });
          setFeedbackShare("Compartilhamento enviado!");
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: `Pedido ${pedido.numero}`,
          text: gerarTextoResumoWhatsApp(pedido),
        });
      } else {
        await handleCopiarImagemPrint();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErroShare("Não foi possível abrir o compartilhamento do sistema.");
      }
    }
  };

  const handleCopiarTextoWhatsApp = async () => {
    if (!pedido) return;
    setErroShare(null);
    try {
      const texto = gerarTextoResumoWhatsApp(pedido);
      await navigator.clipboard.writeText(texto);
      setFeedbackShare("Resumo em texto copiado para a área de transferência!");
    } catch {
      setErroShare("Não foi possível copiar o texto.");
    }
  };

  useEffect(() => {
    async function loadPedido() {
      try {
        const res = await fetch(`/api/pedidos/${id}`);
        if (!res.ok) {
          throw new Error("Pedido não encontrado.");
        }
        const data = await res.json();
        setPedido(data);
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search);
          if (sp.get("share") === "1") {
            abrirModalCompartilhamento(
              data,
              sp.get("format") === "a4" ? "A4" : "PRINT"
            );
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadPedido();
  }, [id]);

  const handleCancelar = async () => {
    setCancelErro(null);
    if (!justificativa || justificativa.trim().length < 5) {
      setCancelErro(
        "A justificativa é obrigatória e deve ter pelo menos 5 caracteres."
      );
      return;
    }

    setCancelando(true);
    try {
      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCELAR",
          justificativa: justificativa.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao cancelar pedido.");
      }

      setPedido(data);
      setModalCancelarAberto(false);
      router.refresh();
    } catch (err) {
      setCancelErro((err as Error).message);
    } finally {
      setCancelando(false);
    }
  };

  const handleConfirmarRascunho = async () => {
    if (!pedido) return;
    setConfirmando(true);
    try {
      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CONFIRMADO",
          itens: pedido.itens.map((it) => ({
            produtoId:
              (it as unknown as { produtoId?: string }).produtoId || it.id,
            quantidade: it.quantidade,
            precoUnitario: it.precoUnitario,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao confirmar rascunho.");
      }

      setPedido(data);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirmando(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-500 text-sm">
        Carregando detalhes do pedido...
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 inline-block max-w-md">
          <p className="font-bold">{error || "Pedido não encontrado"}</p>
          <Link
            href="/pedidos"
            className="inline-block mt-4 text-xs font-semibold bg-white border border-red-300 text-red-800 px-4 py-2 rounded-lg"
          >
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  const statusBadge =
    pedido.status === "CONFIRMADO"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : pedido.status === "RASCUNHO"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-red-50 text-red-800 border-red-200";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Botão Voltar e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Pedidos</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => abrirModalCompartilhamento(pedido, "PRINT")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compartilhar / Print</span>
          </button>

          <button
            type="button"
            onClick={() => abrirModalCompartilhamento(pedido, "A4")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>PDF / Imprimir A4</span>
          </button>

          {pedido.status === "RASCUNHO" && (
            <>
              <Link
                href={`/pedidos/${pedido.id}/editar`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl transition shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                <span>Editar Rascunho</span>
              </Link>
              <button
                onClick={handleConfirmarRascunho}
                disabled={confirmando}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Venda</span>
              </button>
            </>
          )}

          {pedido.status === "CONFIRMADO" && (
            <button
              onClick={() => {
                setJustificativa("");
                setCancelErro(null);
                setModalCancelarAberto(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>Cancelar Pedido</span>
            </button>
          )}
        </div>
      </div>

      {/* Caixa do Pedido */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Banner de Cancelamento se Cancelado */}
        {pedido.status === "CANCELADO" && (
          <div className="bg-red-50 border-b border-red-200 p-4 sm:p-5 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-red-900">
                Pedido Cancelado
              </div>
              <div className="text-xs text-red-700 mt-1">
                <span className="font-semibold">Justificativa:</span> &ldquo;
                {pedido.justificativaCancelamento}&rdquo;
              </div>
              {pedido.dataCancelamento && (
                <div className="text-[11px] text-red-600 mt-0.5">
                  Cancelado em{" "}
                  {new Date(pedido.dataCancelamento).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Topo: Número, Datas e Status */}
        <div className="p-6 sm:p-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {pedido.numero}
              </h1>
              <span
                className={`px-2.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider ${statusBadge}`}
              >
                {pedido.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Criado em:{" "}
                {new Date(pedido.dataCriacao).toLocaleString("pt-BR")}
              </span>
              {pedido.dataConfirmacao && (
                <span>
                  &bull; Confirmado em:{" "}
                  {new Date(pedido.dataConfirmacao).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500 font-medium">
              Total Estimado
            </div>
            <div className="text-2xl font-extrabold text-blue-700">
              {formatCurrency(pedido.totalEstimado)}
            </div>
            {pedido.pesoInformadoKg ? (
              <div className="text-xs text-slate-600 mt-0.5">
                Peso Informado:{" "}
                <span className="font-bold">
                  {formatQuantity(pedido.pesoInformadoKg, "kg")}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Informações Comerciais */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 border-b border-slate-200 text-xs">
          {/* Frigorífico */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              Frigorífico Representado
            </span>
            <div className="font-bold text-sm text-slate-900">
              {pedido.frigorifico.nomeFantasia}
            </div>
            {pedido.frigorifico.cnpj && (
              <div className="text-slate-500">
                CNPJ: {pedido.frigorifico.cnpj}
              </div>
            )}
            {pedido.frigorifico.telefone && (
              <div className="text-slate-500">
                Tel: {pedido.frigorifico.telefone}
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Cliente Comprador
            </span>
            <div className="font-bold text-sm text-slate-900">
              {pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome}
            </div>
            {pedido.cliente.nomeFantasia && (
              <div className="text-slate-600">
                {pedido.cliente.razaoSocialOuNome}
              </div>
            )}
            {pedido.cliente.cnpj && (
              <div className="text-slate-500">CNPJ: {pedido.cliente.cnpj}</div>
            )}
            {pedido.cliente.inscricaoEstadual && (
              <div className="text-slate-500">
                IE: {formatInscricaoEstadual(pedido.cliente.inscricaoEstadual)}
              </div>
            )}
            {pedido.cliente.prazoPagamentoBoleto && (
              <div className="text-slate-500">
                <span className="font-semibold text-slate-700">
                  Prazo Boleto:{" "}
                </span>
                {pedido.cliente.prazoPagamentoBoleto}
              </div>
            )}
            {(() => {
              const partesEndereco = [
                pedido.cliente.endereco,
                pedido.cliente.bairro
                  ? `Bairro ${pedido.cliente.bairro}`
                  : null,
                pedido.cliente.cidade,
                pedido.cliente.cep ? `CEP ${pedido.cliente.cep}` : null,
              ].filter(Boolean);

              if (partesEndereco.length === 0) return null;
              return (
                <div className="text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Endereço:{" "}
                  </span>
                  {partesEndereco.join(" • ")}
                </div>
              );
            })()}
          </div>

          {/* Vendedor */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Vendedor Responsável
            </span>
            <div className="font-bold text-sm text-slate-900">
              {pedido.vendedor.nome}
            </div>
            {pedido.vendedor.telefone && (
              <div className="text-slate-500">
                Tel: {pedido.vendedor.telefone}
              </div>
            )}
          </div>
        </div>

        {/* Tabela de Itens (Fotografia Histórica) */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Itens do Pedido
            </h2>
            <span className="text-xs text-slate-500">
              {pedido.itens.length}{" "}
              {pedido.itens.length === 1 ? "produto" : "produtos"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Produto (Snapshot)</th>
                  <th className="py-2.5 px-3">Unidade</th>
                  <th className="py-2.5 px-3 text-right">Quantidade</th>
                  <th className="py-2.5 px-3 text-right">Preço Unit. (R$)</th>
                  <th className="py-2.5 px-3 text-right">Subtotal (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pedido.itens.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {it.produtoCodigoSnapshot}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span>{it.produtoNomeSnapshot}</span>
                        {it.produtoEmbalagemSnapshot && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm text-[10px] font-medium border border-slate-200">
                            Emb: {it.produtoEmbalagemSnapshot}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {it.produtoUnidadeSnapshot}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {formatQuantity(
                        it.quantidade,
                        it.produtoUnidadeSnapshot
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatCurrency(it.precoUnitario)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div className="pt-4 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-700">Observações:</span>
              <p className="text-slate-600 mt-0.5 whitespace-pre-wrap">
                {pedido.observacoes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cancelamento com Justificativa Obrigatória */}
      {modalCancelarAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-600 font-bold text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Cancelar Pedido {pedido.numero}</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Conforme a regra comercial (Seção 5.7 e 5.8), o cancelamento é
              definitivo, o pedido não integrará mais as vendas confirmadas e
              não alimentará o histórico de preços. Se houve erro na negociação,
              cancele e crie um novo pedido com os dados corretos.
            </p>

            {cancelErro && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                {cancelErro}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Justificativa do Cancelamento *
              </label>
              <textarea
                rows={3}
                required
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex: Erro no preço negociado pelo vendedor; cliente solicitou cancelamento; duplicidade de pedido..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
              <span className="text-[10px] text-slate-400">
                Mínimo de 5 caracteres.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalCancelarAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={cancelando}
                onClick={handleCancelar}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {cancelando ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compartilhamento: Print p/ WhatsApp & PDF A4 Imprimível */}
      {modalShareAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
            {/* Cabeçalho do Modal + Seletor de Formato */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Compartilhar / Imprimir Pedido {pedido.numero}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Escolha entre o Print para WhatsApp (PNG) ou o Documento PDF
                    A4 pronto para impressão em papel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("PRINT")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modoVisualizacao === "PRINT"
                        ? "bg-white text-emerald-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Print WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("A4")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modoVisualizacao === "A4"
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Folha A4 (PDF / Papel)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setModalShareAberto(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 shrink-0">
              <button
                type="button"
                disabled={gerandoPrint || !printBlob}
                onClick={handleCopiarImagemPrint}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copiar Print (Ctrl+V no WhatsApp)</span>
              </button>

              <button
                type="button"
                disabled={gerandoPrint}
                onClick={handleBaixarPdfA4}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar PDF Imprimível (A4)</span>
              </button>

              <button
                type="button"
                onClick={handleImprimirPapelA4}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Imprimir em Papel (A4)</span>
              </button>

              <button
                type="button"
                disabled={gerandoPrint || !printPreviewUrl}
                onClick={handleBaixarPrint}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>Baixar Imagem PNG</span>
              </button>

              <button
                type="button"
                disabled={gerandoPrint}
                onClick={handleCompartilharNativo}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>
                  Enviar pelo Celular (
                  {modoVisualizacao === "A4" ? "PDF" : "PNG"})
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopiarTextoWhatsApp}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Copiar Resumo em Texto</span>
              </button>
            </div>

            {/* Avisos de Feedback ou Erro */}
            {feedbackShare && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedbackShare}</span>
              </div>
            )}

            {erroShare && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{erroShare}</span>
              </div>
            )}

            {/* Pré-visualização */}
            <div className="flex-1 overflow-y-auto bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-center min-h-[260px]">
              {gerandoPrint ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto animate-pulse" />
                  <p className="font-semibold">
                    Gerando print e documento PDF A4 em alta resolução...
                  </p>
                </div>
              ) : modoVisualizacao === "A4" && a4PreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={a4PreviewUrl}
                  alt={`Folha A4 do Pedido ${pedido.numero}`}
                  className="max-w-full h-auto rounded-sm shadow-md border border-slate-300 bg-white"
                />
              ) : printPreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={printPreviewUrl}
                  alt={`Print do Pedido ${pedido.numero}`}
                  className="max-w-full h-auto rounded-lg shadow-sm border border-slate-200"
                />
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Não foi possível carregar a pré-visualização.
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-between pt-1 shrink-0 text-[11px] text-slate-400">
              <span>
                {modoVisualizacao === "A4"
                  ? "Modo Folha A4: diagramação P&B com bordas nítidas e espaço para assinatura de conferência no papel."
                  : "Modo Print WhatsApp: clique em 'Copiar Print' e pressione Ctrl+V direto na conversa."}
              </span>
              <button
                type="button"
                onClick={() => setModalShareAberto(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
