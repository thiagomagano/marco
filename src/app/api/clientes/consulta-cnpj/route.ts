import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session.ts";
import { BrasilApiError, consultarCnpjBrasilApi } from "@/lib/brasilapi-cnpj.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Não autenticado" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const cnpj = searchParams.get("cnpj");

    if (!cnpj || !cnpj.trim()) {
      return NextResponse.json(
        { error: "Informe o CNPJ para realizar a consulta." },
        { status: 400 }
      );
    }

    const resultado = await consultarCnpjBrasilApi(cnpj);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof BrasilApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao consultar CNPJ." },
      { status: 500 }
    );
  }
}
