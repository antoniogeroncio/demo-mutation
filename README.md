# O Vazamento Silencioso

[![CI](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml/badge.svg)](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml)

Demo reprodutível de como uma suíte de testes com **100% de cobertura** pode
esconder um bug crítico numa regra de negócio — e de como **mutation
testing** revela o que a cobertura de linhas não mostra.

## Resultados

Não é preciso clonar o repo para ver o resultado — a pipeline publica tudo
direto no GitHub:

- **[Aba Actions](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml)** →
  abra o run mais recente e veja o **Summary**: cobertura, mutation score e a
  lista de mutantes, em markdown, sem baixar nada.
- **[Relatório interativo (GitHub Pages)](https://antoniogeroncio.github.io/demo-mutation/)** →
  o relatório HTML do Stryker, navegável linha a linha, publicado
  automaticamente a cada push em `main`.

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

A suíte de testes cobre os dois cenários óbvios:

- **Teste 1**: transferir R$ 5.000 → aprovado.
- **Teste 2**: transferir R$ 15.000 → bloqueado.

Rodando `npm test`, a cobertura fecha em **100%** (statements, branches,
functions e lines). A esteira fica verde. O "laudo" diz que o sistema está
blindado.

## O mutante

Nenhum dos dois testes exercita a **borda exata dos R$ 10.000**. Um
mutation testing tool (aqui, o [Stryker Mutator](https://stryker-mutator.io/))
troca automaticamente o operador `>=` por `>` — simulando exatamente o tipo
de defeito sutil que uma IA ou um dev distraído poderia introduzir — e roda
a suíte de novo:

```
[Survived] EqualityOperator
src/antifraude.js:8:7
-     if (valorTransferencia >= LIMITE_APROVACAO_MANUAL) {
+     if (valorTransferencia > LIMITE_APROVACAO_MANUAL) {

Mutation score: 88.89 %  (8 killed, 1 survived, 0 timeout)
```

O mutante **sobrevive**. Os dois testes continuam passando com a regra
quebrada — uma transferência de exatamente R$ 10.000 passaria direto pela
trava. Cobertura de linha 100%, mutation score 88,89%: o gap entre os dois
números é o vazamento silencioso.

## O reparo

Basta um terceiro teste, na borda exata:

```js
// Teste 3: transferência de R$ 10.000 (a borda) é bloqueada
expect(podeTransferirAutomaticamente(10000)).toBe(false);
```

Com esse teste, o mutante morre e o mutation score volta a **100%**.

## Como rodar

```bash
npm install

# 1. Suíte de testes + cobertura de linhas
npm test

# 2. Mutation testing (Stryker)
npm run test:mutation
# relatório HTML em reports/mutation/index.html
```

## CI

O workflow em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em
todo push/PR: instala as dependências, executa a suíte com cobertura e o
mutation testing, e:

1. Escreve um **Job Summary** (via `scripts/write-summary.js`) com a
   cobertura, o mutation score e os mutantes sobreviventes (se houver) —
   visível direto na página do run, sem precisar baixar nada.
2. Publica os relatórios completos (cobertura + mutation HTML) como
   **artefatos** do run.
3. Publica o relatório HTML do Stryker no **GitHub Pages**, a cada push em
   `main`.

O `stryker.conf.json` define um `break` threshold de 90% — se o mutation
score cair abaixo disso (por exemplo, se alguém remover o Teste 3), o job
falha, funcionando como um gate de qualidade real na esteira.

> **Setup único do Pages**: em Settings → Pages → "Build and deployment",
> selecione **Source: GitHub Actions**. Depois disso, todo push em `main`
> atualiza o relatório publicado automaticamente.

## Estrutura

```
.github/workflows/ci.yml    pipeline (testes + mutation testing + Pages)
scripts/write-summary.js    gera o Job Summary a partir dos relatórios
src/antifraude.js           regra de negócio (a trava antifraude)
test/antifraude.test.js     suíte de testes
stryker.conf.json           configuração do mutation testing
```

## A lição

Cobertura de código mede se uma linha **executou**. Mutation testing mede
se um teste **falharia caso a regra estivesse errada**. São perguntas
diferentes. Um "laudo" de 100% de cobertura não é evidência de que o
sistema está protegido — só de que o código foi tocado.

A pergunta certa não é hipotética, é operacional: **uma IA ou um
desenvolvedor, por engano, altera ou remove aquela cláusula de proteção —
existe um teste que pega essa regressão?** Se a resposta for não, a
cobertura de 100% não vale nada: o defeito entra em produção calado, e
só aparece quando o incidente real acontece.
