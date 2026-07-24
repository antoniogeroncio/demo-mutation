const LIMITE_APROVACAO_MANUAL = 10000;

/**
 * Trava antifraude: transferências de risco no valor do limite ou acima
 * dele exigem aprovação manual e não podem ser liberadas automaticamente.
 */
function podeTransferirAutomaticamente(valorTransferencia) {
  if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {
    return false;
  }
  return true;
}

module.exports = { podeTransferirAutomaticamente, LIMITE_APROVACAO_MANUAL };
