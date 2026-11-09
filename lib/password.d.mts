export function hashPassword(pw: string): string;
export function checkPassword(pw: string, stored: string | null | undefined): boolean;
export function generatePassword(): string;
export function normalizeLogin(raw: unknown): string | null;
