"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  X,
} from "lucide-react";
import type {
  ClienteCamposBrasilApi,
  ConsultaCnpjResult,
} from "@/lib/brasilapi-cnpj.ts";

export interface ClienteCamposForm {
  razaoSocialOuNome: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
}

type CampoKey = keyof ClienteCamposForm;

interface CampoConfig {
  key: CampoKey;
  label: string;
}

const CAMPOS_CONFIG: CampoConfig[] = [
  { key: "razaoSocialOuNome", label: "Razão Social" },
  { key: "nomeFantasia", label: "Nome Fantasia" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "cep", label: "CEP" },
  { key: "endereco", label: "Logradouro / Número" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade / UF" },
];

interface BrasilApiReviewModalProps {
  open: boolean;
  onClose: () => void;
  dados: ConsultaCnpjResult | null;
  valoresAtuais: ClienteCamposForm;
  onAplicar: (camposSelecionados: Partial<ClienteCamposForm>) => void;
}

interface CampoRow {
  key: CampoKey;
  label: string;
  valorAtual: string;
  valorApi: string | null;
  atualizavel: boolean;
  identico: boolean;
  vazioAtual: boolean;
}

function buildRows(
  valoresAtuais: ClienteCamposForm,
  camposApi: ClienteCamposBrasilApi
): CampoRow[] {
  return CAMPOS_CONFIG.map(({ key, label }) => {
    const valorAtual = (valoresAtuais[key] || "").trim();
    const valorApiRaw = camposApi[key];
    const valorApi = valorApiRaw ? valorApiRaw.trim() : null;
    const temValorApi = Boolean(valorApi);
    const identico = temValorApi && valorAtual === valorApi;
    const atualizavel = temValorApi && !identico;

    return {
      key,
      label,
      valorAtual,
      valorApi,
      atualizavel,
      identico,
      vazioAtual: valorAtual.length === 0,
    };
  });
}

function BrasilApiReviewModalContent({
  onClose,
  dados,
  valoresAtuais,
  onAplicar,
}: Omit<BrasilApiReviewModalProps, "open"> & { dados: ConsultaCnpjResult }) {
  const rows = useMemo(
    () => buildRows(valoresAtuais, dados.campos),
    [valoresAtuais, dados.campos]
  );

  // Por padrão, todos os campos divergentes retornados pela BrasilAPI iniciam marcados
  const [selecionados, setSelecionados] = useState<Record<CampoKey, boolean>>(
    () => {
      const inicial = {} as Record<CampoKey, boolean>;
      for (const row of rows) {
        inicial[row.key] = row.atualizavel;
      }
      return inicial;
    }
  );

  const totalAtualizaveis = rows.filter((r) => r.atualizavel).length;
  const totalSelecionados = rows.filter(
    (r) => r.atualizavel && selecionados[r.key]
  ).length;

  const toggleCampo = (key: CampoKey) => {
    setSelecionados((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const marcarTodosDivergentes = () => {
    const next = {} as Record<CampoKey, boolean>;
    for (const row of rows) {
      next[row.key] = row.atualizavel;
    }
    setSelecionados(next);
  };

  const marcarSomenteVazios = () => {
    const next = {} as Record<CampoKey, boolean>;
    for (const row of rows) {
      next[row.key] = row.atualizavel && row.vazioAtual;
    }
    setSelecionados(next);
  };

  const desmarcarTodos = () => {
    const next = {} as Record<CampoKey, boolean>;
    for (const row of rows) {
      next[row.key] = false;
    }
    setSelecionados(next);
  };

  const handleAplicar = () => {
    const camposAplicar: Partial<ClienteCamposForm> = {};
    for (const row of rows) {
      if (row.atualizavel && selecionados[row.key] && row.valorApi) {
        camposAplicar[row.key] = row.valorApi;
      }
    }
    onAplicar(camposAplicar);
  };

  const situacao = dados.metadados.situacaoCadastral;
  const situacaoAtiva = situacao === "ATIVA";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brasilapi-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3
                id="brasilapi-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900"
              >
                Dados da Receita Federal (BrasilAPI)
              </h3>
              <span className="font-mono text-xs bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                {dados.metadados.cnpjFormatado}
              </span>
              {situacao && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    situacaoAtiva
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {situacaoAtiva ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  Situação: {situacao}
                </span>
              )}
              {dados.cached && (
                <span className="text-[10px] text-slate-400 font-medium">
                  (cache local)
                </span>
              )}
            </div>

            {(dados.metadados.cnaePrincipal || dados.metadados.porte) && (
              <p className="text-[11px] text-slate-500">
                {dados.metadados.cnaePrincipal && (
                  <span>CNAE: {dados.metadados.cnaePrincipal}</span>
                )}
                {dados.metadados.cnaePrincipal && dados.metadados.porte && (
                  <span> • </span>
                )}
                {dados.metadados.porte && (
                  <span>Porte: {dados.metadados.porte}</span>
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerta se CNPJ não estiver ATIVO */}
        {situacao && !situacaoAtiva && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Atenção:</strong> Este CNPJ consta com situação cadastral{" "}
              <strong>{situacao}</strong> na Receita Federal. Revise os dados
              antes de aplicar ao cadastro.
            </div>
          </div>
        )}

        {/* Barra de ações rápidas */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-slate-600">
            Revise os campos abaixo e desmarque o que não desejar atualizar no
            formulário:
          </p>
          {totalAtualizaveis > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={marcarTodosDivergentes}
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={marcarSomenteVazios}
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                Somente vazios
              </button>
              <button
                type="button"
                onClick={desmarcarTodos}
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                Desmarcar todos
              </button>
            </div>
          )}
        </div>

        {/* Tabela comparativa */}
        <div className="px-6 py-2 overflow-y-auto flex-1">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Aceitar</th>
                  <th className="py-2.5 px-3 w-36">Campo</th>
                  <th className="py-2.5 px-3">Cadastro Atual</th>
                  <th className="py-2.5 px-3">Receita (BrasilAPI)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const checked = row.atualizavel && Boolean(selecionados[row.key]);
                  return (
                    <tr
                      key={row.key}
                      onClick={() => {
                        if (row.atualizavel) toggleCampo(row.key);
                      }}
                      className={`transition ${
                        row.atualizavel
                          ? checked
                            ? "bg-blue-50/40 hover:bg-blue-50/70 cursor-pointer"
                            : "hover:bg-slate-50 cursor-pointer"
                          : "bg-slate-50/40 text-slate-400"
                      }`}
                    >
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!row.atualizavel}
                          onChange={() => toggleCampo(row.key)}
                          aria-label={`Aceitar ${row.label}`}
                          className="rounded-sm w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div className="flex flex-col gap-0.5">
                          <span>{row.label}</span>
                          {row.atualizavel && (
                            <span
                              className={`inline-block w-fit px-1.5 py-0.2 rounded-sm text-[9px] font-bold uppercase ${
                                row.vazioAtual
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {row.vazioAtual ? "Novo" : "Diferente"}
                            </span>
                          )}
                          {row.identico && (
                            <span className="inline-block w-fit px-1.5 py-0.2 rounded-sm text-[9px] font-semibold bg-slate-100 text-slate-500 uppercase">
                              Igual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 break-words">
                        {row.valorAtual ? (
                          <span>{row.valorAtual}</span>
                        ) : (
                          <span className="italic text-slate-400">Vazio</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 break-words">
                        {row.valorApi ? (
                          <span
                            className={
                              row.atualizavel
                                ? "font-semibold text-slate-900"
                                : "text-slate-500"
                            }
                          >
                            {row.valorApi}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">
                            Não informado na Receita
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {totalAtualizaveis === 0 ? (
              "Todos os dados disponíveis já estão atualizados no formulário."
            ) : (
              <>
                <strong>{totalSelecionados}</strong> de{" "}
                <strong>{totalAtualizaveis}</strong> alteração(ões) selecionada(s)
              </>
            )}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={totalSelecionados === 0}
              onClick={handleAplicar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aplicar selecionados</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrasilApiReviewModal(props: BrasilApiReviewModalProps) {
  if (!props.open || !props.dados) return null;

  const modalKey = `${props.dados.metadados.cnpj}-${props.dados.cached ? "c" : "l"}`;

  return (
    <BrasilApiReviewModalContent
      key={modalKey}
      onClose={props.onClose}
      dados={props.dados}
      valoresAtuais={props.valoresAtuais}
      onAplicar={props.onAplicar}
    />
  );
}
