"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  UserCheck,
  Ban,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Printer,
  XCircle,
  Pencil,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";

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

  useEffect(() => {
    async function loadPedido() {
      try {
        const res = await fetch(`/api/pedidos/${id}`);
        if (!res.ok) {
          throw new Error("Pedido não encontrado.");
        }
        const data = await res.json();
        setPedido(data);
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
      setCancelErro("A justificativa é obrigatória e deve ter pelo menos 5 caracteres.");
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
            produtoId: (it as unknown as { produtoId?: string }).produtoId || it.id,
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

        <div className="flex items-center gap-2">
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
                <span className="font-semibold">Justificativa:</span> &ldquo;{pedido.justificativaCancelamento}&rdquo;
              </div>
              {pedido.dataCancelamento && (
                <div className="text-[11px] text-red-600 mt-0.5">
                  Cancelado em {new Date(pedido.dataCancelamento).toLocaleString("pt-BR")}
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
              <span>Criado em: {new Date(pedido.dataCriacao).toLocaleString("pt-BR")}</span>
              {pedido.dataConfirmacao && (
                <span>&bull; Confirmado em: {new Date(pedido.dataConfirmacao).toLocaleString("pt-BR")}</span>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500 font-medium">Total Estimado</div>
            <div className="text-2xl font-extrabold text-blue-700">
              {formatCurrency(pedido.totalEstimado)}
            </div>
            {pedido.pesoInformadoKg ? (
              <div className="text-xs text-slate-600 mt-0.5">
                Peso Informado: <span className="font-bold">{formatQuantity(pedido.pesoInformadoKg, "kg")}</span>
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
            <div className="font-bold text-sm text-slate-900">{pedido.frigorifico.nomeFantasia}</div>
            {pedido.frigorifico.cnpj && (
              <div className="text-slate-500">CNPJ: {pedido.frigorifico.cnpj}</div>
            )}
            {pedido.frigorifico.telefone && (
              <div className="text-slate-500">Tel: {pedido.frigorifico.telefone}</div>
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
              <div className="text-slate-600">{pedido.cliente.razaoSocialOuNome}</div>
            )}
            {pedido.cliente.cnpj && (
              <div className="text-slate-500">CNPJ: {pedido.cliente.cnpj}</div>
            )}
            {(() => {
              const partesEndereco = [
                pedido.cliente.endereco,
                pedido.cliente.bairro ? `Bairro ${pedido.cliente.bairro}` : null,
                pedido.cliente.cidade,
                pedido.cliente.cep ? `CEP ${pedido.cliente.cep}` : null,
              ].filter(Boolean);

              if (partesEndereco.length === 0) return null;
              return (
                <div className="text-slate-500">
                  <span className="font-semibold text-slate-700">Endereço: </span>
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
            <div className="font-bold text-sm text-slate-900">{pedido.vendedor.nome}</div>
            {pedido.vendedor.telefone && (
              <div className="text-slate-500">Tel: {pedido.vendedor.telefone}</div>
            )}
          </div>
        </div>

        {/* Tabela de Itens (Fotografia Histórica) */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Itens do Pedido</h2>
            <span className="text-xs text-slate-500">
              {pedido.itens.length} {pedido.itens.length === 1 ? "produto" : "produtos"}
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
                      {formatQuantity(it.quantidade, it.produtoUnidadeSnapshot)}
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
              <p className="text-slate-600 mt-0.5 whitespace-pre-wrap">{pedido.observacoes}</p>
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
              Conforme a regra comercial (Seção 5.7 e 5.8), o cancelamento é definitivo, o pedido não integrará mais as vendas confirmadas e não alimentará o histórico de preços. Se houve erro na negociação, cancele e crie um novo pedido com os dados corretos.
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
              <span className="text-[10px] text-slate-400">Mínimo de 5 caracteres.</span>
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
    </div>
  );
}
