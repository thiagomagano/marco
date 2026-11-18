import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session.ts";
import { prisma } from "@/lib/db.ts";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";
import {
  getPeriodoPresetDates,
  formatYmdBr,
  formatYmdShortBr,
  formatMonthYearSaoPaulo,
} from "@/lib/date-utils.ts";
import { getPedidoDataReferenciaMs } from "@/lib/pedido-filtros.ts";
import {
  TrendingUp,
  FileCheck,
  FileEdit,
  PlusCircle,
  ArrowRight,
  Scale,
  CalendarDays,
  CalendarRange,
  Calendar,
  Layers,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const agora = new Date();
  const hoje = getPeriodoPresetDates("HOJE", agora);
  const semana = getPeriodoPresetDates("SEMANA", agora);
  const mes = getPeriodoPresetDates("MES", agora);
  const mesAnoLabel = formatMonthYearSaoPaulo(agora);

  const [
    aggHoje,
    aggSemana,
    aggMes,
    aggTotal,
    qtdRascunhos,
    qtdCanceladosHoje,
    qtdClientes,
    qtdFrigorificos,
    pedidosDoDiaBrutos,
  ] = await Promise.all([
    prisma.pedido.aggregate({
      _sum: { totalEstimado: true, pesoInformadoKg: true },
      _count: { _all: true },
      where: {
        status: "CONFIRMADO",
        dataConfirmacao: { gte: hoje.inicio, lte: hoje.fim },
      },
    }),
    prisma.pedido.aggregate({
      _sum: { totalEstimado: true, pesoInformadoKg: true },
      _count: { _all: true },
      where: {
        status: "CONFIRMADO",
        dataConfirmacao: { gte: semana.inicio, lte: semana.fim },
      },
    }),
    prisma.pedido.aggregate({
      _sum: { totalEstimado: true, pesoInformadoKg: true },
      _count: { _all: true },
      where: {
        status: "CONFIRMADO",
        dataConfirmacao: { gte: mes.inicio, lte: mes.fim },
      },
    }),
    prisma.pedido.aggregate({
      _sum: { totalEstimado: true, pesoInformadoKg: true },
      _count: { _all: true },
      where: { status: "CONFIRMADO" },
    }),
    prisma.pedido.count({ where: { status: "RASCUNHO" } }),
    prisma.pedido.count({
      where: {
        status: "CANCELADO",
        dataCriacao: { gte: hoje.inicio, lte: hoje.fim },
      },
    }),
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.frigorifico.count({ where: { ativo: true } }),
    prisma.pedido.findMany({
      where: {
        OR: [
          {
            status: "CONFIRMADO",
            dataConfirmacao: { gte: hoje.inicio, lte: hoje.fim },
          },
          {
            status: { not: "CONFIRMADO" },
            dataCriacao: { gte: hoje.inicio, lte: hoje.fim },
          },
        ],
      },
      take: 12,
      orderBy: { dataCriacao: "desc" },
      include: {
        frigorifico: { select: { nomeFantasia: true } },
        cliente: { select: { razaoSocialOuNome: true, nomeFantasia: true } },
        vendedor: { select: { nome: true } },
        itens: { select: { id: true } },
      },
    }),
  ]);

  const pedidosDoDia = [...pedidosDoDiaBrutos].sort(
    (a, b) => getPedidoDataReferenciaMs(b) - getPedidoDataReferenciaMs(a)
  );

  const vendasHoje = aggHoje._sum.totalEstimado || 0;
  const pesoHojeKg = aggHoje._sum.pesoInformadoKg || 0;
  const qtdConfirmadosHoje = aggHoje._count._all;

  const comparativosPeriodo = [
    {
      id: "hoje",
      titulo: "Hoje (Dia Atual)",
      subtitulo: formatYmdBr(hoje.inicioStr),
      valor: vendasHoje,
      pesoKg: pesoHojeKg,
      qtdPedidos: qtdConfirmadosHoje,
      href: "/pedidos?periodo=HOJE&status=CONFIRMADO",
      icon: Calendar,
      corIcon: "bg-blue-50 text-blue-600",
      destaqueBorda: "border-blue-200 bg-blue-50/30",
      rodapeExtra: null as string | null,
    },
    {
      id: "semana",
      titulo: "Esta Semana",
      subtitulo: `${formatYmdShortBr(semana.inicioStr)} – ${formatYmdShortBr(
        semana.fimStr
      )} (segunda a hoje)`,
      valor: aggSemana._sum.totalEstimado || 0,
      pesoKg: aggSemana._sum.pesoInformadoKg || 0,
      qtdPedidos: aggSemana._count._all,
      href: "/pedidos?periodo=SEMANA&status=CONFIRMADO",
      icon: CalendarDays,
      corIcon: "bg-indigo-50 text-indigo-600",
      destaqueBorda: "border-slate-200 bg-white",
      rodapeExtra: null as string | null,
    },
    {
      id: "mes",
      titulo: "Este Mês",
      subtitulo:
        mesAnoLabel.charAt(0).toUpperCase() + mesAnoLabel.slice(1),
      valor: aggMes._sum.totalEstimado || 0,
      pesoKg: aggMes._sum.pesoInformadoKg || 0,
      qtdPedidos: aggMes._count._all,
      href: "/pedidos?periodo=MES&status=CONFIRMADO",
      icon: CalendarRange,
      corIcon: "bg-emerald-50 text-emerald-600",
      destaqueBorda: "border-slate-200 bg-white",
      rodapeExtra: null as string | null,
    },
    {
      id: "total",
      titulo: "Total Geral",
      subtitulo: "Acumulado histórico confirmado",
      valor: aggTotal._sum.totalEstimado || 0,
      pesoKg: aggTotal._sum.pesoInformadoKg || 0,
      qtdPedidos: aggTotal._count._all,
      href: "/pedidos?periodo=TODOS&status=CONFIRMADO",
      icon: Layers,
      corIcon: "bg-purple-50 text-purple-600",
      destaqueBorda: "border-slate-200 bg-white",
      rodapeExtra: `${qtdClientes} clientes • ${qtdFrigorificos} frigoríficos ativos`,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Cabeçalho com saudação e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Olá, {session.nome} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hoje é{" "}
            <span className="font-semibold text-slate-700">
              {formatYmdBr(hoje.inicioStr)}
            </span>{" "}
            &bull; Acompanhe o movimento do dia e os acumulados da representação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition"
          >
            <span>Pedidos de Hoje</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pedidos/novo"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Criar Novo Pedido</span>
          </Link>
        </div>
      </div>

      {/* Bloco 1: Indicadores do Dia Atual (Hoje) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Resumo Operacional de Hoje ({formatYmdBr(hoje.inicioStr)})
          </h2>
          <span className="text-[11px] text-slate-400">
            Baseado na data de confirmação
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vendas Hoje */}
          <Link
            href="/pedidos?periodo=HOJE&status=CONFIRMADO"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Vendas Hoje</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(vendasHoje)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Confirmadas no dia atual
              </div>
            </div>
          </Link>

          {/* Qtd Vendida Hoje (kg) */}
          <Link
            href="/pedidos?periodo=HOJE&status=CONFIRMADO"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Qtd. Vendida Hoje</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {formatQuantity(pesoHojeKg, "kg")}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Peso total confirmado hoje
              </div>
            </div>
          </Link>

          {/* Pedidos Confirmados Hoje */}
          <Link
            href="/pedidos?periodo=HOJE&status=CONFIRMADO"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Pedidos Hoje</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {qtdConfirmadosHoje}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {qtdCanceladosHoje > 0
                  ? `Confirmados • ${qtdCanceladosHoje} cancelado(s) hoje`
                  : "Confirmados no dia de hoje"}
              </div>
            </div>
          </Link>

          {/* Rascunhos em Aberto (geral, para não perder pendências) */}
          <Link
            href="/pedidos?periodo=TODOS&status=RASCUNHO"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-amber-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Rascunhos em Aberto</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileEdit className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {qtdRascunhos}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Aguardando confirmação (todos os dias)
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Bloco 2: Comparativo Periódico (Dia / Semana / Mês / Total) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Visão por Período (Vendas Confirmadas)
          </h2>
          <span className="text-[11px] text-slate-400">
            Clique em um card para abrir os pedidos do período
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparativosPeriodo.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                href={card.href}
                className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-sm transition group ${card.destaqueBorda}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {card.titulo}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {card.subtitulo}
                      </div>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.corIcon}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-4 text-xl font-extrabold text-slate-900">
                    {formatCurrency(card.valor)}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      <strong className="text-slate-900">
                        {card.qtdPedidos}
                      </strong>{" "}
                      {card.qtdPedidos === 1 ? "pedido" : "pedidos"}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatQuantity(card.pesoKg, "kg")}
                    </span>
                  </div>
                  {card.rodapeExtra && (
                    <div className="text-[11px] text-slate-400 pt-0.5">
                      {card.rodapeExtra}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bloco 3: Movimentação de Hoje */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pedidos de Hoje ({formatYmdBr(hoje.inicioStr)})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pedidos confirmados hoje ou rascunhos/cancelamentos registrados no
              dia
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/pedidos?periodo=TODOS"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Ver histórico completo
            </Link>
            <Link
              href="/pedidos"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Filtrar pedidos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {pedidosDoDia.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-slate-500 text-sm">
              Nenhum pedido confirmado ou registrado hoje ainda.
            </p>
            <div className="flex items-center justify-center gap-3 text-xs font-semibold">
              <Link
                href="/pedidos/novo"
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Criar Novo Pedido
              </Link>
              <Link
                href="/pedidos?periodo=TODOS"
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Ver pedidos de outros dias
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pedidosDoDia.map((pedido) => {
              const statusBadge =
                pedido.status === "CONFIRMADO"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : pedido.status === "RASCUNHO"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200";

              return (
                <Link
                  key={pedido.id}
                  href={`/pedidos/${pedido.id}`}
                  className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${statusBadge}`}
                    >
                      {pedido.status}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        {pedido.numero} &bull;{" "}
                        {pedido.cliente.nomeFantasia ||
                          pedido.cliente.razaoSocialOuNome}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Frigorífico:{" "}
                        <span className="font-medium text-slate-700">
                          {pedido.frigorifico.nomeFantasia}
                        </span>{" "}
                        &bull; Vendedor: {pedido.vendedor.nome} &bull;{" "}
                        {pedido.itens.length}{" "}
                        {pedido.itens.length === 1 ? "item" : "itens"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {formatCurrency(pedido.totalEstimado)}
                      </div>
                      {pedido.pesoInformadoKg ? (
                        <div className="text-[11px] text-slate-500">
                          {formatQuantity(pedido.pesoInformadoKg, "kg")}{" "}
                          informados
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
