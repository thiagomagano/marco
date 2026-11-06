"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Edit2,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  Search,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/money.ts";

interface Frigorifico {
  id: string;
  nomeFantasia: string;
}

interface Produto {
  id: string;
  frigorificoId: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  embalagem: string | null;
  unidade: string;
  precoReferencia: number | null;
  ativo: boolean;
  frigorifico: {
    id: string;
    nomeFantasia: string;
  };
  _count: {
    itensPedido: number;
  };
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-slate-500">Carregando catálogo de produtos...</div>}>
      <ProdutosContent />
    </Suspense>
  );
}

function ProdutosContent() {
  const searchParams = useSearchParams();
  const initialFrigId = searchParams.get("frigorificoId") || "";

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [frigorificos, setFrigorificos] = useState<Frigorifico[]>([]);
  const [filtroFrigorificoId, setFiltroFrigorificoId] = useState(initialFrigId);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal de formulário
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [frigorificoId, setFrigorificoId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [embalagem, setEmbalagem] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [precoReferencia, setPrecoReferencia] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  // Modal de exclusão
  const [produtoExcluir, setProdutoExcluir] = useState<Produto | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [pRes, fRes] = await Promise.all([
        fetch(`/api/produtos${filtroFrigorificoId ? `?frigorificoId=${filtroFrigorificoId}` : ""}`),
        fetch("/api/frigorificos"),
      ]);
      if (pRes.ok) setProdutos(await pRes.json());
      if (fRes.ok) setFrigorificos(await fRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroFrigorificoId]);

  const abrirCriacao = () => {
    setEditandoId(null);
    setFrigorificoId(filtroFrigorificoId || (frigorificos[0]?.id || ""));
    setCodigo("");
    setNome("");
    setCategoria("");
    setEmbalagem("");
    setUnidade("kg");
    setPrecoReferencia("");
    setAtivo(true);
    setFormErro(null);
    setModalAberto(true);
  };

  const abrirEdicao = (p: Produto) => {
    setEditandoId(p.id);
    setFrigorificoId(p.frigorificoId);
    setCodigo(p.codigo);
    setNome(p.nome);
    setCategoria(p.categoria || "");
    setEmbalagem(p.embalagem || "");
    setUnidade(p.unidade);
    setPrecoReferencia(p.precoReferencia !== null ? String(p.precoReferencia) : "");
    setAtivo(p.ativo);
    setFormErro(null);
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);
    setSalvando(true);

    try {
      const url = editandoId ? `/api/produtos/${editandoId}` : "/api/produtos";
      const method = editandoId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frigorificoId,
          codigo,
          nome,
          categoria,
          embalagem,
          unidade,
          precoReferencia,
          ativo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar produto.");
      }

      setModalAberto(false);
      carregarDados();
    } catch (err) {
      setFormErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (p: Produto) => {
    try {
      const res = await fetch(`/api/produtos/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !p.ativo }),
      });
      if (res.ok) {
        carregarDados();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmarExclusao = async () => {
    if (!produtoExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const res = await fetch(`/api/produtos/${produtoExcluir.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir produto.");
      }
      setProdutoExcluir(null);
      carregarDados();
    } catch (err) {
      setErroExclusao((err as Error).message);
    } finally {
      setExcluindo(false);
    }
  };

  const filtrados = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      (p.categoria && p.categoria.toLowerCase().includes(busca.toLowerCase())) ||
      (p.embalagem && p.embalagem.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Produtos organizados por frigorífico &bull; Unidades comerciais em kg, peça ou caixa
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* Filtros Contextuais */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Filtro por Frigorífico */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Contexto do Frigorífico
          </label>
          <select
            value={filtroFrigorificoId}
            onChange={(e) => setFiltroFrigorificoId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="">Todos os Frigoríficos</option>
            {frigorificos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nomeFantasia}
              </option>
            ))}
          </select>
        </div>

        {/* Busca por Nome ou Código */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Buscar Produto
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Digite o código ou nome do corte..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando catálogo...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum produto cadastrado para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nome do Produto</th>
                  <th className="py-3 px-4">Frigorífico</th>
                  <th className="py-3 px-4">Embalagem</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Unidade</th>
                  <th className="py-3 px-4 text-right">Preço de Referência</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.codigo}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p.nome}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.frigorifico.nomeFantasia}
                    </td>
                    <td className="py-3 px-4">
                      {p.embalagem ? (
                        <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium text-[11px] border border-slate-200">
                          {p.embalagem}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {p.categoria || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {p.unidade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {p.precoReferencia ? formatCurrency(p.precoReferencia) : "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          p.ativo
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => abrirEdicao(p)}
                        className="p-1 text-slate-500 hover:text-slate-900 rounded-md transition cursor-pointer"
                        title="Editar produto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setProdutoExcluir(p);
                          setErroExclusao(null);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(p)}
                        className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                      >
                        {p.ativo ? "Inativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição de Produto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={salvar}
            className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              {editandoId ? "Editar Produto" : "Novo Produto"}
            </h2>

            {formErro && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                {formErro}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Frigorífico Pertencente *
                </label>
                <select
                  disabled={Boolean(editandoId)}
                  value={frigorificoId}
                  onChange={(e) => setFrigorificoId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="">Selecione...</option>
                  {frigorificos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nomeFantasia}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código no Frigorífico *
                  </label>
                  <input
                    type="text"
                    required
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ex: 101, 2045..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Único dentro do frigorífico</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Unidade Comercial *
                  </label>
                  <select
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="kg">Quilograma (kg)</option>
                    <option value="peça">Peça</option>
                    <option value="caixa">Caixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Picanha Resfriada, Alcatra com Maminha..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Embalagem (Tamanho / Tipo)
                  </label>
                  <input
                    type="text"
                    value={embalagem}
                    onChange={(e) => setEmbalagem(e.target.value)}
                    placeholder="Ex: saco 20kg, caixa 20kg, 700gr..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Ex: saco 20kg, caixa 20kg, kg, 700gr, caixa NP</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria (Opcional)
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Cortes Suínos, Miúdos..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Preço de Referência (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoReferencia}
                  onChange={(e) => setPrecoReferencia(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="prodAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded-sm"
                />
                <label htmlFor="prodAtivo" className="font-semibold text-slate-700">
                  Produto Ativo (disponível para inclusão em novos pedidos)
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
                {salvando ? "Salvando..." : "Salvar Produto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {produtoExcluir && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Produto
                </h3>
                <p className="text-xs text-slate-600">
                  Tem certeza que deseja excluir o produto <strong>[{produtoExcluir.codigo}] {produtoExcluir.nome}</strong>?
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
                  setProdutoExcluir(null);
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
