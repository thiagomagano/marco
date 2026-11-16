export const BRAND_NAME = "Canal de Acesso";
export const BRAND_SUBTITLE = "Acesso e conexões para o seu negócio.";

/**
 * Caminho principal da logo do cliente em `public/`.
 * Caso o arquivo seja movido para a raiz de `public/logo_marco.png`,
 * o fallback garante carregamento contínuo sem quebrar a UI ou os relatórios.
 */
export const BRAND_LOGO_PATH = "/images/logo_marco_transp.png";
export const BRAND_LOGO_FALLBACK_PATH = "/logo_marco_transp.png";

export function getBrandLogoUrl(origin?: string): string {
  const base = origin ? origin.replace(/\/+$/, "") : "";
  return `${base}${BRAND_LOGO_PATH}`;
}
