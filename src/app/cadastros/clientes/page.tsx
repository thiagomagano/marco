"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit2,
  Search,
  AlertCircle,
  UserCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  X,
} from "lucide-react";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "@/lib/cnpj.ts";
import type { ConsultaCnpjResult } from "@/lib/brasilapi-cnpj.ts";
import {
  BrasilApiReviewModal,
  type ClienteCamposForm,
} from "@/components/clientes/BrasilApiReviewModal.tsx";
import { formatInscricaoEstadual } from "@/lib/inscricao-estadual.ts";
import {
  PRAZO_PAGAMENTO_DEFAULT,
  PRAZOS_PAGAMENTO_SUGESTOES,
} from "@/lib/prazo-pagamento.ts";

interface Vendedor {
  id: string;
  nome: string;
}

interface Cliente {
  id: string;
  razaoSocialOuNome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  cnpjNormalized: string | null;
  inscricaoEstadual: string | null;
  prazoPagamentoBoleto: string | null;
  vendedorId: string | null;
  vendedor: {
    id: string;
    nome: string;
  } | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  observacoes: string | null;
  ativo: boolean;
  _count: {
    pedidos: number;
  };
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [filtroVendedorId, setFiltroVendedorId] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVOS" | "INATIVOS">("TODOS");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal formulário
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [razaoSocialOuNome, setRazaoSocialOuNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [prazoPagamentoBoleto, setPrazoPagamentoBoleto] = useState(
    PRAZO_PAGAMENTO_DEFAULT
  );
  const [vendedorId, setVendedorId] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [cep, setCep] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formAviso, setFormAviso] = useState<string | null>(null);

  // Consulta BrasilAPI (CNPJ)
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [consultaErro, setConsultaErro] = useState<string | null>(null);
  const [consultaAviso, setConsultaAviso] = useState<string | null>(null);
  const [dadosBrasilApi, setDadosBrasilApi] = useState<ConsultaCnpjResult | null>(
    null
  );
  const [reviewModalAberto, setReviewModalAberto] = useState(false);

  // Modal de exclusão
  const [clienteExcluir, setClienteExcluir] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregarClientes = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (filtroVendedorId) params.set("vendedorId", filtroVendedorId);
        if (filtroStatus === "ATIVOS") params.set("ativos", "true");
        if (filtroStatus === "INATIVOS") params.set("ativos", "false");
        if (busca.trim()) params.set("busca", busca.trim());

