"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  Building,
  UserCheck,
} from "lucide-react";
import { formatCnpj } from "@/lib/cnpj.ts";

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
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal formulário
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [razaoSocialOuNome, setRazaoSocialOuNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
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

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const url = filtroVendedorId
        ? `/api/clientes?vendedorId=${filtroVendedorId}`
        : "/api/clientes";
      const res = await fetch(url);
      if (res.ok) {
        setClientes(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    carregarClientes();
  }, [filtroVendedorId]);

  const abrirCriacao = () => {
    setEditandoId(null);
    setRazaoSocialOuNome("");
    setNomeFantasia("");
    setCnpj("");
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
    setModalAberto(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditandoId(c.id);
    setRazaoSocialOuNome(c.razaoSocialOuNome);
    setNomeFantasia(c.nomeFantasia || "");
    setCnpj(c.cnpj || "");
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
    setModalAberto(true);
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

  const filtrados = clientes.filter(
    (c) =>
      c.razaoSocialOuNome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(busca.toLowerCase())) ||
      (c.cnpj && c.cnpj.includes(busca)) ||
      (c.vendedor?.nome && c.vendedor.nome.toLowerCase().includes(busca.toLowerCase())) ||
      (c.cidade && c.cidade.toLowerCase().includes(busca.toLowerCase())) ||
      (c.bairro && c.bairro.toLowerCase().includes(busca.toLowerCase()))
  );

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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Filtro por Vendedor */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Carteira do Vendedor
          </label>
          <select
            value={filtroVendedorId}
            onChange={(e) => setFiltroVendedorId(e.target.value)}
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

        {/* Busca por Razão Social, Nome Fantasia ou CNPJ */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
            Buscar Cliente
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por razão social, nome fantasia, CNPJ, vendedor, cidade ou bairro..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando clientes...</div>
        ) : filtrados.length === 0 ? (
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
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Pedidos Realizados</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtrados.map((c) => (
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
                      {c.cnpj || (
                        <span className="text-slate-400 font-sans italic text-[11px]">
                          Sem CNPJ
                        </span>
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
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="p-1 text-slate-500 hover:text-slate-900 rounded-md transition cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Quando informado, deve ser único</span>
                </div>

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
    </div>
  );
}
