import { execFileSync } from 'node:child_process';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTheme } from './generate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'src');
const SOURCE_EXTENSION = /\.(?:pug|scss|ts)$/i;

export class BuildScheduler {
  #running = false;
  #pending = false;
  readonly #build: () => Promise<void>;
  readonly #report: (message: string) => void;

  constructor(build: () => Promise<void>, report: (message: string) => void = console.log) {
    this.#build = build;
    this.#report = report;
  }

  trigger(filename = 'source change'): void {
    this.#pending = true;
    this.#report(`Change detected: ${filename}`);
    if (!this.#running) void this.#drain();
  }

  async idle(): Promise<void> {
    while (this.#running || this.#pending) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async #drain(): Promise<void> {
    this.#running = true;
    while (this.#pending) {
      this.#pending = false;
      try { await this.#build(); this.#report('Generated dist/theme.xml.'); }
      catch (error) { this.#report(`Generation failed: ${error instanceof Error ? error.message : String(error)}`); }
    }
    this.#running = false;
  }
}

export interface ThemeWatcher { close(): void }

export function createThemeWatcher(
  scheduler: BuildScheduler,
  watchFactory: typeof watch = watch
): ThemeWatcher {
  const watcher: FSWatcher = watchFactory(SOURCE, { recursive: true }, (_event, filename) => {
    const changed = filename?.toString() ?? '';
    if (SOURCE_EXTENSION.test(changed)) scheduler.trigger(changed);
  });
  return { close: () => watcher.close() };
}

function currentSha(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scheduler = new BuildScheduler(async () => { await generateTheme({ sha: currentSha() }); });
  await generateTheme({ sha: currentSha() });
  createThemeWatcher(scheduler);
  console.log('Watching src/**/*.pug, src/**/*.scss, and src/**/*.ts. Press Ctrl+C to stop.');
}
