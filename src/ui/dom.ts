// The type parameter is inferred from call sites; the rule cannot see that intent.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}
