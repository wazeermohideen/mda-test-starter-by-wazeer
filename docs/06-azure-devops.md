# Azure DevOps Integration

Run your Playwright tests in an Azure DevOps pipeline, publish results to the native test dashboard, and automatically create Bug work items when accessibility violations are found — with a manual approval step so your team can review before any bugs are created.

---

## What's Already Set Up

| Feature | Status |
|---|---|
| JUnit XML test results | Ready — `test-results/junit.xml` is written on every CI run |
| Allure results | Ready — `allure-results/` is written on every run |
| Accessibility violation files | Ready — written per test to `test-results/artifacts/` |
| ADO Bug creation script | Ready — `npm run report:a11y` |
| Manual approval before bug creation | Ready — pipeline pauses for human review |
| Suppression list for unfixable violations | Ready — `suppressedViolations` in `qa.config.json` |

---

## Pipeline Overview

```
Install → Authenticate → Run Tests → Publish Results
       → Check Violations → [Manual Approval] → Create Bugs
```

The approval step **only appears when actionable violations exist** (i.e. violations not in your suppression list). If all violations are suppressed, or no violations were found, the pipeline finishes automatically with no interruption.

---

## Required Pipeline Variables

Set these as **secret variables** in your Azure DevOps pipeline (not in source code):

| Variable | Where to get it | Used by |
|---|---|---|
| `MODEL_DRIVEN_APP_URL` | Your MDA browser URL including `?appid=` | Tests |
| `MS_AUTH_EMAIL` | Your service account email | Authentication |
| `ADO_ORG_URL` | `https://dev.azure.com/your-org` | `report:a11y` script |
| `ADO_PROJECT` | Your ADO project name | `report:a11y` script |
| `ADO_PAT` | Personal Access Token — see below | `report:a11y` script |

### Creating the ADO Personal Access Token (PAT)

1. Go to **Azure DevOps → User Settings → Personal Access Tokens**
2. Click **New Token**
3. Set **Scopes** → **Work Items** → check **Read & write**
4. Copy the token and save it as the `ADO_PAT` pipeline variable (mark it as secret)

> Never commit a PAT to source control. Always store it as a secret pipeline variable.

---

## Full Pipeline YAML

Save this as `azure-pipelines.yml` at the root of your repository:

```yaml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

variables:
  - group: playwright-secrets  # variable group with MODEL_DRIVEN_APP_URL,
                               # MS_AUTH_EMAIL, ADO_ORG_URL, ADO_PROJECT, ADO_PAT

steps:
  # ── 1. Node setup ────────────────────────────────────────────────────────────
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  # ── 2. Install dependencies ───────────────────────────────────────────────────
  - script: npm ci
    displayName: 'Install npm dependencies'

  - script: npm run install:browsers
    displayName: 'Install Playwright browsers'

  # ── 3. Authenticate (save session to disk) ────────────────────────────────────
  # Uses a service account — no interactive MFA.
  # Set up certificate auth (Method 2/3 in the README) for CI.
  - script: npm run auth:mda
    displayName: 'Authenticate MDA session'
    env:
      MODEL_DRIVEN_APP_URL: $(MODEL_DRIVEN_APP_URL)
      MS_AUTH_EMAIL:        $(MS_AUTH_EMAIL)

  # ── 4. Run tests ──────────────────────────────────────────────────────────────
  - script: npm test
    displayName: 'Run Playwright tests'
    env:
      MODEL_DRIVEN_APP_URL: $(MODEL_DRIVEN_APP_URL)
      MS_AUTH_EMAIL:        $(MS_AUTH_EMAIL)
      CI:                   'true'
      HEADLESS:             'true'
    continueOnError: true  # publish results even when tests fail

  # ── 5. Publish test results to ADO test dashboard ────────────────────────────
  - task: PublishTestResults@2
    displayName: 'Publish JUnit test results'
    inputs:
      testResultsFormat:     JUnit
      testResultsFiles:      test-results/junit.xml
      mergeTestResults:      true
      failTaskOnFailedTests: true
    condition: always()

  # ── 6. Upload Playwright HTML report as a pipeline artifact ──────────────────
  # Reviewers can download this to see full violation details before approving.
  - task: PublishPipelineArtifact@1
    displayName: 'Upload Playwright HTML report'
    inputs:
      targetPath: playwright-report
      artifact:   playwright-report
    condition: always()

  # ── 7. Check for actionable accessibility violations ─────────────────────────
  # Scans test-results/ for violation files, filters out suppressedViolations from
  # qa.config.json, and sets the pipeline variable `a11yViolationsFound=true` if
  # anything remains. The next two steps only run when that variable is set.
  - script: npm run report:a11y:check
    displayName: 'Check for actionable accessibility violations'
    name: a11yCheck
    condition: always()

  # ── 8. Manual approval ────────────────────────────────────────────────────────
  # Only triggers when actionable violations exist.
  # Reviewer downloads the 'playwright-report' artifact, checks which violations
  # are new vs already known, then approves or rejects.
  #
  # Approve → proceeds to create ADO Bug work items
  # Reject  → skips bug creation, pipeline finishes cleanly
  - task: ManualValidation@1
    displayName: 'Review accessibility violations — approve to create ADO bugs'
    condition: eq(variables['a11yViolationsFound'], 'true')
    inputs:
      notifyUsers: |
        $(Build.RequestedForEmail)
      instructions: |
        Accessibility violations were found in this test run.

        Before approving:
          1. Download the 'playwright-report' artifact from this pipeline run
          2. Open index.html in your browser
          3. Click any test → Attachments → 'Accessibility Report' to see the full violation list

        If violations are in Microsoft-owned MDA components and cannot be fixed,
        add their rule IDs to 'suppressedViolations' in qa.config.json instead of
        creating bugs for them.

        Approve  → creates one ADO Bug per unique violation rule
        Reject   → skips bug creation (no work items created this run)
      onTimeout: reject
      timeout:   1440  # auto-reject after 24 hours if no action taken

  # ── 9. Create ADO Bug work items ──────────────────────────────────────────────
  # Runs only after a reviewer approves step 8.
  - script: npm run report:a11y
    displayName: 'Create ADO bugs for accessibility violations'
    condition: eq(variables['a11yViolationsFound'], 'true')
    env:
      ADO_ORG_URL: $(ADO_ORG_URL)
      ADO_PROJECT: $(ADO_PROJECT)
      ADO_PAT:     $(ADO_PAT)
```

