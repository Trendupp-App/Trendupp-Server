import { redactInPlace, redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('redacts an access token inside a serialised Instagram token response', () => {
    const payload = JSON.stringify({ access_token: 'IGAAxyz123.abc-DEF', user_id: '178414' });

    const result = redactSecrets(payload);

    expect(result).not.toContain('IGAAxyz123.abc-DEF');
    expect(result).toContain('"access_token":"[REDACTED]"');
    // Non-secret fields survive, so the log line stays diagnostically useful.
    expect(result).toContain('178414');
  });

  it('redacts a token carried in a query string', () => {
    const url = 'https://graph.instagram.com/v25.0/me/media?fields=id&access_token=IGAAsecret';

    expect(redactSecrets(url)).toBe(
      'https://graph.instagram.com/v25.0/me/media?fields=id&access_token=[REDACTED]',
    );
  });

  it('redacts a bearer token in a header dump', () => {
    expect(redactSecrets('Authorization: Bearer eyJhbGci.payload.sig')).toBe(
      'Authorization: Bearer [REDACTED]',
    );
  });

  it('does not truncate access_token when matching the shorter token key', () => {
    // `token=` must not match inside `access_token=`, which would leave
    // `access_=[REDACTED]` and corrupt the line.
    expect(redactSecrets('access_token=abc')).toBe('access_token=[REDACTED]');
  });

  it('leaves strings without secrets untouched', () => {
    const line = 'Instagram media listing failed: Status 400';
    expect(redactSecrets(line)).toBe(line);
  });
});

describe('redactInPlace', () => {
  it('redacts sensitive keys in both snake_case and camelCase', () => {
    const info: Record<string, unknown> = {
      message: 'connect',
      access_token: 'IGAAsecret',
      refreshToken: 'refresh-secret',
      username: 'trenduppdev',
    };

    redactInPlace(info);

    expect(info.access_token).toBe('[REDACTED]');
    expect(info.refreshToken).toBe('[REDACTED]');
    expect(info.username).toBe('trenduppdev');
  });

  it('redacts secrets nested inside objects and arrays', () => {
    const info = {
      connections: [{ platform: 'instagram', accessToken: 'IGAAsecret' }],
      meta: { inner: { client_secret: 'shh' } },
    };

    redactInPlace(info);

    expect(info.connections[0].accessToken).toBe('[REDACTED]');
    expect(info.meta.inner.client_secret).toBe('[REDACTED]');
    expect(info.connections[0].platform).toBe('instagram');
  });

  it('preserves symbol keys that winston relies on for level routing', () => {
    const levelSymbol = Symbol.for('level');
    const info: Record<string | symbol, unknown> = {
      message: 'access_token=IGAAsecret',
      [levelSymbol]: 'error',
    };

    redactInPlace(info);

    expect(info[levelSymbol]).toBe('error');
    expect(info.message).toBe('access_token=[REDACTED]');
  });

  it('terminates on a self-referential object', () => {
    const info: Record<string, unknown> = { token: 'secret' };
    info.self = info;

    expect(() => redactInPlace(info)).not.toThrow();
    expect(info.token).toBe('[REDACTED]');
  });
});
