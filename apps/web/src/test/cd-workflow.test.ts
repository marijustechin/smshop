import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the automatic staging-deployment gate in `.github/workflows/ci.yml`.
 * These are workflow-logic tests: they assert the trigger, dependency, secret,
 * SSH-pinning and no-rebuild properties that cannot be exercised without a live
 * deploy. Live behaviour is verified by an actual workflow run.
 */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(path.join(dir, 'docker', 'web.Dockerfile'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('could not locate the repository root from the test working directory');
}

const repoRoot = findRepoRoot(process.cwd());
const workflow = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

function job(name: string, next?: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  if (start === -1) return '';
  const end = next ? workflow.indexOf(`\n  ${next}:\n`, start) : -1;
  return workflow.slice(start, end === -1 ? undefined : end);
}

const deploy = job('deploy');
const changes = job('changes', 'workflow');

describe('Staging deployment gate', () => {
  it('runs only after every verification, publication and manifest job', () => {
    expect(deploy).toMatch(/needs:\s*\[changes, workflow, verify, build, release\]/);
  });

  it('is restricted to main pushes and manual dispatch, never pull requests', () => {
    expect(deploy).toContain("github.event_name == 'push'");
    expect(deploy).toContain("github.ref == 'refs/heads/main'");
    expect(deploy).toContain('workflow_dispatch');
    expect(deploy).not.toContain('pull_request');
  });

  it('uses the staging environment and serializes without cancelling in-flight work', () => {
    expect(deploy).toMatch(/environment:\n\s*name:\s*staging/);
    expect(deploy).toMatch(/concurrency:\n(?:\s*.*\n)*?\s*cancel-in-progress:\s*false/);
  });

  it('detects documentation-only changes so they do not auto-deploy', () => {
    expect(changes).toContain('runtime');
    expect(changes).toContain('*.md');
    expect(changes).toContain('docs/');
  });

  it('uses a dedicated deploy key from the staging environment, never the developer key', () => {
    expect(deploy).toContain('secrets.DEPLOY_SSH_KEY');
    expect(workflow).not.toContain('id_ed25519_oracle');
  });

  it('pins a verified host key and never disables host checking or blind-scans', () => {
    expect(deploy).toContain('StrictHostKeyChecking=yes');
    expect(workflow).not.toContain('StrictHostKeyChecking=no');
    expect(workflow).not.toMatch(/ssh-keyscan/);
    expect(deploy).toContain('ssh-ed25519');
    expect(deploy).toContain('sokoladas.eu');
  });

  it('rejects stale runs against the current main tip', () => {
    expect(deploy).toContain('stale');
    expect(deploy).toContain('/commits/main');
  });

  it('stages/releases/statuses through the restricted entry point without rebuilding', () => {
    expect(deploy).toContain('sokoladas-deploy stage');
    expect(deploy).toContain('sokoladas-deploy release');
    expect(deploy).toContain('sokoladas-deploy status');
    expect(deploy).not.toContain('build-push-action');
    expect(workflow.match(/build-push-action/g) ?? []).toHaveLength(1);
  });

  it('verifies live health after releasing', () => {
    expect(deploy).toContain('https://sokoladas.eu');
    expect(deploy).toContain('/health/ready');
  });

  it('skips gracefully with a READY marker while the deploy secret is unconfigured', () => {
    expect(deploy).toContain('configured');
    expect(deploy).toContain('READY_FOR_DEPLOYMENT_CONFIGURATION');
  });
});
