import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "@/lib/cnpj.ts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const frigorifico = await prisma.frigorifico.findUnique({ where: { id } });
    if (!frigorifico) {
      return NextResponse.json({ error: "Frigorífico não encontrado." }, { status: 404 });
    }

    let normalizedCnpj = frigorifico.cnpjNormalized;
    let formattedCnpj = frigorifico.cnpj;

    if (body.cnpj !== undefined) {
      if (body.cnpj && body.cnpj.trim()) {
        const norm = normalizeCnpj(body.cnpj);
        if (!isValidCnpj(norm)) {
          return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
        }
        // Checa se outro frigorífico tem esse CNPJ
        const duplicado = await prisma.frigorifico.findFirst({
          where: {
            cnpjNormalized: norm,
            id: { not: id },
          },
        });
        if (duplicado) {
          return NextResponse.json(
            { error: `CNPJ já cadastrado para o frigorífico ${duplicado.nomeFantasia}.` },
            { status: 400 }
          );
        }
        normalizedCnpj = norm;
        formattedCnpj = formatCnpj(norm);
      } else {
        normalizedCnpj = null;
        formattedCnpj = null;
      }
    }

    const atualizado = await prisma.frigorifico.update({
      where: { id },
      data: {
        nomeFantasia: body.nomeFantasia?.trim() ?? frigorifico.nomeFantasia,
        razaoSocial: body.razaoSocial !== undefined ? body.razaoSocial?.trim() || null : frigorifico.razaoSocial,
        cnpj: formattedCnpj,
        cnpjNormalized: normalizedCnpj,
        contato: body.contato !== undefined ? body.contato?.trim() || null : frigorifico.contato,
        telefone: body.telefone !== undefined ? body.telefone?.trim() || null : frigorifico.telefone,
        email: body.email !== undefined ? body.email?.trim() || null : frigorifico.email,
        observacoes: body.observacoes !== undefined ? body.observacoes?.trim() || null : frigorifico.observacoes,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : frigorifico.ativo,
      },
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao atualizar frigorífico." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    // Verifica se possui pedidos vinculados (Regra: exclusão física bloqueada se usado)
    const countPedidos = await prisma.pedido.count({ where: { frigorificoId: id } });
    if (countPedidos > 0) {
      return NextResponse.json(
        {
          error: `Este frigorífico possui ${countPedidos} pedido(s) associado(s) e não pode ser excluído fisicamente. Utilize a inativação.`,
        },
        { status: 400 }
      );
    }

    const countProdutos = await prisma.produto.count({ where: { frigorificoId: id } });
    if (countProdutos > 0) {
      return NextResponse.json(
        {
          error: `Este frigorífico possui ${countProdutos} produto(s) cadastrado(s). Inative o frigorífico em vez de excluí-lo.`,
        },
        { status: 400 }
      );
    }

    await prisma.frigorifico.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao excluir frigorífico." },
      { status: 500 }
    );
  }
}
