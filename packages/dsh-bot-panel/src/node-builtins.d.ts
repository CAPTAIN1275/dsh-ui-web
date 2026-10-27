/**
 * Minimal ambient declarations for the Node builtins the host half uses.
 *
 * The package tsconfig compiles `src` with `types: []`, so the ambient
 * `@types/node` surface is not loaded. Declaring exactly what this plugin
 * calls keeps the host half typed without adding a type dependency; in a
 * program where `@types/node` is loaded these merge as extra overloads.
 */

declare module 'node:child_process' {
  /** Options this plugin passes to execFile. */
  export interface ExecFileOptions {
    /** Kill the child after this many milliseconds. */
    timeout?: number
    /** Do not allocate a console window on Windows. */
    windowsHide?: boolean
    /** Decode both streams with this encoding. */
    encoding?: 'utf8'
  }

  /**
   * Run a file without a shell.
   * @param file - executable to run.
   * @param args - argv entries.
   * @param options - timeout and encoding.
   * @param callback - receives the error and both decoded streams.
   */
  export function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): unknown
}

declare module 'node:http' {
  /** The subset of an incoming request this plugin reads. */
  export interface IncomingMessage {
    /** HTTP method. */
    method?: string
    /** Request target. */
    url?: string
    /** Request headers. */
    headers: Record<string, string | string[] | undefined>
    /** The underlying socket, used for the loopback check. */
    socket: { remoteAddress?: string }
  }

  /** The subset of a response this plugin writes. */
  export interface ServerResponse {
    /** Write the status line and headers. */
    writeHead(status: number, headers: Record<string, string>): void
    /** End the response with an optional body. */
    end(body?: string): void
  }
}
