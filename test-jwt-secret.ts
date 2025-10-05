/**
 * Test JWT Secret Validation
 *
 * This script tests the JWT secret validation implementation
 * to ensure it correctly rejects weak secrets and accepts strong ones.
 */

// Test weak secrets (should throw errors in production)
const weakSecrets = [
  '',
  'secret',
  'password',
  'jwt-secret',
  'change-me',
  'dev-secret-please-change-in-production',
  'short', // Too short
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // Low entropy
]

// Test strong secrets (should pass)
const strongSecrets = [
  'dGhpc2lzYW5leGFtcGxlc2VjcmV0dGhhdHlvdXNob3VsZG5vdHVzZTEyMzQ1Njc4OTA=', // 64 chars, good entropy
  'R4nd0m!Str0ng$ecr3t#W1th*Sp3c!al&Ch@rs', // 40 chars, mixed chars
  crypto.randomBytes(64).toString('base64') // Auto-generated
]

console.log('Testing JWT Secret Validation\n')

// Simulate production environment
process.env.NODE_ENV = 'production'

console.log('=== Testing Weak Secrets (Should Fail in Production) ===')
for (const secret of weakSecrets) {
  try {
    process.env.JWT_SECRET = secret
    // Clear require cache to force re-evaluation
    delete require.cache[require.resolve('@promptliano/services/src/auth-service')]

    console.log(`Testing: "${secret.substring(0, 20)}..."`)
    // This should throw an error in production
    const { getJwtSecret } = require('@promptliano/services')
    const result = getJwtSecret()
    console.log(`  ❌ FAILED - Should have rejected weak secret, got: ${result.substring(0, 20)}...`)
  } catch (error) {
    console.log(`  ✅ PASSED - Correctly rejected: ${error.message.split('\n')[0]}`)
  }
}

console.log('\n=== Testing Strong Secrets (Should Pass) ===')
for (const secret of strongSecrets) {
  try {
    process.env.JWT_SECRET = secret
    delete require.cache[require.resolve('@promptliano/services/src/auth-service')]

    console.log(`Testing: "${secret.substring(0, 20)}..."`)
    const { getJwtSecret } = require('@promptliano/services')
    const result = getJwtSecret()
    console.log(`  ✅ PASSED - Accepted strong secret`)
  } catch (error) {
    console.log(`  ❌ FAILED - Should have accepted strong secret: ${error.message}`)
  }
}

console.log('\n=== Testing Development Mode (Should Generate Session Secret) ===')
process.env.NODE_ENV = 'development'
delete process.env.JWT_SECRET
delete require.cache[require.resolve('@promptliano/services/src/auth-service')]

try {
  const { getJwtSecret } = require('@promptliano/services')
  const result = getJwtSecret()
  if (result && result.length >= 32) {
    console.log(`✅ PASSED - Generated session secret: ${result.substring(0, 20)}...`)
  } else {
    console.log(`❌ FAILED - Generated secret is too short: ${result.length} chars`)
  }
} catch (error) {
  console.log(`❌ FAILED - Should have generated session secret: ${error.message}`)
}

console.log('\nTest Complete!')
