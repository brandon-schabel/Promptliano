/**
 * URL Validator for Deep Research Service
 * Simplified URL validation that prevents SSRF attacks
 * Leverages existing ssrf-protection utilities
 */

import { ApiError } from '@promptliano/shared'
import { validateProviderURL } from './ssrf-protection'

// Blocked schemes for research URLs
const BLOCKED_SCHEMES = ['file', 'ftp', 'data', 'javascript', 'about', 'blob']

/**
 * Validates a research URL for security and accessibility
 *
 * @param url - The URL string to validate
 * @returns Validated URL object
 * @throws ApiError if URL is invalid or blocked
 *
 * @example
 * ```typescript
 * const validUrl = await validateResearchUrl('https://example.com/article')
 * const response = await fetch(validUrl.toString())
 * ```
 */
export async function validateResearchUrl(url: string): Promise<URL> {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new ApiError(422, 'Invalid URL format', 'INVALID_URL_FORMAT')
  }

  // Block dangerous schemes
  const scheme = parsed.protocol.replace(':', '')
  if (BLOCKED_SCHEMES.includes(scheme)) {
    throw new ApiError(
      422,
      `Blocked URL scheme: ${scheme}. Only http and https are allowed.`,
      'BLOCKED_URL_SCHEME',
      { scheme, allowedSchemes: ['http', 'https'] }
    )
  }

  // Use existing SSRF protection (DNS resolution and private IP blocking)
  const validation = await validateProviderURL(url, false)

  if (!validation.valid) {
    throw new ApiError(
      422,
      validation.error || 'URL validation failed',
      'SSRF_PROTECTION_BLOCKED',
      { url: parsed.hostname }
    )
  }

  return parsed
}

/**
 * Synchronous version that only checks basic URL format and scheme
 * Does not perform DNS resolution or IP validation
 *
 * @param url - The URL string to validate
 * @returns Validated URL object
 * @throws ApiError if URL format or scheme is invalid
 */
export function validateResearchUrlSync(url: string): URL {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new ApiError(422, 'Invalid URL format', 'INVALID_URL_FORMAT')
  }

  // Block dangerous schemes
  const scheme = parsed.protocol.replace(':', '')
  if (BLOCKED_SCHEMES.includes(scheme)) {
    throw new ApiError(
      422,
      `Blocked URL scheme: ${scheme}. Only http and https are allowed.`,
      'BLOCKED_URL_SCHEME',
      { scheme, allowedSchemes: ['http', 'https'] }
    )
  }

  // Basic hostname checks (synchronous only)
  const hostname = parsed.hostname.toLowerCase()
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254']

  if (blockedHosts.includes(hostname)) {
    throw new ApiError(
      422,
      'Cannot access internal addresses',
      'SSRF_PROTECTION_BLOCKED',
      { hostname }
    )
  }

  // Block private IP ranges (basic pattern matching)
  const privateIpPattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
  if (privateIpPattern.test(hostname)) {
    throw new ApiError(
      422,
      'Cannot access private IP addresses',
      'SSRF_PROTECTION_BLOCKED',
      { hostname }
    )
  }

  return parsed
}
