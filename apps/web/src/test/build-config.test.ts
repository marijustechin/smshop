import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the Turnstile build-time wiring: the public site key must be accepted
 * by the web image and supplied to the web build from a GitHub Actions variable
 * (never a secret), and the web build must fail loudly when it is unset.
 *
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is inlined by Next.js at build time, so this
 * can only be verified against the build configuration, not at runtime.
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
const dockerfile = readFileSync(path.join(repoRoot, 'docker', 'web.Dockerfile'), 'utf8');
const workflow = readFileSync(path.join(repoRoot, '.github', 'workflows', 'images.yml'), 'utf8');

describe('Turnstile build configuration', () => {
  it('declares and exposes the public site key build arg in the web image', () => {
    expect(dockerfile).toContain('ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=');
  });

  it('does not bake a Turnstile secret into the web build configuration', () => {
    expect(dockerfile.toLowerCase()).not.toContain('turnstile_secret');
    expect(workflow.toLowerCase()).not.toContain('turnstile_secret');
  });

  it('supplies the site key to the web build from a repository variable', () => {
    expect(workflow).toContain('vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    expect(workflow).toContain('build-args');
    expect(workflow).toContain('NEXT_PUBLIC_TURNSTILE_SITE_KEY=');
  });

  it('fails the web build loudly when the variable is unset', () => {
    expect(workflow).toContain('Require public Turnstile site key (web)');
    expect(workflow).toContain("matrix.name == 'web'");
    expect(workflow).toContain('Refusing to publish a web image with Turnstile disabled');
  });
});
