"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  PlusCircle,
  Calendar,
  Building2,
  Users,
  UserCheck,
  ChevronRight,
  TrendingUp,
  FileCheck,
  FileEdit,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";

interface PedidoListItem {
  id: string;
  numero: string;
  status: string;
  totalEstimado: number;
  pesoInformadoKg: number | null;
  dataCriacao: string;
  dataConfirmacao: string | null;
  frigorifico: { id: string; nomeFantasia: string };
  cliente: { id: string; razaoSocialOuNome: string; nomeFantasia: string | null };
  vendedor: { id: string; nome: string };
  itens: Array<{
    id: string;
    produtoNomeSnapshot: string;
    produtoUnidadeSnapshot: string;
    quantidade: number;
    subtotal: number;
  }>;
}

interface ResumoFiltro {
  totalVendasConfirmadas: number;
  qtdTotal: number;
  qtdConfirmados: number;
  qtdRascunhos: number;
  qtdCancelados: number;
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoListItem[]>([]);
  const [resumo, setResumo] = useState<ResumoFiltro>({
    totalVendasConfirmadas: 0,
    qtdTotal: 0,
    qtdConfirmados: 0,
    qtdRascunhos: 0,
    qtdCancelados: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [termo, setTermo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [frigorificoId, setFrigorificoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [status, setStatus] = useState("TODOS");

  // Listas auxiliares para os selects de filtro
  const [frigorificos, setFrigorificos] = useState<Array<{ id: string; nomeFantasia: string }>>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; razaoSocialOuNome: string; nomeFantasia: string | null; vendedorId?: string | null }>>([]);
  const [vendedores, setVendedores] = useState<Array<{ id: string; nome: string }>>([]);

  // Carrega opções dos filtros
  useEffect(() => {
    async function carregarAuxiliares() {
      try {
        const [fRes, cRes, vRes] = await Promise.all([
          fetch("/api/frigorificos"),
          fetch("/api/clientes"),
          fetch("/api/vendedores"),
        ]);
        if (fRes.ok) setFrigorificos(await fRes.json());
        if (cRes.ok) setClientes(await cRes.json());
        if (vRes.ok) setVendedores(await vRes.json());
      } catch (e) {
        console.error("Erro ao carregar filtros auxiliares:", e);
      }
    }
    carregarAuxiliares();
  }, []);

  const buscarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (termo) params.set("termo", termo);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (frigorificoId) params.set("frigorificoId", frigorificoId);
      if (clienteId) params.set("clienteId", clienteId);
      if (vendedorId) params.set("vendedorId", vendedorId);
      if (status && status !== "TODOS") params.set("status", status);

      const res = await fetch(`/api/pedidos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPedidos(data.pedidos || []);
        setResumo(data.resumo || {
          totalVendasConfirmadas: 0,
          qtdTotal: 0,
          qtdConfirmados: 0,
          qtdRascunhos: 0,
          qtdCancelados: 0,
        });
      }
    } catch (e) {
      console.error("Erro ao buscar pedidos:", e);
    } finally {
      setLoading(false);
    }
  }, [termo, dataInicio, dataFim, frigorificoId, clienteId, vendedorId, status]);

  useEffect(() => {
    buscarPedidos();
  }, [buscarPedidos]);

  const limparFiltros = () => {
    setTermo("");
    setDataInicio("");
    setDataFim("");
    setFrigorificoId("");
    setClienteId("");
    setVendedorId("");
    setStatus("TODOS");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Topo da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pedidos Comerciais</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Consulte, filtre e acompanhe o histórico de todas as negociações registradas
          </p>
        </div>
        <div>
          <Link
            href="/pedidos/novo"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Pedido</span>
          </Link>
        </div>
      </div>

      {/* Caixa de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filtros de Pesquisa</span>
          </div>
          <button
            onClick={limparFiltros}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {/* Busca por Número */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Número do Pedido
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ex: PED-2026-00001"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Frigorífico */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Frigorífico
            </label>
            <select
              value={frigorificoId}
              onChange={(e) => setFrigorificoId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Frigoríficos</option>
              {frigorificos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nomeFantasia}
                </option>
              ))}
            </select>
          </div>

          {/* Vendedor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Vendedor
            </label>
            <select
              value={vendedorId}
              onChange={(e) => {
                const novoVend = e.target.value;
                setVendedorId(novoVend);
                if (clienteId && novoVend) {
                  const c = clientes.find((cli) => cli.id === clienteId);
                  if (c && c.vendedorId && c.vendedorId !== novoVend) {
                    setClienteId("");
                  }
                }
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Cliente
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {vendedorId ? "Todos os Clientes deste Vendedor" : "Todos os Clientes"}
              </option>
              {(vendedorId
                ? clientes.filter((c) => c.vendedorId === vendedorId)
                : clientes
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocialOuNome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Situação / Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Período De:
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Até:
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={buscarPedidos}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Aplicar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Somatório de Vendas Conforme Seção 8 da Especificação */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Vendas Registradas pela Representação (Filtro Atual)</span>
          </div>
          <div className="text-3xl font-extrabold text-blue-950 mt-1">
            {formatCurrency(resumo.totalVendasConfirmadas)}
          </div>
          <p className="text-xs text-blue-700 mt-0.5">
            Valores estimados negociados pela representação &bull; Pedidos em rascunho e cancelados não integram este total.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-emerald-700 font-bold">{resumo.qtdConfirmados}</span> confirmados
          </div>
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-amber-700 font-bold">{resumo.qtdRascunhos}</span> rascunhos
          </div>
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-red-700 font-bold">{resumo.qtdCancelados}</span> cancelados
          </div>
        </div>
      </div>

      {/* Listagem de Pedidos (Tabela Desktop / Cards Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>Consultando pedidos...</span>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum pedido encontrado com os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Visualização Desktop (Tabela) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Número</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Frigorífico</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Vendedor</th>
                    <th className="py-3 px-4 text-right">Peso (kg)</th>
                    <th className="py-3 px-4 text-right">Total Estimado</th>
                    <th className="py-3 px-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pedidos.map((p) => {
                    const statusClass =
                      p.status === "CONFIRMADO"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : p.status === "RASCUNHO"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200";

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {p.numero}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(p.dataCriacao).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider ${statusClass}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {p.frigorifico.nomeFantasia}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.vendedor.nome}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500">
                          {p.pesoInformadoKg ? formatQuantity(p.pesoInformadoKg, "kg") : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(p.totalEstimado)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {p.status === "RASCUNHO" && (
                              <Link
                                href={`/pedidos/${p.id}/editar`}
                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-semibold transition"
                                title="Editar rascunho"
                              >
                                <FileEdit className="w-3 h-3" />
                                <span>Editar</span>
                              </Link>
                            )}
                            <Link
                              href={`/pedidos/${p.id}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              <span>Detalhes</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Visualização Mobile (Cards compactos) */}
            <div className="md:hidden divide-y divide-slate-100">
              {pedidos.map((p) => {
                const statusClass =
                  p.status === "CONFIRMADO"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : p.status === "RASCUNHO"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200";

                return (
                  <Link
                    key={p.id}
                    href={`/pedidos/${p.id}`}
                    className="p-4 block hover:bg-slate-50 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{p.numero}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>
                        Cliente: <span className="font-semibold text-slate-800">{p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome}</span>
                      </div>
                      <div>
                        Frigorífico: <span className="font-medium text-slate-700">{p.frigorifico.nomeFantasia}</span>
                      </div>
                      <div>
                        Vendedor: <span className="text-slate-700">{p.vendedor.nome}</span> &bull; {new Date(p.dataCriacao).toLocaleDateString("pt-BR")}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        {p.pesoInformadoKg ? (
                          <span className="text-slate-500 font-medium">
                            {formatQuantity(p.pesoInformadoKg, "kg")}
                          </span>
                        ) : null}
                      </div>
                      <div className="font-bold text-sm text-slate-900">
                        {formatCurrency(p.totalEstimado)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
