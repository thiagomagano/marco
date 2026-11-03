"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FileText,
  PlusCircle,
  Building2,
  Package,
  Users,
  UserCheck,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react";

export function Navbar({ operadorNome }: { operadorNome?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    { href: "/", label: "Início", icon: LayoutDashboard },
    { href: "/pedidos", label: "Pedidos", icon: FileText },
    { href: "/pedidos/novo", label: "Novo Pedido", icon: PlusCircle, highlight: true },
    { href: "/cadastros/frigorificos", label: "Frigoríficos", icon: Building2 },
    { href: "/cadastros/produtos", label: "Produtos", icon: Package },
    { href: "/cadastros/clientes", label: "Clientes", icon: Users },
    { href: "/cadastros/vendedores", label: "Vendedores", icon: UserCheck },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Você está sem conexão com a internet. Os dados preenchidos serão mantidos em rascunho local.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Título */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-blue-700 transition">
                M
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base leading-tight block">Marco Comercial</span>
                <span className="text-xs text-slate-500 block">Representação de Carnes</span>
              </div>
            </Link>
          </div>

          {/* Links Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href) && link.href !== "/pedidos");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                    link.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                      : isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Status e Operador */}
          <div className="hidden lg:flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
              title={isOnline ? "Conectado ao servidor" : "Sem conexão à internet"}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>

            {operadorNome && (
              <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 font-medium">
                {operadorNome}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Botão Menu Mobile */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  link.highlight
                    ? "bg-blue-600 text-white"
                    : isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Operador: {operadorNome || "Logado"}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-red-600 font-medium hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
