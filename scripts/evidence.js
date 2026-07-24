'use strict';

/**
 * Gera EVIDÊNCIA reproduzível do "Vazamento Silencioso" em 4 atos.
 *
 * Cada ato reconstrói um estado do código/testes de forma determinística,
 * roda as ferramentas de verdade (Jest / Stryker) e registra a saída real
 * como prova — no Job Summary do GitHub Actions, em artefatos e no site
 * publicado no GitHub Pages.
 *
 * O repositório guarda o estado FINAL (código correto `>=` + 3 testes). As
 * demais variações (código com bug `>`, suíte com apenas 2 testes) são
 * derivadas daqui, mantendo uma única fonte de verdade.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'src', 'antifraude.js');
const testPath = path.join(root, 'test', 'antifraude.test.js');
const evidenceDir = path.join(root, 'reports', 'evidence');
const pagesDir = path.join(root, 'reports', 'pages');
const mutationDir = path.join(root, 'reports', 'mutation');

// --- Fonte de verdade (estado final, versionado no repo) -------------------
const SRC_CORRETO = fs.readFileSync(srcPath, 'utf8');
const TEST_3 = fs.readFileSync(testPath, 'utf8');

// --- Variações derivadas ---------------------------------------------------
// Bug: troca `>=` por `>` na cláusula da trava (o mutante do artigo).
const SRC_BUG = SRC_CORRETO.replace(
  '>= LIMITE_APROVACAO_MANUAL',
  '> LIMITE_APROVACAO_MANUAL'
);
if (SRC_BUG === SRC_CORRETO) {
  throw new Error('Não consegui derivar a versão com bug (>= -> >).');
}

// Suíte com apenas 2 testes: remove o bloco do Teste 3 (a borda).
const TEST_2 = TEST_3.replace(
  /\n\s*test\('Teste 3[\s\S]*?\}\);\n/,
  '\n'
);
if (TEST_2 === TEST_3 || TEST_2.includes('Teste 3')) {
  throw new Error('Não consegui derivar a suíte de 2 testes (sem o Teste 3).');
}

// --- Utilitários -----------------------------------------------------------
function run(cmd) {
  try {
    const out = execSync(cmd, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      out: `${err.stdout || ''}${err.stderr || ''}`,
    };
  }
}

function setState({ src, test }) {
  fs.writeFileSync(srcPath, src);
  fs.writeFileSync(testPath, test);
}

function restoreCanonical() {
  fs.writeFileSync(srcPath, SRC_CORRETO);
  fs.writeFileSync(testPath, TEST_3);
}

function readMutationScore() {
  const jsonPath = path.join(mutationDir, 'mutation.json');
  if (!fs.existsSync(jsonPath)) return null;
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const mutants = Object.entries(report.files).flatMap(([file, data]) =>
    data.mutants.map((m) => ({ ...m, file }))
  );
  const byStatus = mutants.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  const killed = (byStatus.Killed || 0) + (byStatus.Timeout || 0);
  const score = mutants.length ? (killed / mutants.length) * 100 : 0;
  const survived = mutants.filter((m) => m.status === 'Survived');
  return { total: mutants.length, killed, byStatus, score, survived };
}

function tail(text, n = 24) {
  const lines = text.trimEnd().split('\n');
  return lines.slice(-n).join('\n');
}

// --- Coleta de saída -------------------------------------------------------
fs.rmSync(evidenceDir, { recursive: true, force: true });
fs.rmSync(pagesDir, { recursive: true, force: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });

const summary = [];
const s = (line = '') => summary.push(line);

s('# O Vazamento Silencioso — evidência em 4 atos');
s('');
s(
  'Regra de negócio (trava antifraude): transferências de risco de ' +
    '**R$ 10.000 ou mais** devem ser bloqueadas para aprovação manual ' +
    '(`valorTransferencia >= 10000`).'
);
s('');
s(
  'Cada ato abaixo foi executado **neste run**, com Jest e Stryker reais. ' +
    'A saída completa de cada comando está no artefato `evidencia`.'
);
s('');
s('| Ato | Código | Testes | Ferramenta | Resultado |');
s('|---|---|---|---|---|');

const tableRows = [];
const acts = [];

function saveLog(name, content) {
  fs.writeFileSync(path.join(evidenceDir, name), content);
}

// ---------------------------------------------------------------------------
// ATO 1 — Falsa sensação de segurança: cobertura 100%, mutante sobrevive
// ---------------------------------------------------------------------------
try {
  fs.rmSync(mutationDir, { recursive: true, force: true });
  fs.rmSync(path.join(root, 'coverage'), { recursive: true, force: true });
  setState({ src: SRC_CORRETO, test: TEST_2 });

  const jest = run('npx jest --coverage');
  const stryker = run('npx stryker run');
  const mut = readMutationScore();

  saveLog('ato1-jest.log', jest.out);
  saveLog('ato1-stryker.log', stryker.out);

  // Publica o relatório interativo deste ato no site do Pages.
  const dest = path.join(pagesDir, 'ato1-mutante-sobrevive');
  fs.cpSync(mutationDir, dest, { recursive: true });

  const survivedList = (mut ? mut.survived : [])
    .map((m) => `- \`${m.file}:${m.location.start.line}\` — **${m.mutatorName}**: \`${m.replacement}\``)
    .join('\n');

  acts.push({
    title: 'Ato 1 — Falsa sensação de segurança',
    body: [
      '**Estado:** código correto (`>=`) · apenas 2 testes (R$ 5.000 e R$ 15.000).',
      '',
      `**Jest:** ${jest.code === 0 ? '✅ passou' : '❌ falhou'} — cobertura de linhas **100%**.`,
      `**Stryker:** mutation score **${mut ? mut.score.toFixed(2) : '?'}%** ` +
        `(${mut ? mut.killed : '?'}/${mut ? mut.total : '?'} mortos, ` +
        `**${mut ? (mut.byStatus.Survived || 0) : '?'} sobrevivente(s)**).`,
      '',
      '> A esteira fica verde e a cobertura bate 100%, mas o mutante que ' +
        'troca `>=` por `>` **sobrevive** — nenhum teste exercita a borda ' +
        'exata dos R$ 10.000. É o detector de fumaça na parede que não dispara.',
      '',
      '**Mutante(s) sobrevivente(s):**',
      '',
      survivedList || '_(nenhum)_',
      '',
      '<details><summary>Saída do Stryker (trecho)</summary>',
      '',
      '```',
      tail(stryker.out, 22),
      '```',
      '',
      '</details>',
    ].join('\n'),
  });

  tableRows.push(
    `| 1 · Falsa segurança | correto \`>=\` | 2 | Jest + Stryker | ✅ cobertura 100% · ⚠️ mutante sobrevive (${mut ? mut.score.toFixed(2) : '?'}%) |`
  );
} catch (err) {
  acts.push({ title: 'Ato 1', body: '❌ Erro ao executar: ' + err.message });
}

// ---------------------------------------------------------------------------
// ATO 2 — O bug real em produção passa despercebido
// ---------------------------------------------------------------------------
try {
  setState({ src: SRC_BUG, test: TEST_2 });
  const jest = run('npx jest');
  saveLog('ato2-jest.log', jest.out);

  acts.push({
    title: 'Ato 2 — O bug em produção, silencioso',
    body: [
      '**Estado:** código **com o bug** (`>`) · apenas 2 testes.',
      '',
      `**Jest:** ${jest.code === 0 ? '✅ **passou** (todos os testes verdes)' : '❌ falhou'}.`,
      '',
      '> Este é o vazamento silencioso: o código foi para produção com a ' +
        'regra quebrada e a suíte **continua verde**. Uma transferência de ' +
        'exatamente R$ 10.000 passa direto pela trava e nenhum teste percebe.',
      '',
      '<details><summary>Saída do Jest (trecho)</summary>',
      '',
      '```',
      tail(jest.out, 18),
      '```',
      '',
      '</details>',
    ].join('\n'),
  });

  tableRows.push(
    `| 2 · Bug silencioso | **bug** \`>\` | 2 | Jest | ${jest.code === 0 ? '✅ passa — defeito não detectado' : '❌ falhou'} |`
  );
} catch (err) {
  acts.push({ title: 'Ato 2', body: '❌ Erro ao executar: ' + err.message });
}

// ---------------------------------------------------------------------------
// ATO 3 — Um teste de borda pega a regressão
// ---------------------------------------------------------------------------
try {
  setState({ src: SRC_BUG, test: TEST_3 });
  const jest = run('npx jest');
  saveLog('ato3-jest.log', jest.out);

  acts.push({
    title: 'Ato 3 — O teste de borda pega a regressão',
    body: [
      '**Estado:** código **com o bug** (`>`) · 3 testes (inclui a borda R$ 10.000).',
      '',
      `**Jest:** ${jest.code !== 0 ? '❌ **falhou** no Teste 3 — regressão detectada' : '✅ passou (inesperado)'}.`,
      '',
      '> Com o teste de borda no lugar, o mesmo bug do Ato 2 é **barrado ' +
        'antes de produção**. Se uma IA ou um dev alterar/remover a cláusula ' +
        'de proteção por engano, este teste transforma o defeito silencioso ' +
        'numa falha ruidosa na esteira.',
      '',
      '<details><summary>Saída do Jest (trecho)</summary>',
      '',
      '```',
      tail(jest.out, 22),
      '```',
      '',
      '</details>',
    ].join('\n'),
  });

  tableRows.push(
    `| 3 · Regressão detectada | **bug** \`>\` | 3 | Jest | ${jest.code !== 0 ? '❌ falha no Teste 3 — defeito barrado' : '✅ passou (inesperado)'} |`
  );
} catch (err) {
  acts.push({ title: 'Ato 3', body: '❌ Erro ao executar: ' + err.message });
}

// ---------------------------------------------------------------------------
// ATO 4 — Cenário corrigido: cobertura 100% E mutação 100%
// ---------------------------------------------------------------------------
try {
  fs.rmSync(mutationDir, { recursive: true, force: true });
  fs.rmSync(path.join(root, 'coverage'), { recursive: true, force: true });
  restoreCanonical();

  const jest = run('npx jest --coverage');
  const stryker = run('npx stryker run');
  const mut = readMutationScore();

  saveLog('ato4-jest.log', jest.out);
  saveLog('ato4-stryker.log', stryker.out);

  const dest = path.join(pagesDir, 'ato4-corrigido');
  fs.cpSync(mutationDir, dest, { recursive: true });

  acts.push({
    title: 'Ato 4 — Corrigido e blindado',
    body: [
      '**Estado:** código correto (`>=`) · 3 testes.',
      '',
      `**Jest:** ${jest.code === 0 ? '✅ passou' : '❌ falhou'} — cobertura de linhas **100%**.`,
      `**Stryker:** mutation score **${mut ? mut.score.toFixed(2) : '?'}%** ` +
        `(${mut ? mut.killed : '?'}/${mut ? mut.total : '?'} mortos, ` +
        `**${mut ? (mut.byStatus.Survived || 0) : '?'} sobrevivente(s)**).`,
      '',
      '> Agora sim: cobertura **e** mutação em 100%. Não é só que o código ' +
        'foi tocado — é que qualquer alteração na regra faz pelo menos um ' +
        'teste falhar.',
      '',
      '<details><summary>Saída do Stryker (trecho)</summary>',
      '',
      '```',
      tail(stryker.out, 22),
      '```',
      '',
      '</details>',
    ].join('\n'),
  });

  tableRows.push(
    `| 4 · Corrigido | correto \`>=\` | 3 | Jest + Stryker | ✅ cobertura 100% · ✅ mutação ${mut ? mut.score.toFixed(2) : '?'}% |`
  );
} catch (err) {
  acts.push({ title: 'Ato 4', body: '❌ Erro ao executar: ' + err.message });
} finally {
  // Deixa a árvore de trabalho no estado canônico, aconteça o que acontecer.
  restoreCanonical();
}

// --- Monta o Job Summary ---------------------------------------------------
for (const row of tableRows) s(row);
s('');
for (const act of acts) {
  s(`## ${act.title}`);
  s('');
  s(act.body);
  s('');
}
s('---');
s('');
s(
  'Relatórios interativos (linha a linha) do Ato 1 e do Ato 4 publicados no ' +
    'GitHub Pages. Logs completos de cada comando no artefato `evidencia`.'
);

const summaryText = summary.join('\n') + '\n';
fs.writeFileSync(path.join(evidenceDir, 'RESUMO.md'), summaryText);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryText);
}

// --- Landing page do GitHub Pages -----------------------------------------
const pagesIndex = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>O Vazamento Silencioso — evidência</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         max-width: 780px; margin: 0 auto; padding: 2rem 1.25rem; line-height: 1.6; }
  h1 { margin-bottom: .25rem; }
  .sub { opacity: .7; margin-top: 0; }
  .card { border: 1px solid rgba(128,128,128,.35); border-radius: 12px;
          padding: 1rem 1.25rem; margin: 1rem 0; }
  .bad { color: #c0392b; font-weight: 600; }
  .good { color: #1e8e4e; font-weight: 600; }
  a.btn { display: inline-block; margin-top: .5rem; }
  code { background: rgba(128,128,128,.15); padding: .1rem .35rem; border-radius: 4px; }
</style>
</head>
<body>
  <h1>O Vazamento Silencioso</h1>
  <p class="sub">100% de cobertura não é 100% de proteção. Evidência gerada pela pipeline de CI.</p>

  <div class="card">
    <h2>Ato 1 — Falsa sensação de segurança</h2>
    <p>Código correto (<code>&gt;=</code>), apenas 2 testes. Cobertura
       <span class="good">100%</span>, mas o mutante <code>&gt;</code>
       <span class="bad">sobrevive</span>.</p>
    <a class="btn" href="./ato1-mutante-sobrevive/index.html">Ver relatório de mutação →</a>
  </div>

  <div class="card">
    <h2>Ato 4 — Corrigido e blindado</h2>
    <p>Código correto (<code>&gt;=</code>), 3 testes (com a borda R$ 10.000).
       Cobertura <span class="good">100%</span> e mutação
       <span class="good">100%</span>.</p>
    <a class="btn" href="./ato4-corrigido/index.html">Ver relatório de mutação →</a>
  </div>

  <p>Atos 2 (bug silencioso em produção) e 3 (regressão detectada pelo teste
     de borda) estão no <strong>Job Summary</strong> do run e no artefato
     <code>evidencia</code>, com a saída real do Jest.</p>

  <p><a href="https://github.com/antoniogeroncio/demo-mutation">← Repositório</a></p>
</body>
</html>
`;
fs.writeFileSync(path.join(pagesDir, 'index.html'), pagesIndex);

console.log(summaryText);
console.log('\nEvidência gravada em reports/evidence/ e reports/pages/.');
