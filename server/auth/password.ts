import { hash, verify } from "@node-rs/argon2";

/** Hash d'un mot de passe en argon2id (binaire prébuildé, pas de compilation). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Vérifie un mot de passe en clair contre son hash argon2. */
export function verifyPassword(
  hashStr: string,
  password: string,
): Promise<boolean> {
  return verify(hashStr, password);
}
