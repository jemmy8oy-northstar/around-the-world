import { describe, it, expect } from "vitest";
import { Mutex } from "../mutex";

describe("Mutex", () => {
  it("serialises concurrent holders", async () => {
    const mutex = new Mutex();
    const order: string[] = [];

    async function critical(label: string) {
      const release = await mutex.acquire();
      order.push(`${label}:in`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`${label}:out`);
      release();
    }

    await Promise.all([critical("a"), critical("b"), critical("c")]);

    // No holder may enter before the previous one has left. This is the whole
    // point: three screens querying at once must not each burn a single-use
    // refresh token.
    expect(order).toEqual(["a:in", "a:out", "b:in", "b:out", "c:in", "c:out"]);
  });

  it("reports whether it is held", async () => {
    const mutex = new Mutex();
    expect(mutex.isLocked()).toBe(false);

    const release = await mutex.acquire();
    expect(mutex.isLocked()).toBe(true);

    release();
    expect(mutex.isLocked()).toBe(false);
  });

  it("ignores a double release", async () => {
    const mutex = new Mutex();
    const release = await mutex.acquire();

    release();
    release();

    // A second release must not unlock a lock someone else has since taken.
    const second = await mutex.acquire();
    expect(mutex.isLocked()).toBe(true);
    second();
  });

  it("waitForUnlock resolves immediately when free", async () => {
    const mutex = new Mutex();
    await expect(mutex.waitForUnlock()).resolves.toBeUndefined();
  });
});
