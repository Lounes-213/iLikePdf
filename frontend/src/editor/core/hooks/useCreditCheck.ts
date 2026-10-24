/**
 * Tool runs used to spend account tokens before reaching the backend. Accounts
 * and credits are gone, so this always allows the run and callers keep their
 * existing shape.
 */
export function useCreditCheck(_operationType?: string, _endpoint?: string) {
  return {
    checkCredits: async (_runtimeEndpoint?: string): Promise<string | null> =>
      null,
  };
}
