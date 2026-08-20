/**
 * Accessibility violation reporter for Azure DevOps.
 *
 * Two modes:
 *
 *   --check   Scans test-results/ for violations, prints a summary, and sets the
 *             ADO pipeline variable `a11yViolationsFound=true` if actionable violations
 *             exist. Used to conditionally trigger the ManualValidation approval step.
 *             Never creates work items. Always exits 0.
 *
 *   (default) Creates one ADO Bug work item per unique violation ID.
 *             Requires ADO_ORG_URL, ADO_PROJECT, and ADO_PAT env vars.
 *
 * Suppressions:
 *   Add axe rule IDs to `suppressedViolations` in qa.config.json to permanently
 *   skip violations that cannot be fixed (e.g. Microsoft-owned MDA components).
 *
 * Usage:
 *   npm run report:a11y:check   ← run after tests, before the approval step
 *   npm run report:a11y         ← run after approval to create ADO bugs
 */

import * as fs from 'fs';
import * as path from 'path';

interface A11yViolation {
  impact: string;
  id: string;
  description: string;
  helpUrl: string;
  nodes: number;
}

interface A11yReport {
  test: string;
  file: string;
  violations: A11yViolation[];
}

function findViolationFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findViolationFiles(full));
    else if (entry.name === 'a11y-violations.json') results.push(full);
  }
  return results;
}

function loadSuppressions(): string[] {
  try {
    const config = JSON.parse(fs.readFileSync('qa.config.json', 'utf-8'));
    return Array.isArray(config.suppressedViolations) ? config.suppressedViolations : [];
  } catch {
    return [];
  }
}

function collectViolations(suppressions: string[]): Map<string, { violation: A11yViolation; tests: string[] }> {
  const files = findViolationFiles('test-results');
  const byId  = new Map<string, { violation: A11yViolation; tests: string[] }>();

  for (const file of files) {
    const report: A11yReport = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const v of report.violations) {
      if (suppressions.includes(v.id)) continue;
      const existing = byId.get(v.id);
      if (existing) {
        if (!existing.tests.includes(report.test)) existing.tests.push(report.test);
      } else {
        byId.set(v.id, { violation: v, tests: [report.test] });
      }
    }
  }

  return byId;
}

async function createAdoBug(title: string, description: string): Promise<number> {
  const orgUrl  = process.env.ADO_ORG_URL!;
  const project = process.env.ADO_PROJECT!;
  const pat     = process.env.ADO_PAT!;
  const token   = Buffer.from(`:${pat}`).toString('base64');

  const res = await fetch(
    `${orgUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$Bug?api-version=7.1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json',
        'Authorization': `Basic ${token}`,
      },
      body: JSON.stringify([
        { op: 'add', path: '/fields/System.Title',                   value: title },
        { op: 'add', path: '/fields/System.Description',             value: description },
        { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: 2 },
        { op: 'add', path: '/fields/System.Tags',                    value: 'accessibility; automated-test' },
      ]),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ADO API error ${res.status}: ${body}`);
  }

  return ((await res.json()) as { id: number }).id;
}

// ── Check mode ────────────────────────────────────────────────────────────────

function runCheck() {
  const suppressions = loadSuppressions();
  const byId         = collectViolations(suppressions);

  if (!byId.size) {
    console.log('No actionable accessibility violations found.');
    return;
  }

  console.log(`\nAccessibility violations found (${byId.size} unique rule(s)):\n`);
  for (const [id, { violation, tests }] of byId) {
    const impact = (violation.impact ?? 'unknown').toUpperCase();
    console.log(`  [${impact}] ${id}`);
    console.log(`    ${violation.description}`);
    console.log(`    Tests affected: ${tests.join(', ')}\n`);
  }

  if (suppressions.length) {
    console.log(`  (${suppressions.length} suppressed rule(s) hidden: ${suppressions.join(', ')})\n`);
  }

  // Signal to the ADO pipeline that approval is needed.
  // ManualValidation step is conditioned on this variable.
  console.log('##vso[task.setvariable variable=a11yViolationsFound]true');
}

// ── Create mode ───────────────────────────────────────────────────────────────

async function runCreate() {
  const missing = ['ADO_ORG_URL', 'ADO_PROJECT', 'ADO_PAT'].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Add them to your .env file or pipeline variables.');
    process.exit(1);
  }

  const suppressions = loadSuppressions();
  const byId         = collectViolations(suppressions);

  if (!byId.size) {
    console.log('No actionable accessibility violations — nothing to report.');
    return;
  }

  console.log(`\nCreating ADO bugs for ${byId.size} unique violation(s)...\n`);

  let created = 0;
  for (const [id, { violation, tests }] of byId) {
    const impact = (violation.impact ?? 'unknown').toUpperCase();
    const title  = `[Accessibility] [${impact}] ${violation.description}`;

    const description = `
      <h3>Rule: <code>${id}</code></h3>
      <p><strong>Impact:</strong> ${violation.impact}</p>
      <p><strong>Description:</strong> ${violation.description}</p>
      <p><a href="${violation.helpUrl}">View fix guidance →</a></p>
      <h4>Found in the following test(s):</h4>
      <ul>${tests.map(t => `<li>${t}</li>`).join('\n')}</ul>
      <p><em>Created automatically by the Playwright accessibility reporter.</em></p>
    `.trim();

    try {
      const bugId = await createAdoBug(title, description);
      console.log(`  Created Bug #${bugId}: [${impact}] ${id}`);
      created++;
    } catch (err) {
      console.error(`  Failed to create work item for "${id}": ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. ${created} work item(s) created.`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (process.argv.includes('--check')) {
  runCheck();
} else {
  runCreate().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
