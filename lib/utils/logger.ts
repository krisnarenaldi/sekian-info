/**
 * Structured logger for pipeline observability.
 *
 * Each log entry contains:
 *   - pipeline:  name of the pipeline or module emitting the log
 *   - timestamp: ISO-8601 UTC timestamp of the event
 *   - level:     severity level (info | warn | error)
 *   - message:   human-readable description of the event
 *   - error:     serialised error details (only present on error entries)
 *
 * Requirements: 14.1, 14.2
 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  pipeline: string
  timestamp: string
  level: LogLevel
  message: string
  error?: SerializedError
}

export interface SerializedError {
  name: string
  message: string
  /** HTTP status / API error code, when available */
  code?: string | number
  stack?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }

  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    return {
      name: String(obj['name'] ?? 'UnknownError'),
      message: String(obj['message'] ?? JSON.stringify(err)),
      code:
        obj['code'] !== undefined
          ? (obj['code'] as string | number)
          : undefined,
    }
  }

  return {
    name: 'UnknownError',
    message: String(err),
  }
}

function buildEntry(
  level: LogLevel,
  pipeline: string,
  message: string,
  err?: unknown,
): LogEntry {
  const entry: LogEntry = {
    pipeline,
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  if (err !== undefined) {
    entry.error = serializeError(err)
  }

  return entry
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry)

  switch (entry.level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an informational event.
 *
 * @param pipeline - Name of the calling pipeline / module (e.g. "news", "market")
 * @param message  - Human-readable description of the event
 */
export function logInfo(pipeline: string, message: string): void {
  emit(buildEntry('info', pipeline, message))
}

/**
 * Log a warning — something unexpected but non-fatal.
 *
 * @param pipeline - Name of the calling pipeline / module
 * @param message  - Human-readable description of the warning
 * @param err      - Optional underlying error or value that caused the warning
 */
export function logWarn(
  pipeline: string,
  message: string,
  err?: unknown,
): void {
  emit(buildEntry('warn', pipeline, message, err))
}

/**
 * Log an error — use this for every caught exception in a pipeline.
 *
 * Satisfies Requirements 14.1 (error name, timestamp, pipeline, message)
 * and 14.2 (LLM call failures with API error code).
 *
 * @param pipeline - Name of the calling pipeline / module
 * @param message  - Human-readable description of what failed
 * @param err      - The caught error / rejection value
 */
export function logError(
  pipeline: string,
  message: string,
  err?: unknown,
): void {
  emit(buildEntry('error', pipeline, message, err))
}

/**
 * Create a child logger bound to a specific pipeline name.
 * Reduces repetition when a single module emits many log calls.
 *
 * @example
 * const log = createLogger('news')
 * log.info('Pipeline started')
 * log.error('LLM call failed', apiError)
 */
export function createLogger(pipeline: string) {
  return {
    info: (message: string) => logInfo(pipeline, message),
    warn: (message: string, err?: unknown) => logWarn(pipeline, message, err),
    error: (message: string, err?: unknown) =>
      logError(pipeline, message, err),
  }
}
