/**
 * Minimal ambient declarations for the Node builtins the Host half uses.
 *
 * The package's build tsconfig compiles `src` alone (no `types: ["node"]`), so
 * the Host modules cannot rely on the ambient `@types/node` surface that the
 * test program picks up transitively through vitest. Declaring exactly the
 * functions this plugin calls keeps the Host half typed without adding a type
 * dependency. In a program where `@types/node` *is* loaded (the test run), the
 * declarations below merge as additional overloads and stay compatible.
 */

declare module 'node:fs' {
  /** Create a directory (recursively when asked). */
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  /** Read a whole file as UTF-8 text. */
  export function readFileSync(path: string, encoding: 'utf8'): string
  /** Rename/replace a path. */
  export function renameSync(from: string, to: string): void
  /** Write a whole file as UTF-8 text. */
  export function writeFileSync(path: string, data: string, encoding?: 'utf8'): void
}

declare module 'node:os' {
  /** The current user's home directory. */
  export function homedir(): string
}

declare module 'node:path' {
  /** Directory part of a path. */
  export function dirname(path: string): string
  /** Join path segments with the platform separator. */
  export function join(...parts: string[]): string
}
