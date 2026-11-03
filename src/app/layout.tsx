import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/session.ts";
import { Navbar } from "@/components/layout/Navbar.tsx";

export const metadata: Metadata = {
  title: "Marco Comercial — Registro de Pedidos",
  description: "Sistema de Registro e Consulta de Pedidos Comerciais para Representações de Frigoríficos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {session && <Navbar operadorNome={session.nome} />}
        <main className="flex-1">{children}</main>
        {session && (
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              Marco Comercial &bull; Sistema de Registro de Vendas da Representação (MVP v1.0)
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
