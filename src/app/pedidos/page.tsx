"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
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
  ClipboardList,
  AlertTriangle,
  Scale,
  Calendar,
  X,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";
import {
  getPeriodoPresetDates,
  getSaoPauloDateString,
  formatDateSaoPauloBr,
  formatYmdBr,
  isValidYmd,
  type PeriodoPreset,
} from "@/lib/date-utils.ts";
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
import {
  ResumoProducaoData,
  compilarDadosResumoProducao,
  gerarTextoWhatsAppProducao,
  gerarNomeArquivoProducao,
  gerarImagemPrintProducao,
  gerarArquivoPdfProducao,
  imprimirResumoProducaoEmPapel,
  renderizarPaginasA4ProducaoCanvas,
} from "@/lib/pacote-producao.ts";
import { PacoteExportModal } from "@/components/pedidos/PacoteExportModal.tsx";
import {
  ClienteCombobox,
  type ClienteResumo,
} from "@/components/clientes/ClienteCombobox.tsx";

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
    inscricaoEstadual?: string | null;
    prazoPagamentoBoleto?: string | null;
    telefone?: string | null;
    email?: string | null;
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
  totalPesoKgConfirmado: number;
  qtdTotal: number;
  qtdConfirmados: number;
  qtdRascunhos: number;
  qtdCancelados: number;
  qtdRascunhosAnteriores: number;
}

const RESUMO_VAZIO: ResumoFiltro = {
  totalVendasConfirmadas: 0,
  totalPesoKgConfirmado: 0,
  qtdTotal: 0,
  qtdConfirmados: 0,
  qtdRascunhos: 0,
  qtdCancelados: 0,
  qtdRascunhosAnteriores: 0,
};

function resolverFiltrosDaUrl(searchParams: ReadonlyURLSearchParams): {
  dataInicio: string;
  dataFim: string;
  status: string;
} {
  const periodoParam = searchParams.get("periodo")?.toUpperCase();
  const statusParam = searchParams.get("status")?.toUpperCase();
  const dataInicioParam = searchParams.get("dataInicio");
  const dataFimParam = searchParams.get("dataFim");

  const statusInicial =
    statusParam &&
    ["TODOS", "CONFIRMADO", "RASCUNHO", "CANCELADO"].includes(statusParam)
      ? statusParam
      : "TODOS";

  if (periodoParam === "TODOS") {
    return { dataInicio: "", dataFim: "", status: statusInicial };
  }

  if (
    periodoParam === "HOJE" ||
    periodoParam === "ONTEM" ||
    periodoParam === "SEMANA" ||
    periodoParam === "MES"
  ) {
    const range = getPeriodoPresetDates(periodoParam);
    return {
      dataInicio: range.inicioStr,
      dataFim: range.fimStr,
      status: statusInicial,
    };
  }

  if (dataInicioParam || dataFimParam) {
    return {
      dataInicio: isValidYmd(dataInicioParam) ? dataInicioParam : "",
      dataFim: isValidYmd(dataFimParam) ? dataFimParam : "",
      status: statusInicial,
    };
  }

  const hoje = getPeriodoPresetDates("HOJE");
  return {
    dataInicio: hoje.inicioStr,
    dataFim: hoje.fimStr,
    status: statusInicial,
  };
}

function formatarDataPedidoExibicao(p: PedidoListItem): {
  principal: string;
  criadoEmDiferente: string | null;
} {
  const isConfirmado = p.status === "CONFIRMADO" && Boolean(p.dataConfirmacao);
  const dataPrincipal = isConfirmado ? p.dataConfirmacao! : p.dataCriacao;
  const principal = formatDateSaoPauloBr(dataPrincipal);
  if (isConfirmado && p.dataConfirmacao) {
    const ymdConf = getSaoPauloDateString(new Date(p.dataConfirmacao));
    const ymdCria = getSaoPauloDateString(new Date(p.dataCriacao));
    if (ymdConf !== ymdCria) {
      return {
        principal,
        criadoEmDiferente: formatDateSaoPauloBr(p.dataCriacao),
      };
    }
  }
  return { principal, criadoEmDiferente: null };
}

