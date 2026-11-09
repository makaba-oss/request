// Хэширование паролей (scrypt). Общий модуль для сайта и консольного скрипта.
import { scryptSync, randomBytes, timingSafeEqual, randomInt } from 'node:crypto';

const N = 16384, R = 8, P = 1, LEN = 64;

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = scryptSync(String(pw), salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function checkPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = scryptSync(String(pw), Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Понятный пароль вида kx7m-p3tq-w9ab: без похожих символов (0/o, 1/l/i). */
export function generatePassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = () => Array.from({ length: 4 }, () => abc[randomInt(abc.length)]).join('');
  return `${part()}-${part()}-${part()}`;
}

/** Логин: латиница, цифры и . _ - @ +, от 3 до 60 символов, без учёта регистра. */
export function normalizeLogin(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return /^[a-z0-9._@+-]{3,60}$/.test(s) ? s : null;
}
