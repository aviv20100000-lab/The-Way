import '@testing-library/jest-dom'

// Provide required env vars for tests that import auth/password-reset modules
// without mocking them (integration tests).
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-padding!!';
}
