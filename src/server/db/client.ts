import "server-only";
// Generated Prisma client is supplied by the deployment composition after installation/generation.
export interface ManagedClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
const state = globalThis as typeof globalThis & {
  dugoutDb?: Promise<ManagedClient>;
};
export function getDatabase<T extends ManagedClient>(
  factory: () => T,
): Promise<T> {
  state.dugoutDb ??= (async () => {
    const client = factory();
    try {
      await client.$connect();
      return client;
    } catch (error) {
      await client.$disconnect().catch(() => undefined);
      throw error;
    }
  })().catch((error) => {
    state.dugoutDb = undefined;
    throw error;
  });
  return state.dugoutDb as Promise<T>;
}
// Call at worker/process shutdown, never per request. Concurrent shutdowns share the same closing promise.
let closing: Promise<void> | undefined;
export function closeDatabase() {
  if (closing) return closing;
  const client = state.dugoutDb;
  if (!client) return Promise.resolve();
  closing = client
    .then((db) => db.$disconnect())
    .finally(() => {
      state.dugoutDb = undefined;
      closing = undefined;
    });
  return closing;
}
