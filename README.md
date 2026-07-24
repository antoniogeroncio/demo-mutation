# O Vazamento Silencioso

[![CI](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml/badge.svg)](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml)

Demo reprodutível de como uma suíte de testes com **100% de cobertura** pode
esconder um bug crítico numa regra de negócio — e de como **mutation
testing** revela o que a cobertura de linhas não mostra.

## Resultados

Não é preciso clonar o repo para ver o resultado — a pipeline reproduz a
história inteira e publica a evidência direto no GitHub. O job **Evidência**
executa os quatro atos abaixo com Jest e Stryker reais, a cada run:

| Ato | Código | Testes | Evidência |
|---|---|---|---|
| **1 · Falsa segurança** | correto `>=` | 2 | Cobertura ✅ 100% · mutante `>` **sobrevive** (88.89%) |
| **2 · Bug silencioso** | bug `>` | 2 | Jest ✅ **passa** — a fraude de R$ 10.000 entra e ninguém vê |
| **3 · Regressão detectada** | bug `>` | 3 | Jest ❌ **falha** no Teste 3 — defeito barrado |
| **4 · Corrigido** | correto `>=` | 3 | Cobertura ✅ 100% · mutação ✅ 100% |

Onde ver:

- **[Aba Actions](https://github.com/antoniogeroncio/demo-mutation/actions/workflows/ci.yml)** →
  abra o run mais recente, job **Evidência**, e leia o **Summary**: cada ato
  com a saída real do Jest/Stryker, sem baixar nada. Os logs completos estão
  no artefato `evidencia`.
- **[Relatórios interativos (GitHub Pages)](https://antoniogeroncio.github.io/demo-mutation/)** →
  os relatórios HTML do Stryker do Ato 1 (mutante sobrevivente) e do Ato 4
  (blindado), navegáveis linha a linha, publicados a cada push em `main`.

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
todo push/PR e tem dois jobs:

- **Validação** — o estado final do repo (código correto + 3 testes) roda
  verde: cobertura 100%, mutação 100%. Escreve um Job Summary (via
  `scripts/write-summary.js`) e publica cobertura + relatório de mutação como
  artefatos. O `stryker.conf.json` define um `break` threshold de 90%, então
  se alguém remover o Teste 3 e o mutation score cair, este job **falha** —
  gate de qualidade real na esteira.
- **Evidência** — reproduz os quatro atos da tabela em [Resultados](#resultados)
  (via `scripts/evidence.js`), cada um com Jest/Stryker reais, e registra a
  saída como prova no Job Summary + artefato `evidencia` + site no GitHub
  Pages. É aqui que o "os testes falham" do Ato 3 aparece documentado.

> **Setup único do Pages**: em Settings → Pages → "Build and deployment",
> selecione **Source: GitHub Actions**. Depois disso, todo push em `main`
> atualiza o site de evidência automaticamente.

## Estrutura

```
.github/workflows/ci.yml    pipeline (validação + evidência + Pages)
scripts/evidence.js         reproduz os 4 atos e gera a evidência do CI
scripts/write-summary.js    gera o Job Summary do job de validação
src/antifraude.js           regra de negócio (a trava antifraude)
test/antifraude.test.js     suíte de testes (estado final: 3 testes)
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
