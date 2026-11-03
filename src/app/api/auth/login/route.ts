import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { verifyPassword } from "@/lib/auth.ts";
import { setSessionCookie } from "@/lib/session.ts";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Informe usuário e senha." },
        { status: 400 }
      );
    }

    const operador = await prisma.operador.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (!operador) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, operador.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    await setSessionCookie({
      operadorId: operador.id,
      username: operador.username,
      nome: operador.nome,
    });

    return NextResponse.json({
      success: true,
      operador: {
        id: operador.id,
        username: operador.username,
        nome: operador.nome,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao autenticar." },
      { status: 500 }
    );
  }
}
