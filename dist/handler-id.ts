let nextHandlerId = 0;

/** Shared numeric IDs for all v0.2 guest callbacks. */
export function getNextHandlerId(): number {
  if (nextHandlerId > 0xffffffff) throw new Error("Handler IDs exhausted");
  return nextHandlerId++;
}
