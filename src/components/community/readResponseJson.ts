/**
 * Reads API responses defensively. A failed server action can be returned as
 * an empty or non-JSON response by a proxy/runtime, and calling response.json
 * unconditionally turns the useful server error into a misleading parse error.
 */
export async function readResponseJson<T>(response: Response): Promise<T | null> {
  const body = await response.text()
  if (!body.trim()) return null

  try {
    return JSON.parse(body) as T
  } catch {
    return null
  }
}
