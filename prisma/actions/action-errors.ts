export const LIST_NOT_EMPTY_MESSAGE = 'This List contains Todos and cannot be deleted.';

export class ActionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionDomainError';
  }
}

export const normalizeTransactionError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof ActionDomainError) {
    return new Error(error.message);
  }

  return new Error(fallbackMessage);
};
