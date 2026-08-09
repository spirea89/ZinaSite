import { z } from 'zod';
import { ApiError } from './errors.js';

const actionNameSchema = z.string().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9]*$/);

export interface ActionContext {
  requestId: string;
}

export type ActionHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
  context: ActionContext,
) => Promise<TResult>;

export class ActionDispatcher {
  readonly #handlers = new Map<string, ActionHandler>();

  register<TPayload, TResult>(action: string, handler: ActionHandler<TPayload, TResult>): void {
    const name = actionNameSchema.parse(action);
    if (this.#handlers.has(name)) {
      throw new Error(`Action already registered: ${name}`);
    }
    this.#handlers.set(name, handler as ActionHandler);
  }

  listActions(): readonly string[] {
    return Object.freeze([...this.#handlers.keys()].sort());
  }

  async dispatch(action: unknown, payload: unknown, context: ActionContext): Promise<unknown> {
    const parsed = actionNameSchema.safeParse(action);
    if (!parsed.success) {
      throw new ApiError('INVALID_ACTION', 'Action is invalid.', 400);
    }
    const handler = this.#handlers.get(parsed.data);
    if (!handler) {
      throw new ApiError('UNKNOWN_ADMIN_ACTION', 'Unknown API action.', 404);
    }
    return handler(payload, context);
  }
}

