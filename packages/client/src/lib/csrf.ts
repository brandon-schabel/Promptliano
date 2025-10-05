/**
 * CSRF token management for client
 */

let csrfToken: string | null = null

/**
 * Get CSRF token from cookie
 */
function getCsrfTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';')
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='))

  if (!csrfCookie) return null

  return csrfCookie.split('=')[1]
}

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token')
    }

    const data = await response.json()
    return data.token
  } catch (error) {
    console.error('Error fetching CSRF token:', error)
    throw error
  }
}

/**
 * Get current CSRF token (from cookie or fetch from server)
 */
export async function getCsrfToken(): Promise<string> {
  // Try to get from cookie first
  const cookieToken = getCsrfTokenFromCookie()

  if (cookieToken) {
    csrfToken = cookieToken
    return cookieToken
  }

  // If not in cookie, fetch from server
  if (!csrfToken) {
    csrfToken = await fetchCsrfToken()
  }

  return csrfToken
}

/**
 * Clear cached CSRF token (e.g., after logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null
}
