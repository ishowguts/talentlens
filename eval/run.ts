// Scores every labeled query in all three modes and writes eval/results.md.
// Usage: pnpm eval [--human]
//   default  relevance from the automated judge (eval/judge-labels.jsonl), all 50 queries
//   --human  relevance from the owner's hand labels in eval/queries.jsonl only
import { writeFileSync } from 'node:fs';
import type { SearchMode } from 'shared';
import { loadJudgeLabels } from './judge.js';
import { agreement, kappaLabel, ndcgAt, precisionAt, recallAt, reciprocalRankAt } from './metrics.js';
import {
  contentHashes,
  embedder,
  gitCommit,
  loadQueries,
  MODES,
  openDatabase,
  RESULTS_PATH,
  runMode,
  type QueryGroup,
} from './lib.js';

/** Metrics are computed at 10, the number of results a user actually looks at. */
const K = 10;

/**
 * The kappa an automated label set must reach before its numbers may be quoted as results. 0.6 is the
 * conventional boundary of "substantial" agreement. Raw agreement is not a usable bar: when nearly every
 * pooled job is called relevant, agreement is near-automatic while kappa stays at zero.
 */
const KAPPA_PUBLISHABLE = 0.6;

interface ModeStats {
  recall: number[];
  precision: number[];
  ndcg: number[];
  mrr: number[];
  latencies: number[];
}

const emptyStats = (): ModeStats => ({ recall: [], precision: [], ndcg: [], mrr: [], latencies: [] });

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

const format = (value: number, digits = 3) => value.toFixed(digits);

const useHuman = process.argv.includes('--human');
const { db, close } = openDatabase();
const deps = { db, embedder: embedder() };

