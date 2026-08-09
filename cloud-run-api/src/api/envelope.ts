export const API_VERSION = 'v1' as const;

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  error: null;
  version: typeof API_VERSION;
}

export interface FailureEnvelope {
  ok: false;
  data: null;
  error: ApiErrorBody;
  version: typeof API_VERSION;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | FailureEnvelope;

export function successEnvelope<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data, error: null, version: API_VERSION };
}

export function failureEnvelope(code: string, message: string): FailureEnvelope {
  return { ok: false, data: null, error: { code, message }, version: API_VERSION };
}

