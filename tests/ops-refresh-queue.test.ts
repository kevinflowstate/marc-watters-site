import { describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "../lib/ops/refresh-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("workspace refresh after a save", () => {
  it("waits for a fresh read after a mutation overlaps an older background read", async () => {
    const oldRead = deferred<string>();
    const savedRead = deferred<string>();
    const savedReadStarted = deferred<void>();
    const displayed: string[] = [];
    const refresh = vi.fn()
      .mockImplementationOnce(async () => { displayed.push(await oldRead.promise); })
      .mockImplementationOnce(async () => {
        savedReadStarted.resolve();
        displayed.push(await savedRead.promise);
      });
    const load = createRefreshQueue(refresh);

    const polling = load();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    // The write has succeeded; its final reload must not reuse the old read.
    let saveFinished = false;
    const afterSave = load(true).then(() => { saveFinished = true; });
    expect(refresh).toHaveBeenCalledTimes(1);
    oldRead.resolve("Before the task was added");
    await polling;
    await savedReadStarted.promise;
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(saveFinished).toBe(false);
    savedRead.resolve("New task is visible");
    await afterSave;
    expect(displayed).toEqual(["Before the task was added", "New task is visible"]);
    expect(saveFinished).toBe(true);
  });

  it("shares ordinary polling and manual refresh calls without concurrent reads", async () => {
    const read = deferred<void>();
    const refresh = vi.fn(() => read.promise);
    const load = createRefreshQueue(refresh);
    const first = load();
    expect(load()).toBe(first);
    expect(load()).toBe(first);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    read.resolve();
    await first;
  });

  it("coalesces saves that occur before the queued fresh read starts", async () => {
    const before = deferred<void>();
    const after = deferred<void>();
    const started = deferred<void>();
    const refresh = vi.fn()
      .mockImplementationOnce(() => before.promise)
      .mockImplementationOnce(() => { started.resolve(); return after.promise; });
    const load = createRefreshQueue(refresh);
    void load();
    const firstSave = load(true);
    const secondSave = load(true);
    expect(secondSave).toBe(firstSave);
    before.resolve();
    await started.promise;
    expect(refresh).toHaveBeenCalledTimes(2);
    after.resolve();
    await Promise.all([firstSave, secondSave]);
  });

  it("queues another fresh read when a later save happens during the queued read", async () => {
    const first = deferred<void>(), second = deferred<void>(), third = deferred<void>();
    const secondStarted = deferred<void>(), thirdStarted = deferred<void>();
    const refresh = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => { secondStarted.resolve(); return second.promise; })
      .mockImplementationOnce(() => { thirdStarted.resolve(); return third.promise; });
    const load = createRefreshQueue(refresh);
    void load();
    const saveOne = load(true);
    first.resolve();
    await secondStarted.promise;
    const saveTwo = load(true);
    expect(saveTwo).not.toBe(saveOne);
    second.resolve();
    await thirdStarted.promise;
    expect(refresh).toHaveBeenCalledTimes(3);
    third.resolve();
    await Promise.all([saveOne, saveTwo]);
  });

  it("still performs the post-save read if the earlier refresh failed", async () => {
    const before = deferred<void>();
    const refresh = vi.fn()
      .mockImplementationOnce(() => before.promise)
      .mockResolvedValueOnce(undefined);
    const load = createRefreshQueue(refresh);
    const polling = load();
    const failed = expect(polling).rejects.toThrow("Old read failed");
    const afterSave = load(true);
    before.reject(new Error("Old read failed"));
    await failed;
    await expect(afterSave).resolves.toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does a single read when no refresh is already running", async () => {
    const refresh = vi.fn(async () => undefined);
    const load = createRefreshQueue(refresh);
    await load(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