---

## Suppressing Violations You Cannot Fix

Model-Driven Apps include Microsoft-owned UI components (command bars, grids, dialogs) that may have accessibility violations your team has no control over. Rather than approving and rejecting the same bugs every run, add their rule IDs to `suppressedViolations` in `qa.config.json`:

```json
{
  "entity": { "logicalName": "cr123_myentity" },
  "users": ["Alice Johnson", "Bob Smith"],
  "domain": "generic",
  "suppressedViolations": [
    "color-contrast",
    "region"
  ]
}
```

**How it works:**
- `report:a11y:check` filters out suppressed rule IDs before checking if anything is actionable
- If all violations are suppressed, `a11yViolationsFound` is never set — the approval step is skipped entirely
- `report:a11y` also filters suppressions, so suppressed rules never become bugs even if approval is given

**Finding the rule ID** — run `npm test` and open the HTML report. Click the test → Attachments → `Accessibility Report`. The `id` field in the JSON is the value to add (e.g. `"color-contrast"`, `"button-name"`, `"landmark-one-main"`).

> `qa.config.json` is safe to commit — it contains configuration, not credentials. Your suppression list is version-controlled so the whole team benefits.

---

## How the Approval Step Works

When violations are found, Azure DevOps sends an email to the pipeline requester with a link to approve or reject.

**What the reviewer sees:**

```
Accessibility violations were found in this test run.

Before approving:
  1. Download the 'playwright-report' artifact from this pipeline run
  2. Open index.html in your browser
  3. Click any test → Attachments → 'Accessibility Report' to see the full violation list

If violations are in Microsoft-owned MDA components and cannot be fixed,
add their rule IDs to 'suppressedViolations' in qa.config.json instead of
creating bugs for them.

Approve  → creates one ADO Bug per unique violation rule
Reject   → skips bug creation (no work items created this run)
```

The approval times out after **24 hours** and auto-rejects if no action is taken.

---

## Accessibility Bug Work Items

When `npm run report:a11y` runs after approval, it:

1. Scans `test-results/` recursively for `a11y-violations.json` files
2. Filters out any rule IDs listed in `suppressedViolations`
3. Groups remaining violations by **rule ID** — the same rule in multiple tests creates only **one** Bug
4. Creates an ADO Bug for each with:
   - Title: `[Accessibility] [IMPACT] rule description`
   - Description: impact, rule ID, fix guidance link, affected tests
   - Priority: 2 (High)
   - Tags: `accessibility; automated-test`

### Example work item

**Title:** `[Accessibility] [SERIOUS] Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds`

**Description:**
```
Rule: color-contrast
Impact: serious
View fix guidance → https://dequeuniversity.com/rules/axe/4.10/color-contrast

Found in the following test(s):
  • create record
  • update record status
```

---

## Test Results in the ADO Dashboard

Once `PublishTestResults@2` runs, your results appear in **Azure DevOps → Pipelines → [your pipeline] → Tests**:

- Pass / fail counts per run
- Individual test names, durations, and failure messages
- Trend graph across pipeline runs
- Drill into a failed test to see the error and stack trace

The JUnit reporter outputs to `test-results/junit.xml` when the `CI` environment variable is set (see `playwright.config.ts`).

---

## Running Locally

```bash
# After running npm test, check what violations would trigger the approval:
npm run report:a11y:check

# If you want to create bugs manually (without the pipeline):
ADO_ORG_URL=https://dev.azure.com/your-org \
ADO_PROJECT=your-project \
ADO_PAT=your-pat \
npm run report:a11y
```

---

## Setting Up a Variable Group

Instead of setting pipeline variables one by one, use a variable group to share them across pipelines:

1. Go to **Pipelines → Library → + Variable group**
2. Name it `playwright-secrets`
3. Add each variable — mark `ADO_PAT` as secret (lock icon)
4. Reference it in your YAML with `- group: playwright-secrets`

---

## Tips

- **`continueOnError: true` on the test step** — without this, a failing test stops the pipeline before results are published or violations are checked.
- **`condition: always()`** — use on publish steps so they run regardless of test outcome.
- **Auto-reject on timeout** — `onTimeout: reject` means the pipeline won't hang forever if nobody reviews it. Adjust `timeout` (minutes) to match your team's response window.
- **Don't commit `.env`** — pipeline secrets go in ADO variable groups, not source files.
- **`qa.config.json` is safe to commit** — entity names, users, and suppressions are configuration, not credentials.
- **Duplicate bugs** — the script creates new bugs on every pipeline run where violations exist. If you run nightly, consider querying existing open bugs by tag before creating new ones (uses the ADO WIQL API — `POST /_apis/wit/wiql`).
