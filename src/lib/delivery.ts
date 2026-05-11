/**
 * Regras de Taxa de Entrega - Delícias de Maria
 * 1) Taxa Mínima: R$ 5,00 (até 1km)
 * 2) Adicional: R$ 1,50 por km excedente (acima de 1km)
 * 3) Arredondamento: 2 casas decimais
 */

export const TAXA_MINIMA = 5.00;
export const ADICIONAL_POR_KM = 1.50;
export const DISTANCIA_BASE_KM = 1;

export function calcularTaxaEntrega(distanciaKm: number): number {
  if (distanciaKm <= DISTANCIA_BASE_KM) {
    return TAXA_MINIMA;
  }
  
  const taxa = TAXA_MINIMA + (distanciaKm - DISTANCIA_BASE_KM) * ADICIONAL_POR_KM;
  return Math.round(taxa * 100) / 100;
}
