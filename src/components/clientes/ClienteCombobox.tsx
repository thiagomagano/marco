"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ChevronDown, Loader2, UserCheck, MapPin } from "lucide-react";

export interface ClienteResumo {
  id: string;
  razaoSocialOuNome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  cidade: string | null;
  bairro: string | null;
  prazoPagamentoBoleto?: string | null;
  ativo?: boolean;
  vendedorId: string | null;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
}

interface ClienteComboboxProps {
  value: string;
  selectedCliente?: ClienteResumo | null;
  onChange: (cliente: ClienteResumo | null) => void;
  vendedorId?: string;
  ativosOnly?: boolean;
  placeholder?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

function formatClienteDisplay(c: ClienteResumo): string {
  if (c.nomeFantasia && c.nomeFantasia.trim() && c.nomeFantasia !== c.razaoSocialOuNome) {
    return `${c.nomeFantasia} (${c.razaoSocialOuNome})`;
  }
  return c.razaoSocialOuNome;
}

export function ClienteCombobox({
  value,
  selectedCliente,
  onChange,
  vendedorId = "",
  ativosOnly = true,
  placeholder = "Digite nome, fantasia, CNPJ ou cidade...",
  emptyOptionLabel,
  disabled = false,
  size = "md",
}: ClienteComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ClienteResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [clienteFetched, setClienteFetched] = useState<ClienteResumo | null>(
    null
  );

  const clienteAtual = !value
    ? null
    : selectedCliente?.id === value
    ? selectedCliente
    : clienteFetched?.id === value
    ? clienteFetched
    : null;

  // Se houver um value (ex: rascunho do localStorage) sem objeto resolvido, busca apenas esse 1 cliente
  useEffect(() => {
    if (!value) return;
    if (selectedCliente?.id === value || clienteFetched?.id === value) return;

    const controller = new AbortController();
    fetch(`/api/clientes/${value}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ClienteResumo | null) => {
        if (data && data.id === value) {
          setClienteFetched(data);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Erro ao resolver cliente selecionado:", err);
        }
      });

    return () => controller.abort();
  }, [value, selectedCliente, clienteFetched]);

  const buscarClientes = useCallback(
    async (termo: string, signal: AbortSignal) => {
      setBuscando(true);
      setErroBusca(null);
      try {
        const params = new URLSearchParams();
        if (termo.trim()) params.set("q", termo.trim());
        if (vendedorId) params.set("vendedorId", vendedorId);
        params.set("ativos", ativosOnly ? "true" : "todos");
        params.set("limit", "25");

        const res = await fetch(`/api/clientes/busca?${params.toString()}`, {
          signal,
        });
        if (!res.ok) {
          throw new Error("Erro ao buscar clientes.");
        }
        const data = await res.json();
        const lista: ClienteResumo[] = data.clientes || [];
        setResultados(lista);
        setHighlightedIndex(0);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setErroBusca("Falha ao carregar clientes.");
          setResultados([]);
        }
      } finally {
        if (!signal.aborted) {
          setBuscando(false);
        }
      }
    },
    [vendedorId, ativosOnly]
  );

  // Busca com debounce sempre que o dropdown estiver aberto
  useEffect(() => {
    if (!aberto || disabled) return;

    const controller = new AbortController();
    const delay = query.trim() ? 250 : 0;
    const timer = setTimeout(() => {
      buscarClientes(query, controller.signal);
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [aberto, disabled, query, buscarClientes]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selecionarCliente = (cliente: ClienteResumo | null) => {
    setClienteFetched(cliente);
    onChange(cliente);
    setAberto(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!aberto) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setAberto(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        resultados.length === 0 ? 0 : Math.min(prev + 1, resultados.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const escolhido = resultados[highlightedIndex];
      if (escolhido) {
        selecionarCliente(escolhido);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      setQuery("");
    }
  };

  const isSmall = size === "sm";

  return (
    <div ref={containerRef} className="relative">
      {!aberto && clienteAtual ? (
        <div
          className={`w-full flex items-center justify-between gap-2 border transition ${
            isSmall
              ? "px-2.5 py-1.5 text-xs bg-slate-50 border-slate-200 rounded-lg"
              : "px-3 py-2 text-sm bg-white border-slate-300 rounded-xl"
          } ${disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "hover:border-slate-400"}`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setAberto(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex-1 text-left min-w-0 cursor-pointer disabled:cursor-not-allowed"
            title={formatClienteDisplay(clienteAtual)}
          >
            <div className="font-semibold text-slate-900 truncate">
              {clienteAtual.nomeFantasia || clienteAtual.razaoSocialOuNome}
            </div>
            {!isSmall && (
              <div className="text-[11px] text-slate-500 truncate">
                {clienteAtual.nomeFantasia &&
                clienteAtual.nomeFantasia !== clienteAtual.razaoSocialOuNome
                  ? clienteAtual.razaoSocialOuNome
                  : null}
                {clienteAtual.cnpj
                  ? `${
                      clienteAtual.nomeFantasia &&
                      clienteAtual.nomeFantasia !== clienteAtual.razaoSocialOuNome
                        ? " • "
                        : ""
                    }${clienteAtual.cnpj}`
                  : ""}
                {clienteAtual.cidade ? ` • ${clienteAtual.cidade}` : ""}
              </div>
            )}
          </button>

          {!disabled && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selecionarCliente(null);
                  setAberto(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                title="Limpar cliente selecionado"
              >
                <X className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAberto(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                title="Alterar cliente"
              >
                <ChevronDown className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex items-center">
          <Search
            className={`text-slate-400 absolute pointer-events-none ${
              isSmall ? "w-3.5 h-3.5 left-2.5" : "w-4 h-4 left-3"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={
              aberto
                ? query
                : value && !clienteAtual
                ? "Carregando cliente..."
                : query
            }
            onFocus={() => {
              if (!disabled) setAberto(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!aberto) setAberto(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              !aberto && emptyOptionLabel ? emptyOptionLabel : placeholder
            }
            className={`w-full border focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition disabled:bg-slate-100 disabled:text-slate-400 ${
              isSmall
                ? "pl-8 pr-8 py-2 text-xs bg-slate-50 border-slate-200 rounded-lg"
                : "pl-9 pr-9 py-2.5 text-sm bg-white border-slate-300 rounded-xl font-medium"
            }`}
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            {buscando ? (
              <Loader2
                className={`animate-spin text-blue-600 ${
                  isSmall ? "w-3.5 h-3.5" : "w-4 h-4"
                }`}
              />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpar busca"
              >
                <X className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </button>
            ) : (
              <ChevronDown
                className={`text-slate-400 pointer-events-none ${
                  isSmall ? "w-3.5 h-3.5" : "w-4 h-4"
                }`}
              />
            )}
          </div>
        </div>
      )}

      {aberto && !disabled && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {emptyOptionLabel && (
            <button
              type="button"
              onClick={() => selecionarCliente(null)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer ${
                !value ? "bg-blue-50 text-blue-700" : "text-slate-600"
              }`}
            >
              {emptyOptionLabel}
            </button>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {buscando && resultados.length === 0 ? (
              <div className="px-3.5 py-4 text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Buscando clientes...</span>
              </div>
            ) : erroBusca ? (
              <div className="px-3.5 py-3 text-xs text-red-600">{erroBusca}</div>
            ) : resultados.length === 0 ? (
              <div className="px-3.5 py-4 text-xs text-slate-500">
                {query.trim()
                  ? `Nenhum cliente encontrado para "${query.trim()}".`
                  : "Nenhum cliente disponível para este filtro."}
              </div>
            ) : (
              resultados.map((c, idx) => {
                const isSelected = c.id === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => selecionarCliente(c)}
                    className={`w-full text-left px-3.5 py-2.5 transition cursor-pointer ${
                      isHighlighted
                        ? "bg-blue-50"
                        : isSelected
                        ? "bg-slate-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {c.nomeFantasia || c.razaoSocialOuNome}
                          {c.ativo === false && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                              Inativo
                            </span>
                          )}
                        </div>
                        {c.nomeFantasia && c.nomeFantasia !== c.razaoSocialOuNome && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.razaoSocialOuNome}
                          </div>
                        )}
                      </div>
                      {c.vendedor && (
                        <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md">
                          <UserCheck className="w-2.5 h-2.5" />
                          {c.vendedor.nome}
                        </span>
                      )}
                    </div>

                    {(c.cnpj || c.cidade || c.bairro) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                        {c.cnpj && <span className="font-mono">{c.cnpj}</span>}
                        {(c.cidade || c.bairro) && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            {[c.cidade, c.bairro].filter(Boolean).join(" • ")}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              {resultados.length >= 25
                ? "Mostrando os 25 primeiros. Digite para refinar."
                : `${resultados.length} resultado(s)`}
            </span>
            <span>↑↓ navegar • Enter selecionar • Esc fechar</span>
          </div>
        </div>
      )}
    </div>
  );
}
