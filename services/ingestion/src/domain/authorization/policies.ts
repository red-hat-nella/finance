export type AppRole = "credit_analyst" | "supervisor" | "auditor";
export interface ActorContext {
  readonly actorId: string;
  readonly orgId: string;
  readonly roles: readonly AppRole[];
}
export function canCreate(actor: ActorContext): boolean {
  return actor.roles.includes("credit_analyst");
}
export function canRead(actor: ActorContext): boolean {
  return actor.roles.some((role) =>
    ["credit_analyst", "supervisor", "auditor"].includes(role),
  );
}
