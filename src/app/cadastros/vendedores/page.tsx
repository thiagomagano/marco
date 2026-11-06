"use client";

import { useState, useEffect } from "react";
import {
  UserCheck,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  ativo: boolean;
  _count: {
    clientes: number;
    pedidos: number;
  };
}

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal formulário
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  // Modal de exclusão
  const [vendedorExcluir, setVendedorExcluir] = useState<Vendedor | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregarVendedores = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendedores");
      if (res.ok) {
        setVendedores(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarVendedores();
  }, []);

  const abrirCriacao = () => {
    setEditandoId(null);
    setNome("");
    setTelefone("");
    setObservacoes("");
    setAtivo(true);
    setFormErro(null);
    setModalAberto(true);
  };

  const abrirEdicao = (v: Vendedor) => {
    setEditandoId(v.id);
    setNome(v.nome);
    setTelefone(v.telefone || "");
    setObservacoes(v.observacoes || "");
    setAtivo(v.ativo);
    setFormErro(null);
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    setSalvando(true);

    try {
      const url = editandoId ? `/api/vendedores/${editandoId}` : "/api/vendedores";
      const method = editandoId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          telefone,
          observacoes,
          ativo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar vendedor.");
      }

      setModalAberto(false);
      carregarVendedores();
    } catch (err) {
      setFormErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (v: Vendedor) => {
    try {
      const res = await fetch(`/api/vendedores/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !v.ativo }),
      });
      if (res.ok) {
        carregarVendedores();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmarExclusao = async () => {
    if (!vendedorExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const res = await fetch(`/api/vendedores/${vendedorExcluir.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir vendedor.");
      }
      setVendedorExcluir(null);
      carregarVendedores();
    } catch (err) {
      setErroExclusao((err as Error).message);
    } finally {
      setExcluindo(false);
    }
  };

  const filtrados = vendedores.filter((v) =>
    v.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Equipe de Vendedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Responsáveis comerciais associados aos pedidos &bull; Histórico contínuo de negociações
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Vendedor</span>
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar vendedor por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-hidden"
        />
      </div>

      {/* Grid de Vendedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-sm">
            Carregando vendedores...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
            Nenhum vendedor encontrado.
          </div>
        ) : (
          filtrados.map((v) => (
            <div
              key={v.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-base text-slate-900 leading-tight">
                    {v.nome}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      v.ativo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {v.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {v.telefone && (
                  <div className="text-xs text-slate-500">Tel: {v.telefone}</div>
                )}
                {v.observacoes && (
                  <div className="text-xs text-slate-400 italic">&ldquo;{v.observacoes}&rdquo;</div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  {v._count.clientes || 0} clientes &bull; {v._count.pedidos} pedidos
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => abrirEdicao(v)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setVendedorExcluir(v);
                      setErroExclusao(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Excluir vendedor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleAtivo(v)}
                    className="text-[11px] font-semibold text-slate-500 hover:underline px-1 cursor-pointer"
                  >
                    {v.ativo ? "Inativar" : "Ativar"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Formulário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={salvar}
            className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-xl space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              {editandoId ? "Editar Vendedor" : "Cadastrar Vendedor"}
            </h2>

            {formErro && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                {formErro}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome do Vendedor *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Telefone / Contato
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
                  Observações (Região, rotas...)
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Responsável por rotas da Zona Sul e grandes redes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="vendAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded-sm"
                />
                <label htmlFor="vendAtivo" className="font-semibold text-slate-700">
                  Vendedor Ativo (disponível para novos pedidos)
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
                {salvando ? "Salvando..." : "Salvar Vendedor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {vendedorExcluir && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Vendedor
                </h3>
                <p className="text-xs text-slate-600">
                  Tem certeza que deseja excluir o vendedor <strong>{vendedorExcluir.nome}</strong>?
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
                  setVendedorExcluir(null);
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
    </div>
  );
}
