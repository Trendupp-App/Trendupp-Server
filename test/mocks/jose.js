/**
 * Jest stand-in for the `jose` package, which ships ESM-only and cannot be
 * parsed by the CommonJS ts-jest transform. Unit tests always mock
 * AppleAuthService itself; this stub only exists so importing it doesn't
 * crash test suites. (Mapped via jest.moduleNameMapper in package.json.)
 */
module.exports = {
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(() => {
    throw new Error('jose is mocked in tests — mock AppleAuthService instead');
  }),
};
