const { validateUrl, isPrivateIP } = require('../agents/utils/ssrfProtection');

describe('SSRF Protection', () => {
  describe('isPrivateIP', () => {
    it('should block loopback IPv4', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should block private IPv4 ranges', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('169.254.169.254')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should block IPv6 loopback', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should block IPv6 private ranges', () => {
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should block IPv4-mapped IPv6', () => {
      expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should block localhost', async () => {
      await expect(validateUrl('http://localhost/admin')).rejects.toThrow('Blocked private host');
    });

    it('should block 127.0.0.1', async () => {
      await expect(validateUrl('http://127.0.0.1/secret')).rejects.toThrow('Blocked private host');
    });

    it('should block ::1', async () => {
      await expect(validateUrl('http://[::1]/secret')).rejects.toThrow('Blocked private host');
    });

    it('should block metadata address', async () => {
      await expect(validateUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        'Blocked private host'
      );
    });

    it('should block private IP ranges', async () => {
      await expect(validateUrl('http://10.0.0.1/internal')).rejects.toThrow('Blocked private IP');
      await expect(validateUrl('http://172.16.0.1/internal')).rejects.toThrow('Blocked private IP');
      await expect(validateUrl('http://192.168.1.1/internal')).rejects.toThrow(
        'Blocked private IP'
      );
    });

    it('should allow public URLs', async () => {
      await expect(validateUrl('https://example.com')).resolves.toBe('https://example.com/');
      await expect(validateUrl('http://api.example.com/data')).resolves.toBe(
        'http://api.example.com/data'
      );
    });

    it('should block non-http protocols', async () => {
      await expect(validateUrl('file:///etc/passwd')).rejects.toThrow('Blocked protocol');
      await expect(validateUrl('gopher://evil.com')).rejects.toThrow('Blocked protocol');
    });
  });
});
