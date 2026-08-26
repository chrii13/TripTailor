/**
 * Una pausa. Vive in un modulo suo per un motivo solo: essere sostituibile nei test, che
 * altrimenti dovrebbero aspettare davvero i secondi di distanziamento fra le chiamate a
 * LocationIQ. Un `ms` non positivo non aspetta niente.
 */
export function attendi(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((risolvi) => setTimeout(risolvi, ms));
}
