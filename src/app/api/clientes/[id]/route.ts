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

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    let normalizedCnpj = cliente.cnpjNormalized;
    let formattedCnpj = cliente.cnpj;

    if (body.cnpj !== undefined) {
      if (body.cnpj && body.cnpj.trim()) {
        const norm = normalizeCnpj(body.cnpj);
        if (!isValidCnpj(norm)) {
          return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
        }
        const duplicado = await prisma.cliente.findFirst({
          where: {
            cnpjNormalized: norm,
            id: { not: id },
          },
        });
        if (duplicado) {
          return NextResponse.json(
            { error: `CNPJ já cadastrado para o cliente "${duplicado.razaoSocialOuNome}".` },
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

    const atualizado = await prisma.cliente.update({
      where: { id },
      data: {
        razaoSocialOuNome: body.razaoSocialOuNome?.trim() ?? cliente.razaoSocialOuNome,
        nomeFantasia: body.nomeFantasia !== undefined ? body.nomeFantasia?.trim() || null : cliente.nomeFantasia,
        cnpj: formattedCnpj,
        cnpjNormalized: normalizedCnpj,
        telefone: body.telefone !== undefined ? body.telefone?.trim() || null : cliente.telefone,
        email: body.email !== undefined ? body.email?.trim() || null : cliente.email,
        endereco: body.endereco !== undefined ? body.endereco?.trim() || null : cliente.endereco,
        observacoes: body.observacoes !== undefined ? body.observacoes?.trim() || null : cliente.observacoes,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : cliente.ativo,
      },
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao atualizar cliente." },
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

    const countPedidos = await prisma.pedido.count({ where: { clienteId: id } });
    if (countPedidos > 0) {
      return NextResponse.json(
        {
          error: `Este cliente possui ${countPedidos} pedido(s) registrado(s) e não pode ser excluído fisicamente. Inative o cliente para que não receba novos pedidos.`,
        },
        { status: 400 }
      );
    }

    await prisma.cliente.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao excluir cliente." },
      { status: 500 }
    );
  }
}
