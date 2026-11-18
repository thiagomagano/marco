import { prisma } from "./db.ts";
import { buildClienteBuscaTexto } from "./cliente-search.ts";

let backfillDone = false;
let backfillPromise: Promise<number> | null = null;

/**
 * Preenche `buscaTexto` em lotes para clientes legados onde o campo ainda está nulo.
 */
export async function backfillClientesBuscaTexto(batchSize = 250): Promise<number> {
  let totalAtualizados = 0;

  while (true) {
    const pendentes = await prisma.cliente.findMany({
      where: { buscaTexto: null },
      take: batchSize,
      select: {
        id: true,
        razaoSocialOuNome: true,
        nomeFantasia: true,
        cnpjNormalized: true,
        cnpj: true,
        inscricaoEstadual: true,
        prazoPagamentoBoleto: true,
        cidade: true,
        bairro: true,
      },
    });

    if (pendentes.length === 0) {
      break;
    }

    await prisma.$transaction(
      pendentes.map((c) =>
        prisma.cliente.update({
          where: { id: c.id },
          data: { buscaTexto: buildClienteBuscaTexto(c) },
        })
      )
    );

    totalAtualizados += pendentes.length;
    if (pendentes.length < batchSize) {
      break;
    }
  }

  backfillDone = true;
  return totalAtualizados;
}

/**
 * Garante de forma preguiçosa e idempotente (1x por processo) que todos os clientes tenham `buscaTexto`.
 */
export async function ensureClientesBuscaTextoBackfilled(): Promise<void> {
  if (backfillDone) return;
  if (!backfillPromise) {
    backfillPromise = backfillClientesBuscaTexto().finally(() => {
      backfillPromise = null;
    });
  }
  await backfillPromise;
}

/**
 * Permite resetar o cache em memória (útil em testes após criar registros sem `buscaTexto`).
 */
export function resetClientesBackfillCache(): void {
  backfillDone = false;
}
