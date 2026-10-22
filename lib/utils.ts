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
