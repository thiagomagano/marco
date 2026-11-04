import { prisma } from "../lib/db.ts";
import { hashPassword } from "../lib/auth.ts";

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // 1. Cria ou atualiza o operador padrão
  const passwordHash = await hashPassword("admin123");
  const operador = await prisma.operador.upsert({
    where: { username: "operador" },
    update: {},
    create: {
      username: "operador",
      passwordHash,
      nome: "Operador Comercial",
    },
  });
  console.log(`Operador configurado: ${operador.username} (senha: admin123)`);

  // 2. Frigoríficos
  const boiGordo = await prisma.frigorifico.upsert({
    where: { cnpjNormalized: "04252011000110" },
    update: {},
    create: {
      nomeFantasia: "Frigorífico Boi Gordo",
      razaoSocial: "Frigorífico Boi Gordo Indústria e Comércio de Carnes Ltda",
      cnpj: "04.252.011/0001-10",
      cnpjNormalized: "04252011000110",
      contato: "Mauro Ramos",
      telefone: "(11) 98765-4321",
      email: "pedidos@boigordo.com.br",
      observacoes: "Entregas terças e quintas-feiras.",
      ativo: true,
    },
  });

  const ouroDoSul = await prisma.frigorifico.upsert({
    where: { cnpjNormalized: "73119515000192" },
    update: {},
    create: {
      nomeFantasia: "Frigorífico Ouro do Sul",
      razaoSocial: "Ouro do Sul Agroindustrial S.A.",
      cnpj: "73.119.515/0001-92",
      cnpjNormalized: "73119515000192",
      contato: "Renata Duarte",
      telefone: "(51) 99123-8899",
      email: "vendas@ourodosul.com.br",
      ativo: true,
    },
  });

  console.log("Frigoríficos criados.");

  // 3. Produtos por Frigorífico
  // Boi Gordo
  const produtosBoiGordo = [
    {
      codigo: "101",
      nome: "Picanha Bovina Resfriada",
      categoria: "Cortes Nobres",
      unidade: "kg",
      precoReferencia: 68.9,
    },
    {
      codigo: "102",
      nome: "Alcatra com Maminha",
      categoria: "Cortes Nobres",
      unidade: "kg",
      precoReferencia: 42.5,
    },
    {
      codigo: "103",
      nome: "Costela Bovina Janela",
      categoria: "Tradicionais",
      unidade: "caixa",
      precoReferencia: 380.0,
    },
    {
      codigo: "104",
      nome: "Filé Mignon Inteiro",
      categoria: "Cortes Nobres",
      unidade: "peça",
      precoReferencia: 85.0,
    },
  ];

  for (const prod of produtosBoiGordo) {
    await prisma.produto.upsert({
      where: {
        frigorificoId_codigo: {
          frigorificoId: boiGordo.id,
          codigo: prod.codigo,
        },
      },
      update: {},
      create: {
        frigorificoId: boiGordo.id,
        codigo: prod.codigo,
        nome: prod.nome,
        categoria: prod.categoria,
        unidade: prod.unidade,
        precoReferencia: prod.precoReferencia,
        ativo: true,
      },
    });
  }

  // Ouro do Sul (contém mesmo código 101 para demonstrar unicidade por frigorífico)
  const produtosOuroSul = [
    {
      codigo: "101", // mesmo código do Boi Gordo, mas frigorífico diferente
      nome: "Costelinha Suína Especial",
      categoria: "Suínos",
      unidade: "kg",
      precoReferencia: 26.9,
    },
    {
      codigo: "201",
      nome: "Lombo Suíno Resfriado",
      categoria: "Suínos",
      unidade: "kg",
      precoReferencia: 29.5,
    },
    {
      codigo: "301",
      nome: "Bacon Manta Defumada",
      categoria: "Embutidos",
      unidade: "peça",
      precoReferencia: 48.0,
    },
    {
      codigo: "401",
      nome: "Linguiça Toscana Congelada (Caixa 10kg)",
      categoria: "Embutidos",
      unidade: "caixa",
      precoReferencia: 195.0,
    },
  ];

  for (const prod of produtosOuroSul) {
    await prisma.produto.upsert({
      where: {
        frigorificoId_codigo: {
          frigorificoId: ouroDoSul.id,
          codigo: prod.codigo,
        },
      },
      update: {},
      create: {
        frigorificoId: ouroDoSul.id,
        codigo: prod.codigo,
        nome: prod.nome,
        categoria: prod.categoria,
        unidade: prod.unidade,
        precoReferencia: prod.precoReferencia,
        ativo: true,
      },
    });
  }

  console.log("Produtos cadastrados para ambos os frigoríficos.");

  // 4. Vendedores
  const vendedor1 = await prisma.vendedor.upsert({
    where: { id: "vend-carlos" },
    update: {},
    create: {
      id: "vend-carlos",
      nome: "Carlos Eduardo Silva",
      telefone: "(11) 98111-2233",
      observacoes: "Responsável pela rota Zona Sul.",
      ativo: true,
    },
  });

  const vendedor2 = await prisma.vendedor.upsert({
    where: { id: "vend-mariana" },
    update: {},
    create: {
      id: "vend-mariana",
      nome: "Mariana Souza Santos",
      telefone: "(11) 98222-3344",
      observacoes: "Responsável por grandes redes e restaurantes.",
      ativo: true,
    },
  });

  console.log("Vendedores cadastrados.");

  // 5. Clientes Compartilhados (vinculados a Vendedores)
  const cliente1 = await prisma.cliente.upsert({
    where: { cnpjNormalized: "11222333000181" },
    update: {
      vendedorId: vendedor1.id,
    },
    create: {
      razaoSocialOuNome: "Supermercado Progresso da Serra Ltda",
      nomeFantasia: "Supermercado Progresso",
      cnpj: "11.222.333/0001-81",
      cnpjNormalized: "11222333000181",
      telefone: "(11) 3456-7890",
      email: "compras@progresso.com.br",
      endereco: "Av. Central, 1200 - Centro",
      observacoes: "Recebe cargas até as 11h.",
      vendedorId: vendedor1.id,
      ativo: true,
    },
  });

  const cliente2 = await prisma.cliente.upsert({
    where: { cnpjNormalized: "22333444000122" },
    update: {
      vendedorId: vendedor2.id,
    },
    create: {
      razaoSocialOuNome: "Churrascaria Fogo de Chão & Brasa Eireli",
      nomeFantasia: "Churrascaria Fogo Nobre",
      cnpj: "22.333.444/0001-22",
      cnpjNormalized: "22333444000122",
      telefone: "(11) 97654-3210",
      email: "financeiro@fogonobre.com.br",
      endereco: "Rua das Oliveiras, 45",
      vendedorId: vendedor2.id,
      ativo: true,
    },
  });

  // Cliente sem CNPJ (vinculado ao vendedor1)
  const cliente3 = await prisma.cliente.findFirst({
    where: { razaoSocialOuNome: "Açougue e Boutique do Bairro" },
  });
  if (!cliente3) {
    await prisma.cliente.create({
      data: {
        razaoSocialOuNome: "Açougue e Boutique do Bairro",
        nomeFantasia: "Açougue do Bairro",
        telefone: "(11) 98888-7777",
        endereco: "Rua do Comércio, 310",
        observacoes: "Cliente tradicional, pagamento semanal.",
        vendedorId: vendedor1.id,
        ativo: true,
      },
    });
  } else {
    await prisma.cliente.update({
      where: { id: cliente3.id },
      data: { vendedorId: vendedor1.id },
    });
  }

  console.log("Clientes cadastrados e vinculados aos vendedores.");
  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
