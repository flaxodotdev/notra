import { StateUnavailableError } from "../loaders";

export function isStateUnavailable(error: unknown): boolean {
  return error instanceof StateUnavailableError || error instanceof SyntaxError;
}
