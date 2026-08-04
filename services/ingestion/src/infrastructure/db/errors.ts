export class PersistenceError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super("No fue posible persistir la operación.", options);
  }
}
