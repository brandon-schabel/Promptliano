/**
 * Simplified crypto utilities
 * Encryption has been removed in favor of plain text storage with optional environment variables
 */

/**
 * Generates a random string that can be used as an API key or secret
 * @param length The length of the string to generate (default 32)
 */
export function generateRandomKey(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }

  return result
}

/**
 * Generates a random base64 string
 * @param bytes The number of random bytes to generate (default 32)
 */
export function generateBase64Key(bytes: number = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}
