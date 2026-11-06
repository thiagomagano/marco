"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Edit2,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

interface Frigorifico {
  id: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
  _count: {
    produtos: number;
    pedidos: number;
  };
}

export default function FrigorificosPage() {
  const [frigorificos, setFrigorificos] = useState<Frigorifico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  // Modal de criação / edição
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  // Modal de exclusão
  const [frigorificoExcluir, setFrigorificoExcluir] = useState<Frigorifico | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregarFrigorificos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/frigorificos");
      if (res.ok) {
        setFrigorificos(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFrigorificos();
  }, []);

  const abrirCriacao = () => {
    setEditandoId(null);
    setNomeFantasia("");
    setRazaoSocial("");
    setCnpj("");
    setContato("");
    setTelefone("");
    setEmail("");
    setObservacoes("");
    setAtivo(true);
    setFormErro(null);
    setModalAberto(true);
  };

  const abrirEdicao = (f: Frigorifico) => {
    setEditandoId(f.id);
    setNomeFantasia(f.nomeFantasia);
    setRazaoSocial(f.razaoSocial || "");
    setCnpj(f.cnpj || "");
    setContato(f.contato || "");
    setTelefone(f.telefone || "");
    setEmail(f.email || "");
    setObservacoes(f.observacoes || "");
    setAtivo(f.ativo);
    setFormErro(null);
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    setSalvando(true);

    try {
      const url = editandoId ? `/api/frigorificos/${editandoId}` : "/api/frigorificos";
      const method = editandoId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeFantasia,
          razaoSocial,
          cnpj,
          contato,
          telefone,
          email,
          observacoes,
          ativo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar frigorífico.");
      }

      setModalAberto(false);
      carregarFrigorificos();
    } catch (err) {
      setFormErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (f: Frigorifico) => {
    try {
      const res = await fetch(`/api/frigorificos/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !f.ativo }),
      });
      if (res.ok) {
        carregarFrigorificos();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmarExclusao = async () => {
    if (!frigorificoExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const res = await fetch(`/api/frigorificos/${frigorificoExcluir.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir frigorífico.");
      }
      setFrigorificoExcluir(null);
      carregarFrigorificos();
    } catch (err) {
      setErroExclusao((err as Error).message);
    } finally {
      setExcluindo(false);
    }
  };

  const filtrados = frigorificos.filter(
    (f) =>
      f.nomeFantasia.toLowerCase().includes(busca.toLowerCase()) ||
      (f.cnpj && f.cnpj.includes(busca))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Frigoríficos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Empresas representadas e seus catálogos de produtos
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Frigorífico</span>
        </button>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou CNPJ..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-hidden"
        />
      </div>

      {/* Grid de Frigoríficos */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Carregando frigoríficos...</div>
      ) : filtrados.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
          Nenhum frigorífico encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((f) => (
            <div
              key={f.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-base text-slate-900 leading-tight">
                    {f.nomeFantasia}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      f.ativo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {f.razaoSocial && (
                  <div className="text-xs text-slate-500">{f.razaoSocial}</div>
                )}
                {f.cnpj && (
                  <div className="text-xs text-slate-600 font-medium">CNPJ: {f.cnpj}</div>
                )}
                {f.telefone && (
                  <div className="text-xs text-slate-500">Tel: {f.telefone}</div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-500 space-x-2">
                  <span>{f._count.produtos} produtos</span>
                  <span>&bull;</span>
                  <span>{f._count.pedidos} pedidos</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/cadastros/produtos?frigorificoId=${f.id}`}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Ver catálogo de produtos deste frigorífico"
                  >
                    <Package className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => abrirEdicao(f)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setFrigorificoExcluir(f);
                      setErroExclusao(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Excluir frigorífico"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => toggleAtivo(f)}
                    className="text-[11px] font-semibold text-slate-500 hover:underline px-1 cursor-pointer"
                  >
                    {f.ativo ? "Inativar" : "Ativar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Formulário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={salvar}
            className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              {editandoId ? "Editar Frigorífico" : "Cadastrar Frigorífico"}
            </h2>

            {formErro && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                {formErro}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex: Frigorífico Boi Gordo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Razão Social (Opcional)
                </label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Boi Gordo Indústria de Carnes Ltda"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contato / Responsável
                  </label>
                  <input
                    type="text"
                    value={contato}
                    onChange={(e) => setContato(e.target.value)}
                    placeholder="Ex: Mauro Ramos"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    placeholder="pedidos@empresa.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
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
                  placeholder="Informações de entregas, regras de faturamento do frigorífico..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="frigoAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded-sm"
                />
                <label htmlFor="frigoAtivo" className="font-semibold text-slate-700">
                  Frigorífico Ativo (habilitado para receber novos pedidos)
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
                {salvando ? "Salvando..." : "Salvar Frigorífico"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {frigorificoExcluir && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Frigorífico
                </h3>
                <p className="text-xs text-slate-600">
                  Tem certeza que deseja excluir o frigorífico <strong>{frigorificoExcluir.nomeFantasia}</strong>?
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
                  setFrigorificoExcluir(null);
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
