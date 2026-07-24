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

### Execução 2 — Altera a regra de verdade: cobertura 100%, testes passando, mas a mutação pega ⚠️

Aqui a modificação é **real, no código-fonte**, não uma simulação: alguém
(uma IA, um dev distraído) troca o `>=` por `>` em `src/antifraude.js`.

```diff
- if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {
+ if (valorTransferencia > LIMITE_APROVACAO_MANUAL) {
```

A trava está quebrada — uma transferência de exatamente R$ 10.000 agora passa
direto. Mas rode `npm test`: os dois testes **continuam passando** e a
cobertura segue **100%**. A esteira fica verde. Nada acusa o defeito. É o
vazamento silencioso acontecendo de verdade.

Quem pega é o `npm run test:mutation`. O [Stryker Mutator](https://stryker-mutator.io/)
mostra que os testes não distinguem `>` de `>=` — o mutante que reverteria a
regra **sobrevive**:

```
[Survived] EqualityOperator
src/antifraude.js:8:7
-     if (valorTransferencia > LIMITE_APROVACAO_MANUAL) {
+     if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {

Mutation score: 88.89 %  (8 killed, 1 survived, 0 timeout)
```

O mutation score cai para 88,89%, abaixo do `break` threshold de 90%, e o
Stryker **reprova o run** (o passo do Jest fica verde, o da mutação fica
vermelho). Foi a mutação que pegou o buraco que a cobertura escondeu.

### Execução 3 — Corrige a regra e adiciona o teste de borda: mutação 100% ✅

Restaura-se o `>=` e adiciona-se um terceiro teste, na borda exata:

```js
// Teste 3: transferência de R$ 10.000 (a borda) é bloqueada
expect(podeTransferirAutomaticamente(10000)).toBe(false);
```

Esse teste é o que faltava: se alguém trocar `>=` por `>` de novo, o Teste 3
falha e denuncia a regressão. O run roda `npm test` (100% de cobertura) e
`npm run test:mutation` (**mutation score 100%**, nenhum sobrevivente):
**verde de verdade** — cobertura E mutação confirmam que a regra está
protegida.

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
