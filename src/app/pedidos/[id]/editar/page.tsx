"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  Save,
  Send,
  Sparkles,
  Building2,
  Users,
  UserCheck,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  calculateSubtotal,
  calculateOrderTotal,
  calculateReportedWeightKg,
  formatCurrency,
  formatQuantity,
} from "@/lib/money.ts";

interface Frigorifico {
  id: string;
  nomeFantasia: string;
}

interface Cliente {
  id: string;
  razaoSocialOuNome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  vendedorId: string | null;
}

interface Vendedor {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  frigorificoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  precoReferencia: number | null;
}

interface FormItem {
  id: string;
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number | string;
  precoUnitario: number | string;
  sugestaoOrigem?: "HISTORICO" | "REFERENCIA" | "MANUAL";
  sugestaoDetalhe?: string;
}

export default function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Estados dos selects
  const [frigorificos, setFrigorificos] = useState<Frigorifico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);

  // Campos do pedido sendo editado
  const [numeroPedido, setNumeroPedido] = useState<string>("");
  const [statusOriginal, setStatusOriginal] = useState<string>("");
  const [frigorificoId, setFrigorificoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<FormItem[]>([]);

  // Estados de controle e mensagens
  const [loadingPedido, setLoadingPedido] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [modalTrocaFrigorifico, setModalTrocaFrigorifico] = useState<string | null>(null);
  const [avisoTrocaCliente, setAvisoTrocaCliente] = useState(false);

  // Carrega opções de apoio (ativos)
  useEffect(() => {
    async function loadAuxiliares() {
      try {
        const [fRes, cRes, vRes] = await Promise.all([
          fetch("/api/frigorificos?ativos=true"),
          fetch("/api/clientes?ativos=true"),
          fetch("/api/vendedores?ativos=true"),
        ]);
        if (fRes.ok) setFrigorificos(await fRes.json());
        if (cRes.ok) setClientes(await cRes.json());
        if (vRes.ok) setVendedores(await vRes.json());
      } catch (e) {
        console.error("Erro ao carregar dados auxiliares:", e);
      }
    }
    loadAuxiliares();
  }, []);

  // Carrega os dados do pedido a ser editado
  useEffect(() => {
    async function loadPedido() {
      try {
        setLoadingPedido(true);
        const res = await fetch(`/api/pedidos/${id}`);
        if (!res.ok) {
          throw new Error("Pedido não encontrado.");
        }
        const data = await res.json();
        setNumeroPedido(data.numero);
        setStatusOriginal(data.status);
        setFrigorificoId(data.frigorificoId);
        setVendedorId(data.vendedorId);
        setClienteId(data.clienteId);
        setObservacoes(data.observacoes || "");

        if (data.itens && Array.isArray(data.itens)) {
          setItens(
            data.itens.map((it: {
              id: string;
              produtoId: string;
              produtoCodigoSnapshot: string;
              produtoNomeSnapshot: string;
              produtoUnidadeSnapshot: string;
              quantidade: number;
              precoUnitario: number;
            }) => ({
              id: it.id || "item-" + Math.random().toString(36).substring(2, 9),
              produtoId: it.produtoId,
              codigo: it.produtoCodigoSnapshot,
              nome: it.produtoNomeSnapshot,
              unidade: it.produtoUnidadeSnapshot,
              quantidade: it.quantidade,
              precoUnitario: it.precoUnitario,
              sugestaoOrigem: "HISTORICO",
              sugestaoDetalhe: "Preço registrado no rascunho",
            }))
          );
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingPedido(false);
      }
    }
    loadPedido();
  }, [id]);

  // Carrega os produtos do frigorífico selecionado
  useEffect(() => {
    async function loadProdutos() {
      if (!frigorificoId) {
        setProdutosDisponiveis([]);
        return;
      }
      try {
        const res = await fetch(`/api/produtos?frigorificoId=${frigorificoId}&ativos=true`);
        if (res.ok) {
          setProdutosDisponiveis(await res.json());
        }
      } catch (e) {
        console.error("Erro ao carregar produtos do frigorífico:", e);
      }
    }
    loadProdutos();
  }, [frigorificoId]);

  // Troca de frigorífico com guarda de confirmação caso existam itens
  const handleFrigorificoChange = (novoId: string) => {
    if (itens.length > 0 && novoId !== frigorificoId) {
      setModalTrocaFrigorifico(novoId);
    } else {
      setFrigorificoId(novoId);
    }
  };

  const confirmarTrocaFrigorifico = () => {
    if (modalTrocaFrigorifico !== null) {
      setFrigorificoId(modalTrocaFrigorifico);
      setItens([]);
      setModalTrocaFrigorifico(null);
    }
  };

  // Troca de vendedor: ajusta cliente se não pertencer ao novo vendedor
  const handleVendedorChange = (novoVendedorId: string) => {
    setVendedorId(novoVendedorId);
    if (clienteId) {
      const clienteAtual = clientes.find((c) => c.id === clienteId);
      if (clienteAtual && clienteAtual.vendedorId !== novoVendedorId) {
        setClienteId("");
        if (itens.length > 0) {
          setAvisoTrocaCliente(true);
        }
      }
    }
  };

  // Troca de cliente
  const handleClienteChange = (novoClienteId: string) => {
    if (itens.length > 0 && novoClienteId !== clienteId) {
      setAvisoTrocaCliente(true);
    }
    setClienteId(novoClienteId);
  };

  // Adiciona novo item à lista
  const adicionarItem = () => {
    const novoItem: FormItem = {
      id: "item-" + Date.now(),
      produtoId: "",
      codigo: "",
      nome: "",
      unidade: "kg",
      quantidade: "",
      precoUnitario: "",
    };
    setItens([...itens, novoItem]);
  };

  // Remove um item
  const removerItem = (itemId: string) => {
    setItens(itens.filter((it) => it.id !== itemId));
  };

  // Ao selecionar um produto para a linha
  const handleProdutoSelect = async (itemId: string, prodId: string) => {
    const prod = produtosDisponiveis.find((p) => p.id === prodId);
    if (!prod) return;

    let precoSugerido: number | string = "";
    let sugestaoOrigem: "HISTORICO" | "REFERENCIA" | "MANUAL" = "MANUAL";
    let sugestaoDetalhe = "";

    if (clienteId && frigorificoId) {
      try {
        const res = await fetch(
          `/api/sugestao-preco?clienteId=${clienteId}&frigorificoId=${frigorificoId}&produtoId=${prod.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.precoSugerido !== null) {
            precoSugerido = data.precoSugerido;
          }
          sugestaoOrigem = data.origem;
          sugestaoDetalhe = data.detalhe || "";
        }
      } catch (e) {
        console.error("Erro na busca de sugestão de preço:", e);
      }
    } else if (prod.precoReferencia) {
      precoSugerido = prod.precoReferencia;
      sugestaoOrigem = "REFERENCIA";
      sugestaoDetalhe = "Preço de referência do cadastro";
    }

    setItens((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              produtoId: prod.id,
              codigo: prod.codigo,
              nome: prod.nome,
              unidade: prod.unidade,
              precoUnitario: precoSugerido,
              sugestaoOrigem,
              sugestaoDetalhe,
            }
          : it
      )
    );
  };

  // Atualiza quantidade ou preço de um item
  const handleItemFieldChange = (
    itemId: string,
    field: "quantidade" | "precoUnitario",
    value: string
  ) => {
    setItens((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, [field]: value } : it))
    );
  };

  // Cálculos dinâmicos
  const totalEstimado = calculateOrderTotal(
    itens.map((i) => ({ quantidade: i.quantidade, precoUnitario: i.precoUnitario }))
  );
  const pesoInformadoKg = calculateReportedWeightKg(
    itens.map((i) => ({ quantidade: i.quantidade, unidade: i.unidade }))
  );

  // Submissão do pedido (Rascunho ou Confirmado) via PATCH
  const salvarPedido = async (statusDestino: "RASCUNHO" | "CONFIRMADO") => {
    setError(null);
    setSuccessMsg(null);
    setSalvando(true);

    try {
      if (!frigorificoId || !vendedorId || !clienteId) {
        throw new Error("Selecione o Frigorífico, o Vendedor e o Cliente.");
      }

      if (statusDestino === "CONFIRMADO") {
        if (itens.length === 0) {
          throw new Error("Adicione pelo menos um item para confirmar a venda.");
        }
        for (const item of itens) {
          if (!item.produtoId) {
            throw new Error("Existem itens sem produto selecionado.");
          }
          const q = Number(item.quantidade);
          const p = Number(item.precoUnitario);
          if (isNaN(q) || q <= 0) {
            throw new Error(`Informe uma quantidade válida para "${item.nome || "o produto"}".`);
          }
          if (isNaN(p) || p <= 0) {
            throw new Error(`Informe um preço válido para "${item.nome || "o produto"}".`);
          }
        }
      }

      const payload = {
        frigorificoId,
        clienteId,
        vendedorId,
        status: statusDestino,
        observacoes,
        itens: itens
          .filter((i) => i.produtoId)
          .map((i) => ({
            produtoId: i.produtoId,
            quantidade: Number(i.quantidade) || 0,
            precoUnitario: Number(i.precoUnitario) || 0,
          })),
      };

      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar pedido.");
      }

      setSuccessMsg(
        statusDestino === "CONFIRMADO"
          ? "Pedido confirmado com sucesso!"
          : "Rascunho atualizado com sucesso!"
      );

      setTimeout(() => {
        router.push(`/pedidos/${id}`);
      }, 700);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (loadingPedido) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center text-slate-500">
        <RotateCcw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm font-medium">Carregando dados do pedido...</p>
      </div>
    );
  }

  // Se o pedido não estiver em RASCUNHO, bloqueia a edição com explicação
  if (statusOriginal && statusOriginal !== "RASCUNHO") {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-amber-900 mb-2">
            Este pedido não pode ser editado
          </h1>
          <p className="text-sm text-amber-800 max-w-lg mx-auto mb-6">
            O pedido <strong>{numeroPedido}</strong> possui status{" "}
            <span className="font-bold uppercase">{statusOriginal}</span>. Conforme as regras de integridade do sistema, somente pedidos com status <strong>RASCUNHO</strong> podem sofrer alterações.
            {statusOriginal === "CONFIRMADO" && (
              <span> Caso haja necessidade de correção em um pedido confirmado, solicite o cancelamento formal com justificativa e registre um novo pedido.</span>
            )}
          </p>
          <Link
            href={`/pedidos/${id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Detalhes do Pedido</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Topo / Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={`/pedidos/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Detalhes do Pedido</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Editar Pedido {numeroPedido}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md border text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200">
              Rascunho
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Modifique as informações comerciais, adicione ou ajuste produtos e quantidades antes de confirmar a venda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/pedidos/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition"
          >
            Cancelar Edição
          </Link>
          <button
            type="button"
            onClick={() => salvarPedido("RASCUNHO")}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-blue-600 hover:bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Rascunho</span>
          </button>
          <button
            type="button"
            onClick={() => salvarPedido("CONFIRMADO")}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Confirmar Venda</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Atenção ao preencher o pedido</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="font-medium">{successMsg}</div>
        </div>
      )}

      {avisoTrocaCliente && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              O cliente comprador foi alterado. Revise os preços unitários abaixo, pois as condições comerciais ou sugestões personalizadas podem diferir.
            </span>
          </div>
          <button
            onClick={() => setAvisoTrocaCliente(false)}
            className="text-xs font-bold text-blue-700 hover:underline shrink-0 ml-4 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Formulário Principal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-8">
        {/* 1. SELEÇÃO COMERCIAL: Frigorífico -> Vendedor -> Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Frigorífico */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              1. Frigorífico Representado *
            </label>
            <select
              value={frigorificoId}
              onChange={(e) => handleFrigorificoChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">Selecione o Frigorífico...</option>
              {frigorificos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nomeFantasia}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Origem dos produtos cadastrados.
            </p>
          </div>

          {/* 2. Vendedor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-500" />
              2. Vendedor Responsável *
            </label>
            <select
              value={vendedorId}
              onChange={(e) => handleVendedorChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">Selecione o Vendedor...</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Filtra os clientes vinculados a este vendedor.
            </p>
          </div>

          {/* 3. Cliente */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-500" />
              3. Cliente Comprador *
            </label>
            {(() => {
              const clientesDoVendedor = vendedorId
                ? clientes.filter((c) => c.vendedorId === vendedorId)
                : [];

              return (
                <>
                  <select
                    disabled={!vendedorId}
                    value={clienteId}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!vendedorId
                        ? "Selecione o vendedor primeiro..."
                        : clientesDoVendedor.length === 0
                        ? "Nenhum cliente para este vendedor"
                        : "Selecione o Cliente..."}
                    </option>
                    {clientesDoVendedor.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeFantasia ? `${c.nomeFantasia} (${c.razaoSocialOuNome})` : c.razaoSocialOuNome}
                        {c.cnpj ? ` - CNPJ: ${c.cnpj}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {!vendedorId
                      ? "Disponível após selecionar o vendedor."
                      : `${clientesDoVendedor.length} cliente(s) na carteira deste vendedor.`}
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        {/* 2. ITENS DO PEDIDO */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Itens e Negociação</h2>
              <p className="text-xs text-slate-500">
                Produtos do frigorífico selecionado &bull; Adicione, remova ou altere quantidades e valores unitários
              </p>
            </div>
            <button
              type="button"
              onClick={adicionarItem}
              disabled={!frigorificoId}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl transition disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Adicionar Produto</span>
            </button>
          </div>

          {!frigorificoId ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
              Selecione o frigorífico acima para gerenciar os produtos deste pedido.
            </div>
          ) : itens.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
              Nenhum produto incluído. Clique em &ldquo;Adicionar Produto&rdquo; para incluir itens no rascunho.
            </div>
          ) : (
            <div className="space-y-3">
              {itens.map((item, index) => {
                const subtotal = calculateSubtotal(item.quantidade, item.precoUnitario);

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-sm"
                  >
                    {/* Seleção do Produto */}
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Produto #{index + 1}
                      </label>
                      <select
                        value={item.produtoId}
                        onChange={(e) => handleProdutoSelect(item.id, e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="">Selecione o produto...</option>
                        {produtosDisponiveis.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.codigo}] {p.nome} ({p.unidade})
                          </option>
                        ))}
                      </select>

                      {/* Badge da Sugestão de Preço */}
                      {item.sugestaoOrigem && (
                        <div className="mt-1 flex items-center gap-1 text-[10px]">
                          {item.sugestaoOrigem === "HISTORICO" ? (
                            <span className="text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {item.sugestaoDetalhe || "Último preço negociado"}
                            </span>
                          ) : item.sugestaoOrigem === "REFERENCIA" ? (
                            <span className="text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              Preço de Referência do Cadastro
                            </span>
                          ) : (
                            <span className="text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-sm">
                              Preço Manual
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantidade */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Qtd ({item.unidade || "un"})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={item.quantidade}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "quantidade", e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-right"
                      />
                    </div>

                    {/* Preço Unitário */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Preço Unit. (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={item.precoUnitario}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "precoUnitario", e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-right"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="md:col-span-2 text-right">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Subtotal
                      </label>
                      <div className="text-xs font-bold text-slate-900 py-2">
                        {formatCurrency(subtotal)}
                      </div>
                    </div>

                    {/* Remover */}
                    <div className="md:col-span-1 flex justify-center md:pt-4">
                      <button
                        type="button"
                        onClick={() => removerItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Remover produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. TOTAIS E OBSERVAÇÕES */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
          <div className="md:col-span-7 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Observações Comerciais
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções de entrega, condições de frete ou particularidades combinadas com o cliente..."
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-5 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Peso Informado:</span>
                <span className="font-bold text-slate-800">
                  {pesoInformadoKg > 0 ? formatQuantity(pesoInformadoKg, "kg") : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Itens com produto:</span>
                <span className="font-medium text-slate-800">
                  {itens.filter((i) => i.produtoId).length}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 mt-4 flex justify-between items-end">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Estimado
                </div>
                <div className="text-2xl font-extrabold text-blue-700">
                  {formatCurrency(totalEstimado)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Ações Inferior */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            href={`/pedidos/${id}`}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            &larr; Cancelar alterações e voltar
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => salvarPedido("RASCUNHO")}
              disabled={salvando}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-white border border-blue-600 hover:bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Rascunho</span>
            </button>
            <button
              type="button"
              onClick={() => salvarPedido("CONFIRMADO")}
              disabled={salvando}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Confirmar Venda</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação ao trocar frigorífico */}
      {modalTrocaFrigorifico !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Trocar de Frigorífico?
                </h3>
                <p className="text-xs text-slate-600">
                  Os produtos adicionados pertencem ao frigorífico anterior. Ao trocar de frigorífico, a lista atual de itens será limpa para evitar produtos de diferentes indústrias no mesmo pedido.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalTrocaFrigorifico(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarTrocaFrigorifico}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Confirmar e Limpar Itens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
