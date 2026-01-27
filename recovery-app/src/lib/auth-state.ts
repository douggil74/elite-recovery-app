/**
 * Auth State Module
 * Holds the current authenticated user's UID, accessible by database.ts
 * and storage.ts without circular dependencies.
 */

let currentUserId: string | null = null;

export function setCurrentUserId(uid: string | null): void {
  currentUserId = uid;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}
