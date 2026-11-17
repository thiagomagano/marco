import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db.ts";

export interface DesativarClientesSemPedidosOptions {
  dryRun?: boolean;
  prismaClient?: PrismaClient;
  whereExtra?: Prisma.ClienteWhereInput;
}

export interface DesativarClientesSemPedidosResult {
  dryRun: boolean;
  totalClientes: number;
  ativosComPedidos: number;
  inativosComPedidos: number;
  jaInativosSemPedidos: number;
  paraDesativar: number;
  desativados: number;
}

function mergeWhere(
  base: Prisma.ClienteWhereInput,
  extra?: Prisma.ClienteWhereInput
): Prisma.ClienteWhereInput {
  if (!extra) return base;
  return { AND: [base, extra] };
}

/**
 * Desativa clientes que ainda não possuem nenhum pedido vinculado (independente do status do pedido).
 * Clientes que possuem ao menos um pedido permanecem com o status atual (ativos).
 */
export async function desativarClientesSemPedidos(
  options: DesativarClientesSemPedidosOptions = {}
): Promise<DesativarClientesSemPedidosResult> {
  const { dryRun = false, prismaClient = prisma, whereExtra } = options;

  const [
    totalClientes,
    ativosComPedidos,
    inativosComPedidos,
    jaInativosSemPedidos,
    paraDesativar,
  ] = await Promise.all([
    prismaClient.cliente.count({
      where: whereExtra,
    }),
    prismaClient.cliente.count({
      where: mergeWhere({ ativo: true, pedidos: { some: {} } }, whereExtra),
    }),
    prismaClient.cliente.count({
      where: mergeWhere({ ativo: false, pedidos: { some: {} } }, whereExtra),
    }),
    prismaClient.cliente.count({
      where: mergeWhere({ ativo: false, pedidos: { none: {} } }, whereExtra),
    }),
    prismaClient.cliente.count({
      where: mergeWhere({ ativo: true, pedidos: { none: {} } }, whereExtra),
    }),
  ]);

  let desativados = 0;

  if (!dryRun && paraDesativar > 0) {
    const updateResult = await prismaClient.cliente.updateMany({
      where: mergeWhere({ ativo: true, pedidos: { none: {} } }, whereExtra),
      data: { ativo: false },
    });
    desativados = updateResult.count;
  }

  return {
    dryRun,
    totalClientes,
    ativosComPedidos,
    inativosComPedidos,
    jaInativosSemPedidos,
    paraDesativar,
    desativados,
  };
}
