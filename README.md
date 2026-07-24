# O Vazamento Silencioso

[![CI](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml/badge.svg)](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml)

Demo reprodutível de como uma suíte de testes com **100% de cobertura** pode
esconder um bug crítico numa regra de negócio — e de como **mutation
testing** revela o que a cobertura de linhas não mostra.

A história é contada em **três execuções reais no GitHub Actions**, uma por
commit. Não há script encenando o resultado: cada run roda `npm test` e/ou
`npm run test:mutation` de verdade sobre o estado daquele commit. Basta abrir
a [aba Actions](https://github.com/antoniogeroncio/demo-mutation/actions) e
percorrer os três runs na ordem.

## O cenário

Um sistema financeiro tem uma trava antifraude: qualquer transferência de
risco **igual ou acima de R$ 10.000** deve ser bloqueada e enviada para
aprovação manual.

```js
// src/antifraude.js
if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {
  return false; // bloqueado
}
return true; // aprovado automaticamente
```

## As três execuções

### Execução 1 — Dois testes, 100% de cobertura ✅

A suíte cobre os dois cenários óbvios:

- **Teste 1**: transferir R$ 5.000 → aprovado.
- **Teste 2**: transferir R$ 15.000 → bloqueado.

O run roda `npm test`: a cobertura fecha em **100%** (statements, branches,
functions e lines) e tudo fica **verde**. A esteira dá o "laudo" de que o
sistema está blindado.

### Execução 2 — Liga o mutation testing: o mutante sobrevive ⚠️

Mesmo código, mesmos dois testes. O run agora roda também
`npm run test:mutation`, que **executa a modificação** — o [Stryker Mutator](https://stryker-mutator.io/)
troca automaticamente o `>=` por `>`, exatamente o tipo de defeito sutil que
uma IA ou um dev distraído introduziria — e roda a suíte de novo:

```
[Survived] EqualityOperator
src/antifraude.js:8:7
-     if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {
+     if (valorTransferencia > LIMITE_APROVACAO_MANUAL) {

Mutation score: 88.89 %  (8 killed, 1 survived, 0 timeout)
```

Os dois testes **continuam passando** com a regra modificada — o mutante
**sobrevive**. Ninguém exercita a borda exata dos R$ 10.000, então uma
transferência de exatamente R$ 10.000 passaria direto pela trava. A cobertura
segue 100%, mas o mutation score cai para 88,89% e o `break` threshold de 90%
**reprova o run**. Foi a mutação que pegou o buraco que a cobertura escondeu.

### Execução 3 — Teste de borda mata o mutante: mutação 100% ✅

Adiciona-se um terceiro teste, na borda exata:

```js
// Teste 3: transferência de R$ 10.000 (a borda) é bloqueada
expect(podeTransferirAutomaticamente(10000)).toBe(false);
```

Agora, se o mutante troca `>=` por `>`, o Teste 3 falha e mata o mutante. O
run roda `npm test` (100% de cobertura) e `npm run test:mutation`
(**mutation score 100%**, nenhum sobrevivente): **verde de verdade**.

## Como rodar localmente

```bash
npm install

# Testes + cobertura de linhas
npm test

# Mutation testing (Stryker) — relatório HTML em reports/mutation/index.html
npm run test:mutation
```

## A lição

Cobertura de código mede se uma linha **executou**. Mutation testing mede se
um teste **falharia caso a regra estivesse errada**. São perguntas diferentes.
Um "laudo" de 100% de cobertura não é evidência de que o sistema está
protegido — só de que o código foi tocado.

A pergunta certa não é hipotética, é operacional: **uma IA ou um
desenvolvedor, por engano, altera ou remove aquela cláusula de proteção —
existe um teste que pega essa regressão?** Se a resposta for não, a cobertura
de 100% não vale nada: o defeito entra em produção calado, e só aparece
quando o incidente real acontece.

## Estrutura

```
.github/workflows/ci.yml    pipeline (testes + mutation testing + Pages)
scripts/write-summary.js    gera o Job Summary a partir dos relatórios
src/antifraude.js           regra de negócio (a trava antifraude)
test/antifraude.test.js     suíte de testes
stryker.conf.json           configuração do mutation testing
```
