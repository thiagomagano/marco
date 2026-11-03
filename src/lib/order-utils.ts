import { prisma } from "./db";

/**
 * Gera o próximo número sequencial de pedido.
 * Formato: PED-AAAA-XXXXX (Ex: PED-2026-00001)
 */
export async function generateNextOrderNumber(): Promise<{ numero: string; sequencial: number }> {
  const currentYear = new Date().getFullYear();

  // Busca o maior sequencial existente
  const lastOrder = await prisma.pedido.findFirst({
    orderBy: {
      numeroSequencial: "desc",
    },
    select: {
      numeroSequencial: true,
    },
  });

  const nextSeq = (lastOrder?.numeroSequencial || 0) + 1;
  const paddedSeq = String(nextSeq).padStart(5, "0");
  const numero = `PED-${currentYear}-${paddedSeq}`;

  return {
    numero,
    sequencial: nextSeq,
  };
}
