export type PacingSleep = (milliseconds: number) => Promise<void>;
export type PacingClock = () => number;

const defaultSleep: PacingSleep = async (milliseconds) => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

export class SerializedPacer {
  readonly #paceMs: number;
  readonly #sleep: PacingSleep;
  readonly #now: PacingClock;
  #queue: Promise<void> = Promise.resolve();
  #nextStartAt = 0;

  constructor(paceMs: number, sleep: PacingSleep = defaultSleep, now: PacingClock = Date.now) {
    if (!Number.isInteger(paceMs) || paceMs < 4_000) {
      throw new Error('Navigation pacing must be an integer greater than or equal to 4000ms.');
    }

    this.#paceMs = paceMs;
    this.#sleep = sleep;
    this.#now = now;
  }

  async waitForTurn(): Promise<number> {
    let release!: () => void;
    const previous = this.#queue;
    this.#queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      const delay = Math.max(0, this.#nextStartAt - this.#now());
      if (delay > 0) {
        await this.#sleep(delay);
      }
      const startedAt = this.#now();
      this.#nextStartAt = startedAt + this.#paceMs;
      return startedAt;
    } finally {
      release();
    }
  }
}
