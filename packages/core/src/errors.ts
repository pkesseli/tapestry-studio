import type { ZodError } from 'zod';

/** One problem found in a project file: where inside the file, and what is wrong. */
export interface FormatIssue {
  /** Dotted path to the offending field inside the file (empty when the whole file is the problem). */
  path: string;
  /** Human-readable description of the problem. */
  message: string;
}

/** Raised when a project file cannot be read, parsed, migrated or validated. Always names the file and the field. */
export class ProjectFormatError extends Error {
  /**
   * @param file Project-relative path of the offending file.
   * @param issues Individual problems found in that file.
   */
  constructor(
    readonly file: string,
    readonly issues: readonly FormatIssue[],
  ) {
    super(
      `${file}: ${issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)).join('; ')}`,
    );
    this.name = 'ProjectFormatError';
  }
}

/**
 * Converts a validation error into a project format error.
 * @param file Project-relative path of the file that failed validation.
 * @param error The zod error to convert.
 */
export function fromZodError(file: string, error: ZodError): ProjectFormatError {
  return new ProjectFormatError(
    file,
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}
