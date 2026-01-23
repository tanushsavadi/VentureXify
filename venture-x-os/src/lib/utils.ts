import { clsx, type ClassValue } from 'clsx';

/**
 * Utility for combining class names with clsx
 * Similar to shadcn/ui's cn utility but without tailwind-merge
 * (to keep bundle size smaller)
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
