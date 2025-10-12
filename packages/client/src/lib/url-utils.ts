/**
 * URL Utilities - Security and Validation
 *
 * Provides secure URL validation and sanitization to prevent XSS attacks
 * and ensure safe external link handling.
 */

/**
 * Validates that a URL is a valid HTTP/HTTPS URL
 * @param url - URL string to validate
 * @returns true if URL is valid HTTP/HTTPS, false otherwise
 */
export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Sanitizes a URL by validating it and returning a safe fallback if invalid
 * @param url - URL string to sanitize
 * @param fallback - Fallback URL if validation fails (default: '#')
 * @returns Sanitized URL or fallback
 */
export function sanitizeUrl(url: string, fallback: string = '#'): string {
  if (!isValidHttpUrl(url)) {
    return fallback
  }
  return url
}

/**
 * Validates and returns URL or throws error
 * @param url - URL string to validate
 * @returns URL if valid
 * @throws Error if URL is invalid
 */
export function validateUrl(url: string): string {
  if (!isValidHttpUrl(url)) {
    throw new Error(`Invalid URL: ${url}`)
  }
  return url
}

/**
 * Extracts domain from URL
 * @param url - URL string
 * @returns Domain name or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

/**
 * Creates safe rel attribute value for external links
 * Always includes noopener and noreferrer for security
 * @returns 'noopener noreferrer'
 */
export function getSafeRelAttribute(): string {
  return 'noopener noreferrer'
}
