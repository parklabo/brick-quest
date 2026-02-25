export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs >= 60_000 ? `${Math.round(timeoutMs / 1000 / 60)}m` : `${Math.round(timeoutMs / 1000)}s`}`)), timeoutMs);
    promise
      .then((r) => {
        clearTimeout(id);
        resolve(r);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}
