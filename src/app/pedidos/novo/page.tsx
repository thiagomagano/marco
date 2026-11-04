"use client";

import { useState, useEffect, useRef } from "react";
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
  RotateCcw,
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
  id: string; // temp id
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number | string;
  precoUnitario: number | string;
  sugestaoOrigem?: "HISTORICO" | "REFERENCIA" | "MANUAL";
  sugestaoDetalhe?: string;
}

export default function NovoPedidoPage() {
  const router = useRouter();

  // Estados dos selects
  const [frigorificos, setFrigorificos] = useState<Frigorifico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);

  // Campos do formulário
  const [frigorificoId, setFrigorificoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<FormItem[]>([]);

  // Estados de controle e mensagens
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [modalTrocaFrigorifico, setModalTrocaFrigorifico] = useState<string | null>(null);
  const [avisoTrocaCliente, setAvisoTrocaCliente] = useState(false);
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false);

  // Carrega opções iniciais (apenas ativos)
  useEffect(() => {
    async function loadData() {
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
        console.error("Erro ao carregar dados:", e);
      }
    }
    loadData();
  }, []);

  // Recupera rascunho salvo no localStorage se existir
  useEffect(() => {
    const saved = localStorage.getItem("marco_draft_order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.frigorificoId || parsed.itens?.length > 0) {
          setFrigorificoId(parsed.frigorificoId || "");
          setClienteId(parsed.clienteId || "");
          setVendedorId(parsed.vendedorId || "");
          setObservacoes(parsed.observacoes || "");
          setItens(parsed.itens || []);
          setRascunhoRecuperado(true);
        }
      } catch {
        // ignora erro de parse
      }
    }
  }, []);

  // Salva rascunho localmente no navegador
  useEffect(() => {
    const draft = {
      frigorificoId,
      clienteId,
      vendedorId,
      observacoes,
      itens,
    };
    if (frigorificoId || clienteId || itens.length > 0) {
      localStorage.setItem("marco_draft_order", JSON.stringify(draft));
    }
  }, [frigorificoId, clienteId, vendedorId, observacoes, itens]);

  // Carrega os produtos do frigorífico selecionado
  useEffect(() => {
    if (!frigorificoId) {
      setProdutosDisponiveis([]);
      return;
    }
    async function loadProdutos() {
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

  // Guarda 5.2.7: Alerta e exige confirmação ao trocar de frigorífico com itens
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
      setItens([]); // Limpa itens pois pertencem a outro frigorífico
      setModalTrocaFrigorifico(null);
    }
  };

  // Guarda: ao trocar de vendedor, ajusta o cliente selecionado
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

  // Guarda 5.2.8: Alerta ao trocar de cliente
  const handleClienteChange = (novoClienteId: string) => {
    if (itens.length > 0 && novoClienteId !== clienteId) {
      setAvisoTrocaCliente(true);
    }
    setClienteId(novoClienteId);
  };

  // Adiciona novo item vazio à lista
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
  const removerItem = (id: string) => {
    setItens(itens.filter((it) => it.id !== id));
  };

  // Ao selecionar um produto para a linha de item
  const handleProdutoSelect = async (itemId: string, prodId: string) => {
    const prod = produtosDisponiveis.find((p) => p.id === prodId);
    if (!prod) return;

    // Busca sugestão de preço no backend
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

  // Submissão do pedido (Rascunho ou Confirmado)
  const salvarPedido = async (statusDestino: "RASCUNHO" | "CONFIRMADO") => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

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
            throw new Error(`Informe uma quantidade válida para "${item.nome || 'o produto'}".`);
          }
          if (isNaN(p) || p <= 0) {
            throw new Error(`Informe um preço válido para "${item.nome || 'o produto'}".`);
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

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar pedido.");
      }

      // Limpa rascunho salvo localmente
      localStorage.removeItem("marco_draft_order");

      router.push(`/pedidos/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const descartarRascunho = () => {
    localStorage.removeItem("marco_draft_order");
    setFrigorificoId("");
    setClienteId("");
    setVendedorId("");
    setObservacoes("");
    setItens([]);
    setRascunhoRecuperado(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Botão Voltar e Cabeçalho */}
      <div className="flex items-center justify-between">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Pedidos</span>
        </Link>

        {rascunhoRecuperado && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg">
            <span>Rascunho restaurado da sessão anterior</span>
            <button
              onClick={descartarRascunho}
              className="text-amber-900 font-bold hover:underline ml-1"
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Novo Pedido Comercial</h1>
          <p className="text-sm text-slate-500 mt-1">
            Selecione o frigorífico, o vendedor responsável e o cliente comprador da carteira.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {avisoTrocaCliente && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                O vendedor ou cliente foi alterado. Os preços sugeridos podem variar com base no histórico do novo cliente.
              </span>
            </div>
            <button
              onClick={() => setAvisoTrocaCliente(false)}
              className="font-bold hover:underline"
            >
              Entendi
            </button>
          </div>
        )}

        {/* 1. SELEÇÃO COMERCIAL: Frigorífico, Vendedor, Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b border-slate-200">
          {/* 1. Frigorífico */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
              Cada pedido pertence a um único frigorífico.
            </p>
          </div>

          {/* 2. Vendedor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
              Selecione o vendedor para carregar seus clientes.
            </p>
          </div>

          {/* 3. Cliente */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Itens e Negociação</h2>
              <p className="text-xs text-slate-500">
                Produtos ativos do frigorífico selecionado &bull; Sugestão automática de último preço
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
              Selecione o frigorífico acima para liberar a inclusão de produtos.
            </div>
          ) : itens.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
              Nenhum produto incluído. Clique em &ldquo;Adicionar Produto&rdquo; para começar.
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
                            <span className="text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-sm font-medium">
                              Sem histórico: informe manualmente
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
                        step={item.unidade === "kg" ? "0.001" : "1"}
                        min="0"
                        placeholder={item.unidade === "kg" ? "Ex: 125.500" : "Ex: 10"}
                        value={item.quantidade}
                        onChange={(e) =>
                          handleItemFieldChange(item.id, "quantidade", e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Preço Unitário Negociado */}
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                      />
                    </div>

                    {/* Subtotal Calculado */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Subtotal (R$)
                      </label>
                      <div className="py-2 px-3 text-xs bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800">
                        {formatCurrency(subtotal)}
                      </div>
                    </div>

                    {/* Botão Remover */}
                    <div className="md:col-span-1 flex justify-end md:justify-center pt-2 md:pt-4">
                      <button
                        type="button"
                        onClick={() => removerItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Remover item"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Observações Comerciais (Opcional)
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Entregar pela manhã. Pagamento 28 dias após descarga."
              className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Peso Informado em kg:</span>
                <span className="font-bold text-slate-800">
                  {formatQuantity(pesoInformadoKg, "kg")}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * Somatório das quantidades vendidas em kg. Itens por peça ou caixa não são convertidos.
              </p>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Total Estimado:</span>
                <span className="text-2xl font-extrabold text-blue-700">
                  {formatCurrency(totalEstimado)}
                </span>
              </div>
            </div>

            {/* Ações: Rascunho ou Confirmar */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => salvarPedido("RASCUNHO")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>Salvar Rascunho</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => salvarPedido("CONFIRMADO")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Venda</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmação ao trocar Frigorífico */}
      {modalTrocaFrigorifico !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Alterar Frigorífico Representado?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Você já incluiu produtos neste pedido. Como cada frigorífico possui catálogo e preços próprios, ao mudar o frigorífico todos os itens adicionados serão removidos para garantir a integridade.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setModalTrocaFrigorifico(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarTrocaFrigorifico}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Sim, alterar e limpar itens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
