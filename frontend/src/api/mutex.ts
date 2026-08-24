/**
 * A minimal async mutex — just enough to stop concurrent token refreshes.
 *
 * Refresh tokens are single-use server-side, so two in-flight refreshes mean the
 * second one presents an already-revoked token and logs the user out. A library
 * would do, but this is fifteen lines and one fewer dependency to trust on the
 * one night this has to work.
 */
export class Mutex {
  private locked = false;
  private waiters: Array<() => void> = [];

  isLocked(): boolean {
    return this.locked;
  }

  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    this.locked = true;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.locked = false;
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((resolve) => resolve());
    };
  }

  async waitForUnlock(): Promise<void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}
