import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import {
  buildClienteWhere,
  rankClientesByQuery,
} from "@/lib/cliente-search.ts";
import { ensureClientesBuscaTextoBackfilled } from "@/lib/cliente-backfill.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    await requireAuth();
    await ensureClientesBuscaTextoBackfilled();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? searchParams.get("busca"))?.trim() || "";
    const vendedorId = searchParams.get("vendedorId")?.trim() || "";
    const ativosParam = searchParams.get("ativos");
    const ativos =
      ativosParam === "false"
        ? false
        : ativosParam === "todos" || ativosParam === "all"
        ? null
        : true;

    const limitRaw = Number.parseInt(
      searchParams.get("limit") || String(DEFAULT_LIMIT),
      10
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const where = buildClienteWhere({ busca: q, vendedorId, ativos });

    // Busca um lote ligeiramente maior quando há termo digitado para priorizar prefixos
    const fetchLimit = q ? Math.min(limit * 2, 60) : limit;

    const candidatos = await prisma.cliente.findMany({
      where,
      take: fetchLimit,
      orderBy: [{ razaoSocialOuNome: "asc" }, { id: "asc" }],
      select: {
        id: true,
        razaoSocialOuNome: true,
        nomeFantasia: true,
        cnpj: true,
        cidade: true,
        bairro: true,
        prazoPagamentoBoleto: true,
        ativo: true,
        vendedorId: true,
        vendedor: {
          select: { id: true, nome: true },
        },
      },
    });

    const clientes = q
      ? rankClientesByQuery(candidatos, q).slice(0, limit)
      : candidatos;

    return NextResponse.json({ clientes });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao buscar clientes." },
      { status: 500 }
    );
  }
}
