export class DriverError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function integer(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new DriverError(400, "INVALID_INPUT", `${name} is invalid.`);
  return value;
}
export function text(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max)
    throw new DriverError(400, "INVALID_INPUT", `${name} is invalid.`);
  return value.trim();
}
