import { Prisma } from '@/generated/prisma';

export class ActionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionDomainError';
  }
}

const PRISMA_ERROR_IDENTIFIERS = new Set([
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientRustPanicError',
  'PrismaClientInitializationError',
  'PrismaClientValidationError',
]);

const safePrismaIdentifier = (value: unknown): string | undefined =>
  typeof value === 'string' && PRISMA_ERROR_IDENTIFIERS.has(value) ? value : undefined;

const readErrorProperty = (error: object, key: 'name' | 'code'): unknown => {
  try {
    return (error as Record<typeof key, unknown>)[key];
  } catch {
    return undefined;
  }
};

const safeErrorDiagnostics = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  let constructorName: unknown;
  try {
    constructorName = Object.getPrototypeOf(error)?.constructor?.name;
  } catch {
    constructorName = undefined;
  }

  const errorName = readErrorProperty(error, 'name');
  const code = readErrorProperty(error, 'code');
  const errorClass = safePrismaIdentifier(constructorName);
  const safeName = safePrismaIdentifier(errorName);
  const errorCode = typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;

  return {
    ...(errorClass && { errorClass }),
    ...(safeName && { errorName: safeName }),
    ...(errorCode && { errorCode }),
  };
};

const isPrismaPersistenceError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError ||
  error instanceof Prisma.PrismaClientUnknownRequestError ||
  error instanceof Prisma.PrismaClientRustPanicError ||
  error instanceof Prisma.PrismaClientInitializationError ||
  error instanceof Prisma.PrismaClientValidationError;

export const normalizeTransactionError = (
  error: unknown,
  fallbackMessage: string,
  operation?: string
): Error => {
  if (error instanceof ActionDomainError) {
    return new Error(error.message);
  }

  if (!isPrismaPersistenceError(error)) {
    throw error;
  }

  if (operation === 'deleteTodoAction') {
    try {
      console.error('[server-action] Transaction failed', {
        operation: 'deleteTodoAction',
        ...safeErrorDiagnostics(error),
      });
    } catch {
      // Diagnostics are best-effort and must not mask the normalized action error.
    }
  }

  return new Error(fallbackMessage);
};

export const runWithPersistenceError = async <T>(
  operation: () => Promise<T>,
  fallbackMessage: string,
  operationName?: string,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw normalizeTransactionError(error, fallbackMessage, operationName);
  }
};
