const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const coverageSummaryPath = path.join(root, 'coverage', 'coverage-summary.json');
const mutationReportPath = path.join(root, 'reports', 'mutation', 'mutation.json');

function pct(n) {
  return `${n.toFixed(2)}%`;
}

function readCoverage() {
  if (!fs.existsSync(coverageSummaryPath)) return null;
  const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
  return summary.total;
}

function readMutation() {
  if (!fs.existsSync(mutationReportPath)) return null;
  const report = JSON.parse(fs.readFileSync(mutationReportPath, 'utf8'));
  const mutants = Object.entries(report.files).flatMap(([file, data]) =>
    data.mutants.map((m) => ({ ...m, file }))
  );
  const byStatus = mutants.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  const killed = (byStatus.Killed || 0) + (byStatus.Timeout || 0);
  const score = mutants.length ? (killed / mutants.length) * 100 : 0;
  return { mutants, byStatus, score };
}

const coverage = readCoverage();
const mutation = readMutation();

const lines = [];

lines.push('# O Vazamento Silencioso — resultados do demo');
lines.push('');
lines.push(
  'Este repositório demonstra que **100% de cobertura de testes não é o ' +
    'mesmo que 100% de proteção**. A regra de negócio é uma trava ' +
    'antifraude: transferências de risco de R$ 10.000 ou mais devem ser ' +
    'bloqueadas para aprovação manual (`valorTransferencia >= 10000`).'
);
lines.push('');
lines.push(
  'A suíte de testes cobre 100% das linhas do código. Mas isso, sozinho, ' +
    'não garante que a regra está correta — [mutation testing]' +
    '(https://stryker-mutator.io/) prova isso alterando o código de ' +
    'propósito (ex.: trocando `>=` por `>`) e verificando se algum teste ' +
    'percebe.'
);
lines.push('');

if (coverage) {
  lines.push('## Cobertura de linhas (Jest)');
  lines.push('');
  lines.push('| Métrica | Cobertura |');
  lines.push('|---|---|');
  lines.push(`| Statements | ${pct(coverage.statements.pct)} |`);
  lines.push(`| Branches | ${pct(coverage.branches.pct)} |`);
  lines.push(`| Functions | ${pct(coverage.functions.pct)} |`);
  lines.push(`| Lines | ${pct(coverage.lines.pct)} |`);
  lines.push('');
}

if (mutation) {
  const total = mutation.mutants.length;
  const killed = mutation.byStatus.Killed || 0;
  const survived = mutation.byStatus.Survived || 0;
  const timeout = mutation.byStatus.Timeout || 0;
  const noCoverage = mutation.byStatus.NoCoverage || 0;

  lines.push('## Mutation testing (Stryker)');
  lines.push('');
  lines.push(`**Mutation score: ${pct(mutation.score)}** (${killed + timeout}/${total} mutantes mortos)`);
  lines.push('');
  lines.push('| Status | Quantidade |');
  lines.push('|---|---|');
  lines.push(`| ✅ Killed | ${killed} |`);
  lines.push(`| ⏱️ Timeout | ${timeout} |`);
  lines.push(`| ❌ Survived | ${survived} |`);
  lines.push(`| ⚪ No coverage | ${noCoverage} |`);
  lines.push(`| **Total** | **${total}** |`);
  lines.push('');

  if (survived > 0) {
    lines.push('### ⚠️ Mutantes sobreviventes');
    lines.push('');
    lines.push(
      'Cobertura de linha não garante que a regra está protegida. Estes ' +
        'mutantes sobreviveram mesmo com 100% de cobertura:'
    );
    lines.push('');
    for (const m of mutation.mutants.filter((x) => x.status === 'Survived')) {
      lines.push(
        `- \`${m.file}:${m.location.start.line}\` — **${m.mutatorName}**: \`${m.replacement}\``
      );
    }
    lines.push('');
  } else {
    lines.push(
      '**Nenhum mutante sobreviveu.** Todos os cenários críticos, ' +
        'inclusive a borda exata dos R$ 10.000, estão cobertos por um ' +
        'teste que falharia se a regra fosse quebrada.'
    );
    lines.push('');
  }

  lines.push('Relatório interativo completo (linha a linha): veja o artefato `mutation-report` deste run, ou a versão publicada no GitHub Pages, se configurado.');
  lines.push('');
} else {
  lines.push('_Relatório de mutation testing não encontrado — rode `npm run test:mutation` antes deste script._');
  lines.push('');
}

const output = lines.join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output + '\n');
}

console.log(output);
