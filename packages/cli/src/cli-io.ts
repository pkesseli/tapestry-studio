/** Where the CLI reads its environment and writes its output; tests substitute their own. */
export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  env: Record<string, string | undefined>;
}
