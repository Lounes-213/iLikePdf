/**
 * Local builds have no failure registry or notification routes, so the bell
 * must not mount and poll an endpoint that cannot answer.
 */
export function useNotificationsAvailable(): boolean {
  return false;
}