        const res = await fetch(`/api/clientes?${params.toString()}`, {
          signal,
        });
        if (res.ok) {
          const data = await res.json();
          setClientes(data.clientes || []);
          setTotal(data.pagination?.total ?? 0);
          setTotalPages(data.pagination?.totalPages ?? 1);
        }
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          console.error(e);
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, limit, filtroVendedorId, filtroStatus, busca]
  );

  const carregarVendedores = async () => {
    try {
      const res = await fetch("/api/vendedores?ativos=true");
      if (res.ok) {
        setVendedores(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    carregarVendedores();
  }, []);

  // Debounce da busca textual + reset para página 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusca((prev) => {
        if (prev !== buscaInput) {
          setPage(1);
        }
        return buscaInput;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaInput]);

  useEffect(() => {
    const controller = new AbortController();
    carregarClientes(controller.signal);
    return () => controller.abort();
  }, [carregarClientes]);

  const abrirCriacao = () => {
    setEditandoId(null);
    setRazaoSocialOuNome("");
    setNomeFantasia("");
    setCnpj("");
    setInscricaoEstadual("");
    setPrazoPagamentoBoleto(PRAZO_PAGAMENTO_DEFAULT);
    setVendedorId(filtroVendedorId || (vendedores[0]?.id || ""));
    setTelefone("");
    setEmail("");
    setEndereco("");
    setBairro("");
    setCidade("");
    setCep("");
    setObservacoes("");
    setAtivo(true);
    setFormErro(null);
    setFormAviso(null);
    setConsultaErro(null);
    setConsultaAviso(null);
    setDadosBrasilApi(null);
    setReviewModalAberto(false);
    setModalAberto(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditandoId(c.id);
    setRazaoSocialOuNome(c.razaoSocialOuNome);
    setNomeFantasia(c.nomeFantasia || "");
    setCnpj(c.cnpj || "");
    setInscricaoEstadual(
      c.inscricaoEstadual ? formatInscricaoEstadual(c.inscricaoEstadual) : ""
    );
    setPrazoPagamentoBoleto(c.prazoPagamentoBoleto || "");
    setVendedorId(c.vendedorId || "");
    setTelefone(c.telefone || "");
    setEmail(c.email || "");
    setEndereco(c.endereco || "");
    setBairro(c.bairro || "");
    setCidade(c.cidade || "");
    setCep(c.cep || "");
    setObservacoes(c.observacoes || "");
    setAtivo(c.ativo);
    setFormErro(null);
    setFormAviso(null);
    setConsultaErro(null);
    setConsultaAviso(null);
    setDadosBrasilApi(null);
    setReviewModalAberto(false);
    setModalAberto(true);
  };

  const consultarBrasilApi = async () => {
    setConsultaErro(null);
    setConsultaAviso(null);

    const cnpjNormalizado = normalizeCnpj(cnpj);
    if (!cnpjNormalizado || !isValidCnpj(cnpjNormalizado)) {
      setConsultaErro(
        "Informe um CNPJ válido com 14 dígitos para consultar na BrasilAPI."
      );
      return;
    }

    setConsultandoCnpj(true);
    try {
      const res = await fetch(
        `/api/clientes/consulta-cnpj?cnpj=${encodeURIComponent(cnpjNormalizado)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar CNPJ na BrasilAPI.");
      }

      setDadosBrasilApi(data as ConsultaCnpjResult);
      setReviewModalAberto(true);
    } catch (err) {
      setConsultaErro((err as Error).message);
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const aplicarDadosBrasilApi = (campos: Partial<ClienteCamposForm>) => {
    if (campos.razaoSocialOuNome !== undefined) {
      setRazaoSocialOuNome(campos.razaoSocialOuNome);
    }
    if (campos.nomeFantasia !== undefined) {
      setNomeFantasia(campos.nomeFantasia);
    }
    if (campos.telefone !== undefined) {
      setTelefone(campos.telefone);
    }
    if (campos.email !== undefined) {
      setEmail(campos.email);
    }
    if (campos.cep !== undefined) {
      setCep(campos.cep);
    }
    if (campos.endereco !== undefined) {
      setEndereco(campos.endereco);
    }
    if (campos.bairro !== undefined) {
      setBairro(campos.bairro);
    }
    if (campos.cidade !== undefined) {
      setCidade(campos.cidade);
    }

    const cnpjNorm = normalizeCnpj(cnpj);
    if (cnpjNorm && isValidCnpj(cnpjNorm)) {
      setCnpj(formatCnpj(cnpjNorm));
    }

    setReviewModalAberto(false);
    const qtd = Object.keys(campos).length;
    setConsultaAviso(
      `${qtd} campo(s) atualizado(s) no formulário com dados da Receita Federal. Revise e clique em "Salvar Cliente".`
    );
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    setFormAviso(null);
    setSalvando(true);

    try {
      const url = editandoId ? `/api/clientes/${editandoId}` : "/api/clientes";
      const method = editandoId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razaoSocialOuNome,
          nomeFantasia,
          cnpj,
          inscricaoEstadual,
          prazoPagamentoBoleto,
          vendedorId,
          telefone,
          email,
          endereco,
          bairro,
          cidade,
          cep,
          observacoes,
          ativo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar cliente.");
      }

      if (data.aviso) {
        setFormAviso(data.aviso);
      }

      setModalAberto(false);
      carregarClientes();
    } catch (err) {
      setFormErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (c: Cliente) => {
    try {
      const res = await fetch(`/api/clientes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !c.ativo }),
      });
      if (res.ok) {
        carregarClientes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmarExclusao = async () => {
    if (!clienteExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const res = await fetch(`/api/clientes/${clienteExcluir.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir cliente.");
      }
      setClienteExcluir(null);
      if (clientes.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        carregarClientes();
      }
    } catch (err) {
      setErroExclusao((err as Error).message);
    } finally {
      setExcluindo(false);
    }
  };

  const inicioExibicao = total === 0 ? 0 : (page - 1) * limit + 1;
  const fimExibicao = Math.min(page * limit, total);

  const paginasVisiveis = (() => {
    const pages: Array<number | "..."> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clientes Compradores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Carteiras de clientes organizadas por vendedor &bull; Histórico individual de compras
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {formAviso && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <span>{formAviso}</span>
          <button onClick={() => setFormAviso(null)} className="font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Filtro por Vendedor */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Carteira do Vendedor
          </label>
          <select
            value={filtroVendedorId}
            onChange={(e) => {
              setFiltroVendedorId(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="">Todos os Vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Status */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Status
          </label>
          <select
            value={filtroStatus}
            onChange={(e) => {
              setFiltroStatus(e.target.value as "TODOS" | "ATIVOS" | "INATIVOS");
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="TODOS">Todos</option>
            <option value="ATIVOS">Somente Ativos</option>
            <option value="INATIVOS">Somente Inativos</option>
          </select>
        </div>

        {/* Busca por Razão Social, Nome Fantasia ou CNPJ */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Buscar Cliente
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por razão social, nome fantasia, CNPJ, IE, prazo, cidade ou bairro..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {buscaInput && (
              <button
                type="button"
                onClick={() => {
                  setBuscaInput("");
                  setBusca("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Resumo e Seletor de Itens por Página */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
          <div>
            {loading ? (
              <span>Consultando clientes...</span>
            ) : total === 0 ? (
              <span>0 clientes encontrados</span>
            ) : (
              <span>
                Mostrando <strong>{inicioExibicao}</strong>–<strong>{fimExibicao}</strong> de{" "}
                <strong>{total.toLocaleString("pt-BR")}</strong> cliente(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="clientes-limit" className="text-[11px] font-semibold text-slate-500">
              Por página:
            </label>
            <select
              id="clientes-limit"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando clientes...</div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome / Razão Social</th>
                  <th className="py-3 px-4">Nome Fantasia</th>
                  <th className="py-3 px-4">Vendedor Responsável</th>
                  <th className="py-3 px-4">Cidade / Bairro</th>
                  <th className="py-3 px-4">CNPJ / IE</th>
                  <th className="py-3 px-4">Prazo Boleto</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Pedidos Realizados</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {c.razaoSocialOuNome}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.nomeFantasia || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {c.vendedor ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          <UserCheck className="w-3 h-3" />
                          {c.vendedor.nome}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans italic text-[11px]">
                          Não vinculado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.cidade ? (
                        <div>
                          <span className="font-semibold text-slate-800">{c.cidade}</span>
                          {c.bairro && (
                            <span className="text-slate-400 text-[11px] block">{c.bairro}</span>
                          )}
                        </div>
                      ) : c.bairro ? (
                        <span className="text-slate-700">{c.bairro}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <div>
                        {c.cnpj || (
                          <span className="text-slate-400 font-sans italic text-[11px]">
                            Sem CNPJ
                          </span>
                        )}
                      </div>
                      {c.inscricaoEstadual && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          IE: {formatInscricaoEstadual(c.inscricaoEstadual)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {c.prazoPagamentoBoleto ? (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                          {c.prazoPagamentoBoleto}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.telefone || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{c._count.pedidos}</span> pedidos
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          c.ativo
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="p-1 text-slate-500 hover:text-slate-900 rounded-md transition cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setClienteExcluir(c);
                          setErroExclusao(null);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(c)}
                        className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                      >
                        {c.ativo ? "Inativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Controles de Paginação */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              {paginasVisiveis.map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`min-w-8 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer transition ${
                      item === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Formulário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={salvar}
            className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-base font-bold text-slate-900">
              {editandoId ? "Editar Cliente" : "Cadastrar Cliente"}
            </h2>

            {formErro && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                {formErro}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Razão Social ou Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={razaoSocialOuNome}
                  onChange={(e) => setRazaoSocialOuNome(e.target.value)}
                  placeholder="Ex: Supermercado Alvorada Ltda"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Fantasia (Opcional)
                </label>
                <input
                  type="text"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex: Alvorada Supermercados"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Vendedor Responsável */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vendedor Responsável (Carteira do Vendedor) *
                </label>
                <select
                  required
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="">Selecione o vendedor...</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400">
                  Cada vendedor terá sua lista própria de clientes para negociar pedidos.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CNPJ (Opcional)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => {
                      setCnpj(e.target.value);
                      if (consultaErro) setConsultaErro(null);
                    }}
                    placeholder="00.000.000/0000-00"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={consultarBrasilApi}
                    disabled={consultandoCnpj || !cnpj.trim()}
                    title="Buscar dados cadastrais na Receita Federal via BrasilAPI"
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${consultandoCnpj ? "animate-spin" : ""}`}
                    />
                    <span>
                      {consultandoCnpj ? "Consultando..." : "Atualizar cadastro"}
                    </span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  Quando informado, deve ser único • Use &quot;Atualizar cadastro&quot; para consultar via BrasilAPI
                </span>

                {consultaErro && (
                  <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{consultaErro}</span>
                  </div>
                )}

                {consultaAviso && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{consultaAviso}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="compras@cliente.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Inscrição Estadual (Opcional)
                  </label>
                  <input
                    type="text"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                    onBlur={() =>
                      setInscricaoEstadual((prev) =>
                        formatInscricaoEstadual(prev)
                      )
                    }
                    placeholder="000/0000000 (RS) ou ISENTO"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">
                    Padrão: vazio • No RS possui 10 dígitos (Módulo 11)
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Prazo de Pagamento no Boleto (Opcional)
                  </label>
                  <input
                    type="text"
                    value={prazoPagamentoBoleto}
                    onChange={(e) => setPrazoPagamentoBoleto(e.target.value)}
                    placeholder="Ex: 14 dias, 7/14/21..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {PRAZOS_PAGAMENTO_SUGESTOES.map((sugestao) => (
                      <button
                        key={sugestao}
                        type="button"
                        onClick={() => setPrazoPagamentoBoleto(sugestao)}
                        className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border transition cursor-pointer ${
                          prazoPagamentoBoleto.trim().toLowerCase() ===
                          sugestao.toLowerCase()
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {sugestao}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Padrão: 14 dias (pode alterar ou deixar em branco)
                  </span>
                </div>
              </div>

              {/* Localização e Endereço Estruturado */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Endereço e Localização
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      CEP (Opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={9}
                      value={cep}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setCep(val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val);
                      }}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Logradouro / Número
                    </label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua, Av., Número, Sala, etc."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Setor Bueno"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cidade / Município
                    </label>
                    <input
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Goiânia - GO"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Horário de recebimento, restrições de entrega..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cliAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded-sm"
                />
                <label htmlFor="cliAtivo" className="font-semibold text-slate-700">
                  Cliente Ativo (habilitado para novos pedidos)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {salvando ? "Salvando..." : "Salvar Cliente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {clienteExcluir && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Cliente
                </h3>
                <p className="text-xs text-slate-600">
                  Tem certeza que deseja excluir o cliente <strong>{clienteExcluir.nomeFantasia || clienteExcluir.razaoSocialOuNome}</strong>?
                </p>
              </div>
            </div>

            {erroExclusao && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Não foi possível excluir</span>
                </div>
                <div>{erroExclusao}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setClienteExcluir(null);
                  setErroExclusao(null);
                }}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BrasilApiReviewModal
        open={reviewModalAberto}
        onClose={() => setReviewModalAberto(false)}
        dados={dadosBrasilApi}
        valoresAtuais={{
          razaoSocialOuNome,
          nomeFantasia,
          telefone,
          email,
          cep,
          endereco,
          bairro,
          cidade,
        }}
        onAplicar={aplicarDadosBrasilApi}
      />
    </div>
  );
}
