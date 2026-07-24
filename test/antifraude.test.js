const { podeTransferirAutomaticamente } = require('../src/antifraude');

describe('trava antifraude - transferências de risco', () => {
  test('Teste 1: transferência de R$ 5.000 é aprovada automaticamente', () => {
    expect(podeTransferirAutomaticamente(5000)).toBe(true);
  });

  test('Teste 2: transferência de R$ 15.000 é bloqueada para aprovação manual', () => {
    expect(podeTransferirAutomaticamente(15000)).toBe(false);
  });
});
