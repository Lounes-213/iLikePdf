/** Policies need the server-side processor; a local-only build runs none. */
export function usePoliciesEnabled(): boolean {
  return false;
}