function PedidosPageContent({
  filtrosIniciais,
}: {
  filtrosIniciais: { dataInicio: string; dataFim: string; status: string };
}) {
  const [pedidos, setPedidos] = useState<PedidoListItem[]>([]);
  const [resumo, setResumo] = useState<ResumoFiltro>(RESUMO_VAZIO);
  const [loading, setLoading] = useState(true);

  // Seleção múltipla para pacote de pedidos (restrito a 1 frigorífico por pacote)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [avisoSelecao, setAvisoSelecao] = useState<string | null>(null);

  // Modal de Exportação (Pacote de Pedidos ou Resumo de Produção)
  const [modalExportTipo, setModalExportTipo] = useState<
    "PACOTE" | "PRODUCAO" | null
  >(null);
  const [pacoteData, setPacoteData] = useState<PacotePedidosData | null>(null);
  const [producaoData, setProducaoData] = useState<ResumoProducaoData | null>(
    null
  );
  const [gerandoExport, setGerandoExport] = useState(false);
  const [exportPreviewUrls, setExportPreviewUrls] = useState<string[]>([]);
  const [exportPngBlob, setExportPngBlob] = useState<Blob | null>(null);
  const [exportPdfBlob, setExportPdfBlob] = useState<Blob | null>(null);
  const [erroExport, setErroExport] = useState<string | null>(null);

  // Filtros (inicia automaticamente no dia atual, salvo parâmetro explícito na URL)
  const [termo, setTermo] = useState("");
  const [dataInicio, setDataInicio] = useState(filtrosIniciais.dataInicio);
  const [dataFim, setDataFim] = useState(filtrosIniciais.dataFim);
  const [frigorificoId, setFrigorificoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [status, setStatus] = useState(filtrosIniciais.status);

  // Listas auxiliares para os selects de filtro
  const [frigorificos, setFrigorificos] = useState<
    Array<{ id: string; nomeFantasia: string }>
  >([]);
  const [selectedClienteFiltro, setSelectedClienteFiltro] =
    useState<ClienteResumo | null>(null);
  const [vendedores, setVendedores] = useState<
    Array<{ id: string; nome: string }>
  >([]);

  // Carrega opções dos filtros (sem carregar os milhares de clientes antecipadamente)
  useEffect(() => {
    async function carregarAuxiliares() {
      try {
        const [fRes, vRes] = await Promise.all([
          fetch("/api/frigorificos"),
          fetch("/api/vendedores"),
        ]);
        if (fRes.ok) setFrigorificos(await fRes.json());
        if (vRes.ok) setVendedores(await vRes.json());
      } catch (e) {
        console.error("Erro ao carregar filtros auxiliares:", e);
      }
    }
    carregarAuxiliares();
  }, []);

  const [refreshTick, setRefreshTick] = useState(0);

  const queryStringPedidos = useMemo(() => {
    const params = new URLSearchParams();
    if (termo) params.set("termo", termo);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (frigorificoId) params.set("frigorificoId", frigorificoId);
    if (clienteId) params.set("clienteId", clienteId);
    if (vendedorId) params.set("vendedorId", vendedorId);
    if (status && status !== "TODOS") params.set("status", status);
    return params.toString();
  }, [termo, dataInicio, dataFim, frigorificoId, clienteId, vendedorId, status]);

  useEffect(() => {
    let cancelado = false;
    async function carregarPedidos() {
      await Promise.resolve();
      if (cancelado) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/pedidos?${queryStringPedidos}`);
        if (res.ok && !cancelado) {
          const data = await res.json();
          setPedidos(data.pedidos || []);
          setResumo(data.resumo || RESUMO_VAZIO);
        }
      } catch (e) {
        if (!cancelado) {
          console.error("Erro ao buscar pedidos:", e);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    }
    carregarPedidos();
    return () => {
      cancelado = true;
    };
  }, [queryStringPedidos, refreshTick]);

  const aplicarPeriodoPreset = (preset: PeriodoPreset | "TODOS") => {
    if (preset === "TODOS") {
      setDataInicio("");
      setDataFim("");
      return;
    }
    const range = getPeriodoPresetDates(preset);
    setDataInicio(range.inicioStr);
    setDataFim(range.fimStr);
  };

  const presetAtivo = useMemo((): PeriodoPreset | "TODOS" | "PERSONALIZADO" => {
    if (!dataInicio && !dataFim) return "TODOS";
    const presets: PeriodoPreset[] = ["HOJE", "ONTEM", "SEMANA", "MES"];
    for (const p of presets) {
      const r = getPeriodoPresetDates(p);
      if (dataInicio === r.inicioStr && dataFim === r.fimStr) {
        return p;
      }
    }
    return "PERSONALIZADO";
  }, [dataInicio, dataFim]);

  const descricaoPeriodoAtivo = useMemo(() => {
    if (presetAtivo === "HOJE") return `Hoje (${formatYmdBr(dataInicio)})`;
    if (presetAtivo === "ONTEM") return `Ontem (${formatYmdBr(dataInicio)})`;
    if (presetAtivo === "SEMANA") {
      return `Esta semana (${formatYmdBr(dataInicio)} até ${formatYmdBr(dataFim)})`;
    }
    if (presetAtivo === "MES") {
      return `Este mês (${formatYmdBr(dataInicio)} até ${formatYmdBr(dataFim)})`;
    }
    if (presetAtivo === "TODOS") return "Todo o período";
    if (dataInicio && dataFim) {
      return `${formatYmdBr(dataInicio)} até ${formatYmdBr(dataFim)}`;
    }
    if (dataInicio) return `A partir de ${formatYmdBr(dataInicio)}`;
    if (dataFim) return `Até ${formatYmdBr(dataFim)}`;
    return "Personalizado";
  }, [presetAtivo, dataInicio, dataFim]);

  const limparFiltros = () => {
    const hoje = getPeriodoPresetDates("HOJE");
    setTermo("");
    setDataInicio(hoje.inicioStr);
    setDataFim(hoje.fimStr);
    setFrigorificoId("");
    setClienteId("");
    setSelectedClienteFiltro(null);
    setVendedorId("");
    setStatus("TODOS");
  };

  const verRascunhosAnteriores = () => {
    setTermo("");
    setDataInicio("");
    setDataFim("");
    setStatus("RASCUNHO");
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

  // Abertura do Modal de Exportação (Pacote ou Resumo de Produção)
  const abrirModalExport = async (tipo: "PACOTE" | "PRODUCAO") => {
    if (pedidosSelecionadosLista.length === 0) return;
    setErroExport(null);
    setExportPreviewUrls([]);
    setExportPngBlob(null);
    setExportPdfBlob(null);
    setPacoteData(null);
    setProducaoData(null);
    setGerandoExport(true);
    setModalExportTipo(tipo);

    try {
      const pedidosShare =
        pedidosSelecionadosLista as unknown as PedidoShareData[];

      if (tipo === "PACOTE") {
        const data = compilarDadosPacote(pedidosShare);
        setPacoteData(data);

        const [pagesCanvas, pngBlob, pdfBlob] = await Promise.all([
          renderizarPaginasA4PacoteCanvas(data),
          gerarImagemPrintPacote(data),
          gerarArquivoPdfPacote(data),
        ]);

        setExportPngBlob(pngBlob);
        setExportPdfBlob(pdfBlob);
        setExportPreviewUrls(pagesCanvas.map((c) => c.toDataURL("image/png")));
      } else {
        const data = compilarDadosResumoProducao(pedidosShare);
        setProducaoData(data);

        const [pagesCanvas, pngBlob, pdfBlob] = await Promise.all([
          renderizarPaginasA4ProducaoCanvas(data),
          gerarImagemPrintProducao(data),
          gerarArquivoPdfProducao(data),
        ]);

        setExportPngBlob(pngBlob);
        setExportPdfBlob(pdfBlob);
        setExportPreviewUrls(pagesCanvas.map((c) => c.toDataURL("image/png")));
      }
    } catch (err) {
      setErroExport(
        (err as Error).message || "Erro ao processar resumo dos pedidos."
      );
    } finally {
      setGerandoExport(false);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filtros de Pesquisa</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>
            {(
              [
                { id: "HOJE", label: "Hoje" },
                { id: "ONTEM", label: "Ontem" },
                { id: "SEMANA", label: "Esta Semana" },
                { id: "MES", label: "Este Mês" },
                { id: "TODOS", label: "Todo o Período" },
              ] as const
            ).map((opt) => {
              const ativo = presetAtivo === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => aplicarPeriodoPreset(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    ativo
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={limparFiltros}
              className="ml-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Restaura filtros e volta para o dia de hoje"
            >
              Resetar (Hoje)
            </button>
          </div>
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
                if (
                  clienteId &&
                  novoVend &&
                  selectedClienteFiltro?.vendedorId &&
                  selectedClienteFiltro.vendedorId !== novoVend
                ) {
                  setClienteId("");
                  setSelectedClienteFiltro(null);
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
            <ClienteCombobox
              size="sm"
              ativosOnly={false}
              vendedorId={vendedorId}
              value={clienteId}
              selectedCliente={selectedClienteFiltro}
              emptyOptionLabel={
                vendedorId
                  ? "Todos os Clientes deste Vendedor"
                  : "Todos os Clientes"
              }
              placeholder="Buscar cliente..."
              onChange={(c) => {
                setSelectedClienteFiltro(c);
                setClienteId(c?.id || "");
              }}
            />
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
              type="button"
              onClick={() => setRefreshTick((n) => n + 1)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Atualizar Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Somatório de Vendas e Quantidade Vendida no Período */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <div className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Vendas Confirmadas &bull; {descricaoPeriodoAtivo}</span>
            </div>
            <div className="text-3xl font-extrabold text-blue-950 mt-1">
              {formatCurrency(resumo.totalVendasConfirmadas)}
            </div>
            <p className="text-xs text-blue-700 mt-0.5">
              Filtrado por data de confirmação &bull; Rascunhos e cancelados não
              integram este total.
            </p>
          </div>

          <div className="sm:border-l sm:border-blue-200 sm:pl-6">
            <div className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Qtd. Vendida (kg)</span>
            </div>
            <div className="text-2xl font-extrabold text-blue-950 mt-1">
              {formatQuantity(resumo.totalPesoKgConfirmado, "kg")}
            </div>
            <p className="text-xs text-blue-700 mt-0.5">
              Peso confirmado no filtro atual
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
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

      {/* Aviso de Rascunhos Pendentes de Dias Anteriores */}
      {resumo.qtdRascunhosAnteriores > 0 &&
        (dataInicio || dataFim) &&
        status !== "RASCUNHO" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Você tem{" "}
                <strong>
                  {resumo.qtdRascunhosAnteriores}{" "}
                  {resumo.qtdRascunhosAnteriores === 1
                    ? "rascunho em aberto"
                    : "rascunhos em aberto"}
                </strong>{" "}
                de dias anteriores aguardando confirmação.
              </span>
            </div>
            <button
              type="button"
              onClick={verRascunhosAnteriores}
              className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shrink-0"
            >
              Ver rascunhos pendentes
            </button>
          </div>
        )}

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
                          {(() => {
                            const dt = formatarDataPedidoExibicao(p);
                            return (
                              <div>
                                <div>{dt.principal}</div>
                                {dt.criadoEmDiferente && (
                                  <div className="text-[10px] text-slate-400">
                                    Criado {dt.criadoEmDiferente}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
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
                        {(() => {
                          const dt = formatarDataPedidoExibicao(p);
                          return dt.criadoEmDiferente
                            ? `${dt.principal} (criado ${dt.criadoEmDiferente})`
                            : dt.principal;
                        })()}
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

      {/* Barra Flutuante de Ação em Lote (Pacote de Pedidos / Produção) */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-full px-4">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
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

            <div className="flex items-center flex-wrap gap-2 self-end sm:self-auto">
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
                onClick={() => abrirModalExport("PRODUCAO")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Resumo Produção</span>
              </button>
              <button
                type="button"
                onClick={() => abrirModalExport("PACOTE")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Gerar Resumo do Pacote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consolidado (Pacote de Pedidos ou Resumo de Produção) */}
      {modalExportTipo !== null && (
        <PacoteExportModal
          key={modalExportTipo}
          open={true}
          onClose={() => setModalExportTipo(null)}
          tipo={modalExportTipo}
        titulo={
          modalExportTipo === "PRODUCAO"
            ? `Resumo de Produção • ${
                producaoData?.frigorificoNome ||
                frigorificoSelecionado?.nomeFantasia ||
                ""
              }`
            : `Pacote de Pedidos • ${
                pacoteData?.frigorificoNome ||
                frigorificoSelecionado?.nomeFantasia ||
                ""
              }`
        }
        subtitulo={
          modalExportTipo === "PRODUCAO" && producaoData ? (
            <>
              {producaoData.totalPedidos}{" "}
              {producaoData.totalPedidos === 1 ? "pedido" : "pedidos"} &bull;{" "}
              {producaoData.itens.length}{" "}
              {producaoData.itens.length === 1 ? "produto" : "produtos"} &bull;
              Peso Total:{" "}
              <strong>
                {formatQuantity(producaoData.totalPesoKg, "kg")}
              </strong>
            </>
          ) : pacoteData ? (
            <>
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
            </>
          ) : (
            "Processando dados..."
          )
        }
        dicaRodape={
          modalExportTipo === "PRODUCAO"
            ? "Dica: Relatório consolidado sem valores financeiros, ideal para envio à produção e separação."
            : "Dica: Você pode copiar o texto direto para o WhatsApp do frigorífico ou baixar o arquivo PDF formal."
        }
        loading={gerandoExport}
        erroGeracao={erroExport}
        textoWhatsApp={
          modalExportTipo === "PRODUCAO" && producaoData
            ? gerarTextoWhatsAppProducao(producaoData)
            : pacoteData
            ? gerarTextoWhatsAppPacote(pacoteData)
            : ""
        }
        previewUrls={exportPreviewUrls}
        pngBlob={exportPngBlob}
        pdfBlob={exportPdfBlob}
        nomeArquivoPdf={
          modalExportTipo === "PRODUCAO" && producaoData
            ? gerarNomeArquivoProducao(producaoData.frigorificoNome, "pdf")
            : pacoteData
            ? gerarNomeArquivoPacote(pacoteData.frigorificoNome, "pdf")
            : "relatorio.pdf"
        }
        nomeArquivoPng={
          modalExportTipo === "PRODUCAO" && producaoData
            ? gerarNomeArquivoProducao(producaoData.frigorificoNome, "png")
            : pacoteData
            ? gerarNomeArquivoPacote(pacoteData.frigorificoNome, "png")
            : "relatorio.png"
        }
          onImprimirA4={() => {
            if (modalExportTipo === "PRODUCAO" && producaoData) {
              imprimirResumoProducaoEmPapel(producaoData);
            } else if (pacoteData) {
              imprimirPacoteEmPapel(pacoteData);
            }
          }}
        />
      )}
    </div>
  );
}

function PedidosPageWithParams() {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const filtrosIniciais = resolverFiltrosDaUrl(searchParams);
  return (
    <PedidosPageContent
      key={searchParamsString || "default"}
      filtrosIniciais={filtrosIniciais}
    />
  );
}

export default function PedidosPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-slate-500 text-sm">
          Carregando pedidos...
        </div>
      }
    >
      <PedidosPageWithParams />
    </Suspense>
  );
}
