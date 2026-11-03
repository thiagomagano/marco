/**
 * Normaliza o CNPJ removendo caracteres não numéricos.
 */
export function normalizeCnpj(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Formata um CNPJ normalizado para o formato XX.XXX.XXX/XXXX-XX.
 */
export function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Valida os dígitos verificadores de um CNPJ.
 */
export function isValidCnpj(cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;
  const cleaned = cnpj.replace(/\D/g, "");

  if (cleaned.length !== 14) return false;

  // Rejeita sequências de dígitos iguais conhecidas (ex: 00000000000000, 11111111111111, etc.)
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Validação do 1º dígito verificador
  let tamanho = 12;
  let numeros = cleaned.substring(0, tamanho);
  const digitos = cleaned.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  // Validação do 2º dígito verificador
  tamanho = 13;
  numeros = cleaned.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
}
