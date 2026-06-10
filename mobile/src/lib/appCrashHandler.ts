type FatalErrorListener = (error: Error) => void;

const listeners = new Set<FatalErrorListener>();
let installed = false;
let latestFatalError: Error | null = null;

function normalizeError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("Unknown application error");
  }
}

export function getLatestFatalError() {
  return latestFatalError;
}

export function clearLatestFatalError() {
  latestFatalError = null;
}

export function subscribeToFatalError(listener: FatalErrorListener) {
  listeners.add(listener);
  if (latestFatalError) {
    listener(latestFatalError);
  }

  return () => {
    listeners.delete(listener);
  };
}

export function reportFatalError(error: unknown) {
  const normalizedError = normalizeError(error);
  latestFatalError = normalizedError;

  if (__DEV__) {
    console.error("[app] Captured fatal error", normalizedError);
  }

  listeners.forEach((listener) => {
    try {
      listener(normalizedError);
    } catch {
      // Avoid cascading failures while notifying subscribers.
    }
  });
}

export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined; setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void } }).ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();

  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    reportFatalError(error);

    if (__DEV__ && previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}