try {
  // Load the model before timing anything: otherwise whichever mode runs first pays for it.
  await deps.embedder.warm();

  const queries = loadQueries();
  const judged = loadJudgeLabels();
  const source = useHuman ? 'human' : judged.size > 0 ? 'judge' : 'human';

  /** The relevant content hashes for a query, from whichever label set is in use. */
  const relevantFor = (id: string): Set<string> => {
    if (source === 'human') {
      return new Set(queries.find((query) => query.id === id)?.relevant ?? []);
    }
    const labels = judged.get(id)?.labels ?? {};
    return new Set(
      Object.entries(labels)
        .filter(([, isRelevant]) => isRelevant)
        .map(([hash]) => hash),
    );
  };

  const scored = queries.filter((query) => relevantFor(query.id).size > 0);
  const stats = new Map<SearchMode, ModeStats>(MODES.map((mode) => [mode, emptyStats()]));
  const byGroup = new Map<QueryGroup, Map<SearchMode, { recall: number[]; ndcg: number[] }>>();

  // Latency is measured over every query; quality only over the ones that have labels.
  for (const query of queries) {
    const relevant = relevantFor(query.id);
    for (const mode of MODES) {
      const { results, ms } = await runMode(deps, mode, query.query);
      const modeStats = stats.get(mode)!;
      modeStats.latencies.push(ms);
      if (relevant.size === 0) continue;

      const top = results.slice(0, K);
      const hashes = await contentHashes(
        db,
        top.map((result) => result.job.id),
      );
      const retrieved = top.map((result) => hashes.get(result.job.id) ?? '');

      modeStats.recall.push(recallAt(retrieved, relevant, K));
      modeStats.precision.push(precisionAt(retrieved, relevant, K));
      modeStats.ndcg.push(ndcgAt(retrieved, relevant, K));
      modeStats.mrr.push(reciprocalRankAt(retrieved, relevant, K));

      const group = byGroup.get(query.group) ?? new Map();
      const entry = group.get(mode) ?? { recall: [], ndcg: [] };
      entry.recall.push(recallAt(retrieved, relevant, K));
      entry.ndcg.push(ndcgAt(retrieved, relevant, K));
      group.set(mode, entry);
      byGroup.set(query.group, group);
    }
    console.log(`eval: ${query.id} done`);
  }

  // Judge against human, on the queries the owner labeled by hand and the judge also covered.
  const validationIds = queries
    .filter((query) => query.relevant.length > 0 && judged.has(query.id))
    .map((query) => query.id);
  const pairs: Array<{ human: boolean; judge: boolean }> = [];
  let humanOutsidePool = 0;
  for (const id of validationIds) {
    const human = new Set(queries.find((query) => query.id === id)!.relevant);
    const labels = judged.get(id)!.labels;
    for (const [hash, isRelevant] of Object.entries(labels)) {
      pairs.push({ human: human.has(hash), judge: isRelevant });
    }
    for (const hash of human) if (!(hash in labels)) humanOutsidePool += 1;
  }
  const consensus = agreement(pairs);

  const commit = gitCommit();
  const passed = consensus.n > 0 && consensus.kappa >= KAPPA_PUBLISHABLE;
  const agreementText =
    `${(consensus.observed * 100).toFixed(1)}% raw agreement, Cohen's kappa ${format(consensus.kappa)} ` +
    `(${kappaLabel(consensus.kappa)})`;
  const method =
    source === 'human'
      ? 'labels by hand, by the repository owner'
      : passed
        ? `labels by an automated Gemini relevance judge, validated against the owner's hand labels on ` +
          `${validationIds.length} queries (${agreementText})`
        : `labels by an automated Gemini relevance judge, **not validated**: checked against the owner's hand ` +
          `labels on ${validationIds.length} queries and rejected (${agreementText}, below the ` +
          `${KAPPA_PUBLISHABLE} kappa required to quote these numbers as results)`;

  const lines: string[] = [
    '# TalentLens — Evaluation results',
    '',
    `Generated by \`pnpm eval\` at commit \`${commit}\` on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    `Method: ${method}.`,
    `Queries scored: ${scored.length} of ${queries.length}. Metrics at k = ${K}. Latency over all ${queries.length}.`,
    ...(passed
      ? []
      : [
          '',
          '> **The quality numbers below are not a result.** The label set behind them did not pass validation,',
          '> so they describe the labels, not the search engine. Latency is unaffected and is measured directly.',
        ]),
    '',
    '| Mode | Recall@10 | Precision@10 | nDCG@10 | MRR@10 | mean latency | p50 latency |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const mode of MODES) {
    const s = stats.get(mode)!;
    lines.push(
      `| ${mode} | ${format(mean(s.recall))} | ${format(mean(s.precision))} | ${format(mean(s.ndcg))} | ` +
        `${format(mean(s.mrr))} | ${format(mean(s.latencies), 1)} ms | ${format(percentile(s.latencies, 50), 1)} ms |`,
    );
  }

  if (byGroup.size > 0) {
    lines.push(
      '',
      '## By query type',
      '',
      `| Query type | ${MODES.map((m) => `${m} recall / nDCG`).join(' | ')} |`,
    );
    lines.push(`| --- |${MODES.map(() => ' --- |').join('')}`);
    for (const [group, modes] of byGroup) {
      const cells = MODES.map((mode) => {
        const entry = modes.get(mode) ?? { recall: [], ndcg: [] };
        return `${format(mean(entry.recall))} / ${format(mean(entry.ndcg))}`;
      });
      lines.push(`| ${group} | ${cells.join(' | ')} |`);
    }
  }

  if (source === 'judge' && consensus.n > 0) {
    const judgeRelevant = consensus.bothRelevant + consensus.judgeOnly;
    const humanRelevant = consensus.bothRelevant + consensus.humanOnly;
    lines.push(
      '',
      '## Judge validation',
      '',
      `The owner labeled ${validationIds.length} queries by hand (${validationIds.join(', ')}). Those labels are`,
      'never used for the headline metrics above; they exist only to check the judge.',
      '',
      `| Measure | Value |`,
      `| --- | --- |`,
      `| Jobs labeled by both | ${consensus.n} |`,
      `| Raw agreement | ${(consensus.observed * 100).toFixed(1)}% |`,
      `| Cohen's kappa | ${format(consensus.kappa)} (${kappaLabel(consensus.kappa)}) |`,
      `| Both relevant | ${consensus.bothRelevant} |`,
      `| Both not relevant | ${consensus.bothNot} |`,
      `| Owner relevant, judge not | ${consensus.humanOnly} |`,
      `| Judge relevant, owner not | ${consensus.judgeOnly} |`,
      `| Relevant share, owner vs judge | ${((humanRelevant / consensus.n) * 100).toFixed(1)}% vs ${((judgeRelevant / consensus.n) * 100).toFixed(1)}% |`,
      ...(humanOutsidePool > 0
        ? [
            '',
            `${humanOutsidePool} jobs the owner marked relevant are not in the judged pool, so they are excluded`,
            'from the comparison. Pools are recomputed per run and the ranking can shift slightly.',
          ]
        : []),
    );
  }

  lines.push(
    '',
    '## How to read these numbers',
    '',
    'Relevance is pooled: only the top 20 from each mode was ever labeled, so a job outside every pool counts as',
    'not relevant. Pooling enriches the set with relevant jobs, so Recall@10 is bounded by 10 divided by the',
    'number of relevant jobs found for that query, and it saturates once a pool is mostly relevant. Precision@10',
    'and nDCG@10 are the figures that separate the modes, because they care where in the ten results the',
    'relevant jobs land.',
    '',
  );

  writeFileSync(RESULTS_PATH, `${lines.join('\n')}\n`);
  console.log(`\n${lines.slice(6).join('\n')}`);
  console.log(`eval: wrote ${RESULTS_PATH}`);
} finally {
  await close();
}
