"use client";

import { CalendarClock, CalendarCheck2, Receipt, RotateCcw } from "lucide-react";
import { calcularDataEntregaPadrao, formatYmdBr } from "@/lib/date-utils.ts";
import { PRAZOS_PAGAMENTO_SUGESTOES } from "@/lib/prazo-pagamento.ts";

interface PedidoLogisticaPagamentoFieldsProps {
  dataEmbarque: string;
  dataEntregaPrevista: string;
  entregaManual: boolean;
  prazoPagamentoBoleto: string;
  clientePrazoPadrao?: string | null;
  onDataEmbarqueChange: (novaData: string) => void;
  onDataEntregaChange: (novaData: string) => void;
  onAplicarEntregaD1: () => void;
  onPrazoChange: (novoPrazo: string) => void;
  onRestaurarPrazoCliente?: () => void;
}

export function PedidoLogisticaPagamentoFields({
  dataEmbarque,
  dataEntregaPrevista,
  entregaManual,
  prazoPagamentoBoleto,
  clientePrazoPadrao,
  onDataEmbarqueChange,
  onDataEntregaChange,
  onAplicarEntregaD1,
  onPrazoChange,
  onRestaurarPrazoCliente,
}: PedidoLogisticaPagamentoFieldsProps) {
  const entregaSugeridaD1 = dataEmbarque
    ? calcularDataEntregaPadrao(dataEmbarque)
    : "";
  const isEntregaD1 = Boolean(
    entregaSugeridaD1 && dataEntregaPrevista === entregaSugeridaD1
  );
  const dataEntregaInvalida = Boolean(
    dataEmbarque && dataEntregaPrevista && dataEntregaPrevista < dataEmbarque
  );

  const prazoAtualNorm = prazoPagamentoBoleto.trim().toLowerCase();
  const prazoClienteNorm = (clientePrazoPadrao || "").trim().toLowerCase();
  const prazoDiferenteDoCliente = Boolean(
    clientePrazoPadrao && prazoAtualNorm !== prazoClienteNorm
  );

  return (
    <div className="pt-4 border-t border-slate-100 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Logística e Condição de Pagamento
        </span>
        <span className="text-[11px] text-slate-400">
          Obrigatório informar as datas para confirmar o pedido
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Data de Embarque / Carregamento */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            Data de Embarque / Carregamento *
          </label>
          <input
            type="date"
            value={dataEmbarque}
            onChange={(e) => onDataEmbarqueChange(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            {dataEmbarque
              ? `Carregamento previsto para ${formatYmdBr(dataEmbarque)}.`
              : "Informe a data prevista para embarque/carregamento."}
          </p>
        </div>

        {/* Data da Entrega Prevista */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarCheck2 className="w-4 h-4 text-slate-500" />
              Data da Entrega Prevista *
            </label>
            {isEntregaD1 && !entregaManual ? (
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md">
                D+1 automático
              </span>
            ) : entregaSugeridaD1 && !isEntregaD1 ? (
              <button
                type="button"
                onClick={onAplicarEntregaD1}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
                title={`Ajustar para D+1 (${formatYmdBr(entregaSugeridaD1)})`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Usar D+1 ({formatYmdBr(entregaSugeridaD1)})</span>
              </button>
            ) : null}
          </div>
          <input
            type="date"
            min={dataEmbarque || undefined}
            value={dataEntregaPrevista}
            onChange={(e) => onDataEntregaChange(e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-hidden focus:ring-2 font-medium ${
              dataEntregaInvalida
                ? "border-red-400 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500"
            }`}
          />
          <p
            className={`text-[11px] mt-1 ${
              dataEntregaInvalida ? "text-red-600 font-semibold" : "text-slate-400"
            }`}
          >
            {dataEntregaInvalida
              ? "A entrega prevista não pode ser anterior ao embarque."
              : "Por padrão D+1 do carregamento; editável conforme rota."}
          </p>
        </div>

        {/* Prazo de Pagamento no Boleto */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-slate-500" />
              Prazo do Boleto
            </label>
            {prazoDiferenteDoCliente && onRestaurarPrazoCliente && (
              <button
                type="button"
                onClick={onRestaurarPrazoCliente}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
                title={`Restaurar padrão do cliente (${clientePrazoPadrao})`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Padrão ({clientePrazoPadrao})</span>
              </button>
            )}
          </div>
          <input
            type="text"
            value={prazoPagamentoBoleto}
            onChange={(e) => onPrazoChange(e.target.value)}
            placeholder="Ex: 14 dias, 7/14/21..."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {PRAZOS_PAGAMENTO_SUGESTOES.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => onPrazoChange(sugestao)}
                className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border transition cursor-pointer ${
                  prazoAtualNorm === sugestao.toLowerCase()
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {sugestao}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Alterações aqui valem apenas para este pedido (não alteram o cadastro do cliente).
          </p>
        </div>
      </div>
    </div>
  );
}
