"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  PlusCircle,
  TrendingUp,
  FileEdit,
  RefreshCw,
  Share2,
  ChevronRight,
  CheckSquare,
  Square,
  Package,
  Printer,
  Copy,
  Download,
  Check,
  AlertTriangle,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";
import {
  PedidoShareData,
  PacotePedidosData,
  compilarDadosPacote,
  gerarTextoWhatsAppPacote,
  gerarNomeArquivoPacote,
  gerarImagemPrintPacote,
  gerarArquivoPdfPacote,
  imprimirPacoteEmPapel,
  renderizarPaginasA4PacoteCanvas,
} from "@/lib/pedido-share.ts";

interface PedidoListItem {
  id: string;
  numero: string;
  status: string;
  observacoes?: string | null;
  totalEstimado: number;
  pesoInformadoKg: number | null;
  dataCriacao: string;
  dataConfirmacao: string | null;
  frigorifico: {
    id: string;
    nomeFantasia: string;
    cnpj?: string | null;
    telefone?: string | null;
  };
  cliente: {
    id: string;
    razaoSocialOuNome: string;
    nomeFantasia: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    cep?: string | null;
  };
  vendedor: { id: string; nome: string; telefone?: string | null };
  itens: Array<{
    id: string;
    produtoNomeSnapshot: string;
    produtoCodigoSnapshot: string;
    produtoUnidadeSnapshot: string;
    produtoEmbalagemSnapshot?: string | null;
    quantidade: number;
    precoUnitario: number;
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

  // Seleção múltipla para pacote de pedidos (restrito a 1 frigorífico por pacote)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [avisoSelecao, setAvisoSelecao] = useState<string | null>(null);

  // Modal do Pacote de Pedidos
  const [modalPacoteAberto, setModalPacoteAberto] = useState(false);
  const [pacoteData, setPacoteData] = useState<PacotePedidosData | null>(null);
  const [modoPacoteVisualizacao, setModoPacoteVisualizacao] = useState<
    "A4" | "TEXTO"
  >("A4");
  const [gerandoPacotePrint, setGerandoPacotePrint] = useState(false);
  const [pacotePreviewUrl, setPacotePreviewUrl] = useState<string | null>(null);
  const [pacotePngBlob, setPacotePngBlob] = useState<Blob | null>(null);
  const [pacotePdfBlob, setPacotePdfBlob] = useState<Blob | null>(null);
  const [feedbackPacote, setFeedbackPacote] = useState<string | null>(null);
  const [erroPacote, setErroPacote] = useState<string | null>(null);

  // Filtros
  const [termo, setTermo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [frigorificoId, setFrigorificoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [status, setStatus] = useState("TODOS");

  // Listas auxiliares para os selects de filtro
  const [frigorificos, setFrigorificos] = useState<
    Array<{ id: string; nomeFantasia: string }>
  >([]);
  const [clientes, setClientes] = useState<
    Array<{
      id: string;
      razaoSocialOuNome: string;
      nomeFantasia: string | null;
      vendedorId?: string | null;
    }>
  >([]);
  const [vendedores, setVendedores] = useState<
    Array<{ id: string; nome: string }>
  >([]);

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
        setResumo(
          data.resumo || {
            totalVendasConfirmadas: 0,
            qtdTotal: 0,
            qtdConfirmados: 0,
            qtdRascunhos: 0,
            qtdCancelados: 0,
          }
        );
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

  const pedidosSelecionadosLista = useMemo(() => {
    return pedidos.filter((p) => selecionados.has(p.id));
  }, [pedidos, selecionados]);

  const frigorificoSelecionado = useMemo(() => {
    if (pedidosSelecionadosLista.length === 0) return null;
    return pedidosSelecionadosLista[0].frigorifico;
  }, [pedidosSelecionadosLista]);

  // Gerenciamento de seleção (apenas pedidos CONFIRMADOS e de 1 único frigorífico)
  const toggleSelecionarPedido = (pedido: PedidoListItem) => {
    setAvisoSelecao(null);
    if (selecionados.has(pedido.id)) {
      setSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(pedido.id);
        return next;
      });
      return;
    }

    if (pedido.status !== "CONFIRMADO") {
      setAvisoSelecao(
        `O pedido ${pedido.numero} está com status "${pedido.status}". Apenas pedidos CONFIRMADOS podem entrar no pacote.`
      );
      return;
    }

    if (
      frigorificoSelecionado &&
      pedido.frigorifico.id !== frigorificoSelecionado.id
    ) {
      setAvisoSelecao(
        `Não é possível selecionar mais de 1 frigorífico para o mesmo resumo. O pacote atual já está vinculado ao frigorífico "${frigorificoSelecionado.nomeFantasia}".`
      );
      return;
    }

    setSelecionados((prev) => {
      const next = new Set(prev);
      next.add(pedido.id);
      return next;
    });
  };

  const selecionarTodosVisiveis = () => {
    setAvisoSelecao(null);
    const confirmadosVisiveis = pedidos.filter(
      (p) => p.status === "CONFIRMADO"
    );
    if (confirmadosVisiveis.length === 0) {
      setAvisoSelecao(
        "Não há pedidos CONFIRMADOS na lista atual para selecionar. Pedidos em rascunho ou cancelados não podem entrar no pacote."
      );
      return;
    }

    if (frigorificoSelecionado) {
      const doMesmoFrigorifico = confirmadosVisiveis.filter(
        (p) => p.frigorifico.id === frigorificoSelecionado.id
      );
      const todosDoMesmoMarcados =
        doMesmoFrigorifico.length > 0 &&
        doMesmoFrigorifico.every((p) => selecionados.has(p.id));
      if (todosDoMesmoMarcados) {
        setSelecionados(new Set());
      } else {
        setSelecionados(new Set(doMesmoFrigorifico.map((p) => p.id)));
      }
      return;
    }

    const frigsNaLista = Array.from(
      new Set(confirmadosVisiveis.map((p) => p.frigorifico.id))
    );
    if (frigsNaLista.length > 1) {
      setAvisoSelecao(
        "Há pedidos confirmados de frigoríficos diferentes na lista. Filtre por um frigorífico específico ou selecione o primeiro pedido manualmente para definir o frigorífico do resumo."
      );
      return;
    }

    setSelecionados(new Set(confirmadosVisiveis.map((p) => p.id)));
  };

  const totaisSelecionados = useMemo(() => {
    let valor = 0;
    let peso = 0;
    for (const p of pedidosSelecionadosLista) {
      valor += Number(p.totalEstimado || 0);
      if (p.pesoInformadoKg) {
        peso += Number(p.pesoInformadoKg);
      }
    }
    return {
      valor,
      peso,
      qtd: pedidosSelecionadosLista.length,
    };
  }, [pedidosSelecionadosLista]);

  // Abertura do Modal de Pacote
  const abrirModalPacote = async () => {
    if (pedidosSelecionadosLista.length === 0) return;
    setFeedbackPacote(null);
    setErroPacote(null);
    setGerandoPacotePrint(true);
    setModalPacoteAberto(true);

    try {
      const data = compilarDadosPacote(
        pedidosSelecionadosLista as unknown as PedidoShareData[]
      );
      setPacoteData(data);

      const [pagesCanvas, pngBlob, pdfBlob] = await Promise.all([
        renderizarPaginasA4PacoteCanvas(data),
        gerarImagemPrintPacote(data),
        gerarArquivoPdfPacote(data),
      ]);

      setPacotePngBlob(pngBlob);
      setPacotePdfBlob(pdfBlob);

      if (pagesCanvas.length > 0) {
        setPacotePreviewUrl(pagesCanvas[0].toDataURL("image/png"));
      }
    } catch (err) {
      setErroPacote(
        (err as Error).message || "Erro ao processar pacote de pedidos."
      );
    } finally {
      setGerandoPacotePrint(false);
    }
  };

  const handleCopiarTextoPacote = async () => {
    if (!pacoteData) return;
    setErroPacote(null);
    try {
      const texto = gerarTextoWhatsAppPacote(pacoteData);
      await navigator.clipboard.writeText(texto);
      setFeedbackPacote("Texto do pacote copiado para a área de transferência!");
    } catch {
      setErroPacote("Falha ao copiar texto do pacote.");
    }
  };

  const handleCopiarImagemPacote = async () => {
    if (!pacotePngBlob) return;
    setErroPacote(null);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pacotePngBlob }),
        ]);
        setFeedbackPacote(
          "Imagem do pacote copiada! Abra o WhatsApp e aperte Ctrl+V."
        );
      } else {
        throw new Error(
          "Cópia direta não suportada. Use 'Baixar PDF' ou 'Baixar Imagem'."
        );
      }
    } catch (err) {
      setErroPacote((err as Error).message);
    }
  };

  const handleBaixarPdfPacote = async () => {
    if (!pacoteData) return;
    setErroPacote(null);
    try {
      const blob = pacotePdfBlob || (await gerarArquivoPdfPacote(pacoteData));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = gerarNomeArquivoPacote(
        pacoteData.frigorificoNome,
        "pdf"
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setFeedbackPacote("Download do PDF do pacote iniciado!");
    } catch (err) {
      setErroPacote((err as Error).message);
    }
  };

  const handleBaixarImagemPacote = () => {
    if (!pacotePngBlob || !pacoteData) return;
    const url = URL.createObjectURL(pacotePngBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = gerarNomeArquivoPacote(pacoteData.frigorificoNome, "png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setFeedbackPacote("Download da imagem do pacote iniciado!");
  };

  const handleImprimirPacoteA4 = () => {
    if (!pacoteData) return;
    try {
      imprimirPacoteEmPapel(pacoteData);
      setFeedbackPacote("Janela de impressão A4 aberta!");
    } catch (err) {
      setErroPacote((err as Error).message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* Topo da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pedidos Comerciais
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Consulte, filtre e agrupe pedidos em pacotes para envio ao frigorífico
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
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
                {vendedorId
                  ? "Todos os Clientes deste Vendedor"
                  : "Todos os Clientes"}
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
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Aplicar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Somatório de Vendas Conforme Seção 8 */}
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
            Valores estimados negociados pela representação &bull; Pedidos em
            rascunho e cancelados não integram este total.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-emerald-700 font-bold">
              {resumo.qtdConfirmados}
            </span>{" "}
            confirmados
          </div>
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-amber-700 font-bold">
              {resumo.qtdRascunhos}
            </span>{" "}
            rascunhos
          </div>
          <div className="bg-white/80 border border-blue-200 px-3 py-2 rounded-xl text-slate-700">
            <span className="text-red-700 font-bold">
              {resumo.qtdCancelados}
            </span>{" "}
            cancelados
          </div>
        </div>
      </div>

      {/* Aviso de Regra de Frigorífico Único */}
      {avisoSelecao && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{avisoSelecao}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvisoSelecao(null)}
            className="text-amber-600 hover:text-amber-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Listagem de Pedidos */}
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
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={selecionarTodosVisiveis}
                        className="text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        title={
                          selecionados.size === pedidos.length
                            ? "Desmarcar todos"
                            : "Selecionar todos"
                        }
                      >
                        {selecionados.size > 0 &&
                        selecionados.size === pedidos.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">Número</th>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Frigorífico</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Vendedor</th>
                    <th className="py-3 px-3 text-right">Peso (kg)</th>
                    <th className="py-3 px-3 text-right">Total Estimado</th>
                    <th className="py-3 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pedidos.map((p) => {
                    const isChecked = selecionados.has(p.id);
                    const bloqueadoStatus = p.status !== "CONFIRMADO";
                    const bloqueadoOutroFrig = Boolean(
                      frigorificoSelecionado &&
                        p.frigorifico.id !== frigorificoSelecionado.id
                    );
                    const bloqueado = bloqueadoStatus || bloqueadoOutroFrig;
                    const statusClass =
                      p.status === "CONFIRMADO"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : p.status === "RASCUNHO"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200";

                    return (
                      <tr
                        key={p.id}
                        className={`transition ${
                          isChecked
                            ? "bg-blue-50/70"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelecionarPedido(p)}
                            title={
                              bloqueadoStatus
                                ? `Bloqueado: apenas pedidos CONFIRMADOS podem entrar no pacote`
                                : bloqueadoOutroFrig
                                ? `Bloqueado: o resumo atual é apenas para o frigorífico ${frigorificoSelecionado?.nomeFantasia}`
                                : isChecked
                                ? "Desmarcar pedido"
                                : "Selecionar pedido para o pacote"
                            }
                            className={`${
                              bloqueado
                                ? "text-slate-300 opacity-50 cursor-not-allowed"
                                : "text-slate-400 hover:text-slate-700 cursor-pointer"
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-900">
                          {p.numero}
                        </td>
                        <td className="py-3.5 px-3 text-slate-500">
                          {new Date(p.dataCriacao).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider ${statusClass}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800">
                          {p.frigorifico.nomeFantasia}
                        </td>
                        <td className="py-3.5 px-3">
                          {p.cliente.nomeFantasia ||
                            p.cliente.razaoSocialOuNome}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          {p.vendedor.nome}
                        </td>
                        <td className="py-3.5 px-3 text-right text-slate-500">
                          {p.pesoInformadoKg
                            ? formatQuantity(p.pesoInformadoKg, "kg")
                            : "-"}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(p.totalEstimado)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/pedidos/${p.id}?share=1`}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-semibold transition"
                              title="Gerar print para compartilhar no WhatsApp"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Print</span>
                            </Link>
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

            {/* Visualização Mobile (Cards) */}
            <div className="md:hidden divide-y divide-slate-100">
              {pedidos.map((p) => {
                const isChecked = selecionados.has(p.id);
                const bloqueadoStatus = p.status !== "CONFIRMADO";
                const bloqueadoOutroFrig = Boolean(
                  frigorificoSelecionado &&
                    p.frigorifico.id !== frigorificoSelecionado.id
                );
                const bloqueado = bloqueadoStatus || bloqueadoOutroFrig;
                const statusClass =
                  p.status === "CONFIRMADO"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : p.status === "RASCUNHO"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200";

                return (
                  <div
                    key={p.id}
                    className={`p-4 transition space-y-2.5 ${
                      isChecked
                        ? "bg-blue-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSelecionarPedido(p)}
                          className={`p-1 ${
                            bloqueado
                              ? "text-slate-300 opacity-50 cursor-not-allowed"
                              : "text-slate-400 hover:text-slate-800"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <Link
                          href={`/pedidos/${p.id}`}
                          className="font-bold text-sm text-slate-900 hover:underline"
                        >
                          {p.numero}
                        </Link>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5 pl-8">
                      <div>
                        Cliente:{" "}
                        <span className="font-semibold text-slate-800">
                          {p.cliente.nomeFantasia ||
                            p.cliente.razaoSocialOuNome}
                        </span>
                      </div>
                      <div>
                        Frigorífico:{" "}
                        <span className="font-medium text-slate-700">
                          {p.frigorifico.nomeFantasia}
                        </span>
                      </div>
                      <div>
                        Vendedor:{" "}
                        <span className="text-slate-700">
                          {p.vendedor.nome}
                        </span>{" "}
                        &bull;{" "}
                        {new Date(p.dataCriacao).toLocaleDateString("pt-BR")}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs pl-8">
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
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Barra Flutuante de Ação em Lote (Pacote de Pedidos) */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-full px-4">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>
                    {totaisSelecionados.qtd}{" "}
                    {totaisSelecionados.qtd === 1
                      ? "pedido selecionado"
                      : "pedidos selecionados"}
                  </span>
                  {frigorificoSelecionado && (
                    <span className="text-[11px] font-semibold bg-blue-600/30 text-blue-200 border border-blue-500/40 px-2 py-0.5 rounded-md">
                      {frigorificoSelecionado.nomeFantasia}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {totaisSelecionados.peso > 0 ? (
                    <span>
                      Peso:{" "}
                      <strong className="text-white">
                        {formatQuantity(totaisSelecionados.peso, "kg")}
                      </strong>
                      {" • "}
                    </span>
                  ) : null}
                  Valor:{" "}
                  <strong className="text-slate-200">
                    {formatCurrency(totaisSelecionados.valor)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setSelecionados(new Set());
                  setAvisoSelecao(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={abrirModalPacote}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Gerar Resumo do Pacote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pacote de Pedidos Consolidado */}
      {modalPacoteAberto && pacoteData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pacote de Pedidos &bull; {pacoteData.frigorificoNome}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pacoteData.pedidos.length} pedidos agrupados &bull; Total:{" "}
                    <strong>{formatCurrency(pacoteData.totalGeralValor)}</strong>
                    {pacoteData.totalGeralPesoKg > 0 ? (
                      <span>
                        {" "}
                        &bull; Peso:{" "}
                        <strong>
                          {formatQuantity(pacoteData.totalGeralPesoKg, "kg")}
                        </strong>
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setModoPacoteVisualizacao("A4")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modoPacoteVisualizacao === "A4"
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Documento A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPacoteVisualizacao("TEXTO")}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      modoPacoteVisualizacao === "TEXTO"
                        ? "bg-white text-emerald-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Texto WhatsApp
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setModalPacoteAberto(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopiarTextoPacote}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copiar Texto (WhatsApp)</span>
              </button>

              <button
                type="button"
                disabled={gerandoPacotePrint}
                onClick={handleBaixarPdfPacote}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar PDF (A4)</span>
              </button>

              <button
                type="button"
                onClick={handleImprimirPacoteA4}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Imprimir Folha A4</span>
              </button>

              <button
                type="button"
                disabled={gerandoPacotePrint || !pacotePngBlob}
                onClick={handleCopiarImagemPacote}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>Copiar Print PNG</span>
              </button>
            </div>

            {/* Avisos */}
            {feedbackPacote && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedbackPacote}</span>
              </div>
            )}

            {erroPacote && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{erroPacote}</span>
              </div>
            )}

            {/* Pré-visualização */}
            <div className="flex-1 overflow-y-auto bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-center min-h-[300px]">
              {gerandoPacotePrint ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                  <RefreshCw className="w-7 h-7 text-slate-400 mx-auto animate-spin" />
                  <p className="font-semibold">
                    Consolidando pedidos e renderizando documento do pacote...
                  </p>
                </div>
              ) : modoPacoteVisualizacao === "TEXTO" ? (
                <div className="w-full h-full bg-white p-4 rounded-lg font-mono text-xs whitespace-pre-wrap text-slate-800 border border-slate-200 overflow-y-auto max-h-[460px]">
                  {gerarTextoWhatsAppPacote(pacoteData)}
                </div>
              ) : pacotePreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pacotePreviewUrl}
                  alt="Pré-visualização do Pacote de Pedidos"
                  className="max-w-full h-auto rounded-sm shadow-md border border-slate-300 bg-white"
                />
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Não foi possível exibir a pré-visualização.
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between pt-1 shrink-0 text-[11px] text-slate-400">
              <span>
                Dica: Você pode copiar o texto direto para o WhatsApp do
                frigorífico ou baixar o arquivo PDF formal.
              </span>
              <button
                type="button"
                onClick={() => setModalPacoteAberto(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
