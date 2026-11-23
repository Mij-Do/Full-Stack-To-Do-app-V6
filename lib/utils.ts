import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DESCRIPTION_PREVIEW_MAX_LENGTH = 50

export function truncateDescription(description: string): string {
  if (description.length <= DESCRIPTION_PREVIEW_MAX_LENGTH) {
    return description
  }
  return `${description.slice(0, DESCRIPTION_PREVIEW_MAX_LENGTH)}...`
}

export function formatDateForInput(value?: Date | string | null): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function formatDueDate(value?: Date | string | null): string {
  const dateValue = formatDateForInput(value)
  if (!dateValue) return '—'

  return new Date(`${dateValue}T00:00:00.000Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function dateOnlyToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}
