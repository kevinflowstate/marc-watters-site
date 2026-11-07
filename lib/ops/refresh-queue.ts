/** Share ordinary reads, but guarantee a new read after a successful mutation.
 * Reads stay serial so an older response cannot overwrite the newer result. */
export function createRefreshQueue(refresh: () => Promise<void>) {
  let active: Promise<void> | null = null;
  let queued: Promise<void> | null = null;

  function run(afterCurrent = false): Promise<void> {
    if (!active) {
      active = Promise.resolve()
        .then(refresh)
        .finally(() => {
          active = null;
        });
      return active;
    }
    if (!afterCurrent) return active;
    if (!queued) {
      queued = active.catch(() => undefined).then(() => {
        queued = null;
        return run();
      });
    }
    return queued;
  }

  return run;
}
