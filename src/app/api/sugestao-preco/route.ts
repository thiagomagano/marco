import { NextResponse } from "next/server";
import { getPriceSuggestion } from "@/lib/price-engine.ts";
import { requireAuth } from "@/lib/session.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("clienteId");
    const frigorificoId = searchParams.get("frigorificoId");
    const produtoId = searchParams.get("produtoId");

    if (!clienteId || !frigorificoId || !produtoId) {
      return NextResponse.json(
        { error: "Parâmetros clienteId, frigorificoId e produtoId são obrigatórios." },
        { status: 400 }
      );
    }

    const suggestion = await getPriceSuggestion({
      clienteId,
      frigorificoId,
      produtoId,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar sugestão de preço." },
      { status: 401 }
    );
  }
}
