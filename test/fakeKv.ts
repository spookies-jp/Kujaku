export function createFakeKv(): KVNamespace {
  const store = new Map<string, string>();

  return {
    async get(key: string, options?: unknown) {
      const value = store.get(key);
      if (value === undefined) return null;
      const type =
        typeof options === "string" ? options : (options as { type?: string } | undefined)?.type;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as KVNamespace;
}
