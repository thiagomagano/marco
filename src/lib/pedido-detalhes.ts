import {
  calcularDataEntregaPadrao,
  parseCalendarDateToSaoPauloNoon,
  toYmdString,
} from "./date-utils.ts";
import { normalizePrazoPagamentoBoleto } from "./prazo-pagamento.ts";

export interface PedidoLogisticaInput {
  dataEmbarque?: string | Date | null;
  dataEntregaPrevista?: string | Date | null;
  prazoPagamentoBoleto?: unknown;
  status: string;
  fallbackPrazoCliente?: string | null;
  existingDataEmbarque?: Date | string | null;
  existingDataEntregaPrevista?: Date | string | null;
  existingPrazoPagamentoBoleto?: string | null;
}

export type PedidoLogisticaResult =
  | {
      valid: true;
      dataEmbarque: Date | null;
      dataEntregaPrevista: Date | null;
      dataEmbarqueYmd: string;
      dataEntregaPrevistaYmd: string;
      prazoPagamentoBoleto: string | null;
    }
  | {
      valid: false;
      error: string;
    };

function resolveDateYmd(
  incoming: string | Date | null | undefined,
  existing: Date | string | null | undefined,
  fieldLabel: string
): { valid: true; ymd: string } | { valid: false; error: string } {
  if (incoming === undefined) {
    return { valid: true, ymd: toYmdString(existing) };
  }
  if (incoming === null) {
    return { valid: true, ymd: "" };
  }
  if (typeof incoming === "string" && !incoming.trim()) {
    return { valid: true, ymd: "" };
  }
  const ymd = toYmdString(incoming);
  if (!ymd) {
    return { valid: false, error: `${fieldLabel} inválida.` };
  }
  return { valid: true, ymd };
}

/**
 * Valida e normaliza os dados logísticos (embarque e entrega prevista) e o prazo de boleto do pedido.
 * - Em pedidos CONFIRMADOS, exige data de embarque e data de entrega prevista.
 * - A data de entrega prevista não pode ser anterior à data de embarque.
 * - Se embarque for informado na criação sem entrega explícita (`undefined`), aplica D+1 automaticamente.
 */
export function parseAndValidatePedidoLogistica(
  input: PedidoLogisticaInput
): PedidoLogisticaResult {
  const embRes = resolveDateYmd(
    input.dataEmbarque,
    input.existingDataEmbarque,
    "Data de embarque/carregamento"
  );
  if (!embRes.valid) {
    return embRes;
  }

  let entregaYmd = "";
  if (
    input.dataEntregaPrevista === undefined &&
    input.dataEmbarque !== undefined &&
    input.existingDataEntregaPrevista === undefined &&
    embRes.ymd
  ) {
    entregaYmd = calcularDataEntregaPadrao(embRes.ymd);
  } else {
    const entRes = resolveDateYmd(
      input.dataEntregaPrevista,
      input.existingDataEntregaPrevista,
      "Data da entrega prevista"
    );
    if (!entRes.valid) {
      return entRes;
    }
    entregaYmd = entRes.ymd;
  }

  const isConfirmed = input.status === "CONFIRMADO";
  if (isConfirmed) {
    if (!embRes.ymd) {
      return {
        valid: false,
        error:
          "Informe a data de embarque/carregamento para confirmar o pedido.",
      };
    }
    if (!entregaYmd) {
      return {
        valid: false,
        error: "Informe a data da entrega prevista para confirmar o pedido.",
      };
    }
  }

  if (embRes.ymd && entregaYmd && entregaYmd < embRes.ymd) {
    return {
      valid: false,
      error:
        "A data da entrega prevista não pode ser anterior à data de embarque/carregamento.",
    };
  }

  let prazoFinal: string | null = null;
  if (input.prazoPagamentoBoleto === undefined) {
    if (input.existingPrazoPagamentoBoleto !== undefined) {
      prazoFinal = input.existingPrazoPagamentoBoleto ?? null;
    } else {
      const fallback = normalizePrazoPagamentoBoleto(
        input.fallbackPrazoCliente ?? null
      );
      prazoFinal = fallback.valid ? fallback.value : null;
    }
  } else {
    const prazoParsed = normalizePrazoPagamentoBoleto(
      input.prazoPagamentoBoleto
    );
    if (!prazoParsed.valid) {
      return {
        valid: false,
        error: prazoParsed.error || "Prazo de pagamento no boleto inválido.",
      };
    }
    prazoFinal = prazoParsed.value;
  }

  return {
    valid: true,
    dataEmbarque: parseCalendarDateToSaoPauloNoon(embRes.ymd),
    dataEntregaPrevista: parseCalendarDateToSaoPauloNoon(entregaYmd),
    dataEmbarqueYmd: embRes.ymd,
    dataEntregaPrevistaYmd: entregaYmd,
    prazoPagamentoBoleto: prazoFinal,
  };
}
