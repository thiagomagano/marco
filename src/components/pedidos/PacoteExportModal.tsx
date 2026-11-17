"use client";

import { useState, type ReactNode } from "react";
import {
  Package,
  ClipboardList,
  Copy,
  Download,
  Printer,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";

interface PacoteExportModalProps {
  open: boolean;
  onClose: () => void;
  tipo: "PACOTE" | "PRODUCAO";
  titulo: string;
  subtitulo: ReactNode;
  dicaRodape: string;
  loading: boolean;
  erroGeracao: string | null;
  textoWhatsApp: string;
  previewUrls: string[];
  pngBlob: Blob | null;
  pdfBlob: Blob | null;
  nomeArquivoPdf: string;
  nomeArquivoPng: string;
  onImprimirA4: () => void;
}

export function PacoteExportModal({
  open,
  onClose,
  tipo,
  titulo,
  subtitulo,
  dicaRodape,
  loading,
  erroGeracao,
  textoWhatsApp,
  previewUrls,
  pngBlob,
  pdfBlob,
  nomeArquivoPdf,
  nomeArquivoPng,
  onImprimirA4,
}: PacoteExportModalProps) {
  const [modoVisualizacao, setModoVisualizacao] = useState<"A4" | "TEXTO">(
    "A4"
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  if (!open) return null;

  const erroExibido = erroAcao || erroGeracao;
  const isProducao = tipo === "PRODUCAO";

  const handleCopiarTexto = async () => {
    if (!textoWhatsApp) return;
    setErroAcao(null);
    try {
      await navigator.clipboard.writeText(textoWhatsApp);
      setFeedback("Texto copiado para a área de transferência!");
    } catch {
      setErroAcao("Falha ao copiar texto.");
    }
  };

  const handleCopiarImagem = async () => {
    if (!pngBlob) return;
    setErroAcao(null);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        setFeedback(
          "Imagem copiada! Abra o WhatsApp e aperte Ctrl+V."
        );
      } else {
        throw new Error(
          "Cópia direta não suportada. Use 'Baixar PDF' ou 'Imprimir Folha A4'."
        );
      }
    } catch (err) {
      setErroAcao((err as Error).message);
    }
  };

  const dispararDownload = (blob: Blob, nomeArquivo: string, msg: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setFeedback(msg);
  };

  const handleBaixarPdf = () => {
    if (!pdfBlob) return;
    setErroAcao(null);
    dispararDownload(pdfBlob, nomeArquivoPdf, "Download do PDF iniciado!");
  };

  const handleBaixarImagem = () => {
    if (!pngBlob) return;
    setErroAcao(null);
    dispararDownload(pngBlob, nomeArquivoPng, "Download da imagem iniciado!");
  };

  const handleImprimir = () => {
    setErroAcao(null);
    try {
      onImprimirA4();
      setFeedback("Janela de impressão A4 aberta!");
    } catch (err) {
      setErroAcao((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isProducao
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600"
              }`}
            >
              {isProducao ? (
                <ClipboardList className="w-5 h-5" />
              ) : (
                <Package className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
              <p className="text-xs text-slate-500">{subtitulo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModoVisualizacao("A4")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  modoVisualizacao === "A4"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Documento A4
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("TEXTO")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  modoVisualizacao === "TEXTO"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Texto WhatsApp
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!textoWhatsApp}
            onClick={handleCopiarTexto}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span>Copiar Texto</span>
          </button>

          <button
            type="button"
            disabled={loading || !pdfBlob}
            onClick={handleBaixarPdf}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Baixar PDF (A4)</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Imprimir A4</span>
          </button>

          <button
            type="button"
            disabled={loading || !pngBlob}
            onClick={handleCopiarImagem}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span>Copiar PNG</span>
          </button>

          <button
            type="button"
            disabled={loading || !pngBlob}
            onClick={handleBaixarImagem}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Baixar PNG</span>
          </button>
        </div>

        {/* Avisos */}
        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {erroExibido && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{erroExibido}</span>
          </div>
        )}

        {/* Pré-visualização */}
        <div className="flex-1 overflow-y-auto bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col items-center min-h-[300px]">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2 my-auto">
              <RefreshCw className="w-7 h-7 text-slate-400 mx-auto animate-spin" />
              <p className="font-semibold">
                {isProducao
                  ? "Somando produtos e renderizando resumo de produção..."
                  : "Consolidando pedidos e renderizando documento do pacote..."}
              </p>
            </div>
          ) : modoVisualizacao === "TEXTO" ? (
            <div className="w-full h-full bg-white p-4 rounded-lg font-mono text-xs whitespace-pre-wrap text-slate-800 border border-slate-200 overflow-y-auto max-h-[460px]">
              {textoWhatsApp}
            </div>
          ) : previewUrls.length > 0 ? (
            <div className="space-y-4 w-full flex flex-col items-center">
              {previewUrls.map((url, idx) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={idx}
                  src={url}
                  alt={`Pré-visualização página ${idx + 1}`}
                  className="max-w-full h-auto rounded-sm shadow-md border border-slate-300 bg-white"
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs my-auto">
              Não foi possível exibir a pré-visualização.
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-1 shrink-0 text-[11px] text-slate-400">
          <span>{dicaRodape}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
