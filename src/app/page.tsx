import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session.ts";
import { prisma } from "@/lib/db.ts";
import { formatCurrency, formatQuantity } from "@/lib/money.ts";
import {
  TrendingUp,
  FileCheck,
  FileEdit,
  Building2,
  Users,
  PlusCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Consulta indicadores e pedidos recentes de forma atômica
  const [
    pedidosConfirmadosAgg,
    qtdConfirmados,
    qtdRascunhos,
    qtdCancelados,
    qtdClientes,
    qtdFrigorificos,
    pedidosRecentes,
  ] = await Promise.all([
    prisma.pedido.aggregate({
      _sum: { totalEstimado: true },
      where: { status: "CONFIRMADO" },
    }),
    prisma.pedido.count({ where: { status: "CONFIRMADO" } }),
    prisma.pedido.count({ where: { status: "RASCUNHO" } }),
    prisma.pedido.count({ where: { status: "CANCELADO" } }),
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.frigorifico.count({ where: { ativo: true } }),
    prisma.pedido.findMany({
      take: 6,
      orderBy: { dataCriacao: "desc" },
      include: {
        frigorifico: { select: { nomeFantasia: true } },
        cliente: { select: { razaoSocialOuNome: true, nomeFantasia: true } },
        vendedor: { select: { nome: true } },
        itens: { select: { id: true } },
      },
    }),
  ]);

  const totalVendasConfirmadas = pedidosConfirmadosAgg._sum.totalEstimado || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Cabeçalho com saudação e Ação Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Olá, {session.nome} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Painel da representação comercial &bull; Registre e consulte negociações de vendas.
          </p>
        </div>
        <div>
          <Link
            href="/pedidos/novo"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Criar Novo Pedido</span>
          </Link>
        </div>
      </div>

      {/* Grid de Indicadores Principais (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em R$ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Vendas Confirmadas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalVendasConfirmadas)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Vendas registradas pela representação
            </div>
          </div>
        </div>

        {/* Quantidade Confirmados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Pedidos Confirmados</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {qtdConfirmados}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Negociações finalizadas
            </div>
          </div>
        </div>

        {/* Quantidade Rascunhos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
              Pedidos aguardando confirmação
            </div>
          </div>
        </div>

        {/* Frigoríficos e Clientes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Cadastros Ativos</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {qtdClientes} <span className="text-sm font-normal text-slate-500">clientes</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {qtdFrigorificos} frigoríficos representados
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Pedidos Recentes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pedidos Recentes</h2>
            <p className="text-xs text-slate-500 mt-0.5">Últimos registros comerciais realizados</p>
          </div>
          <Link
            href="/pedidos"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Ver todos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pedidosRecentes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Nenhum pedido registrado até o momento. Comece criando um novo pedido!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pedidosRecentes.map((pedido) => {
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
                        {pedido.numero} &bull; {pedido.cliente.nomeFantasia || pedido.cliente.razaoSocialOuNome}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Frigorífico: <span className="font-medium text-slate-700">{pedido.frigorifico.nomeFantasia}</span> &bull; Vendedor: {pedido.vendedor.nome} &bull; {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
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
                          {formatQuantity(pedido.pesoInformadoKg, "kg")} informados
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
