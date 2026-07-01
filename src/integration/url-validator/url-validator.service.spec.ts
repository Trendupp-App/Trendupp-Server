import { Test, TestingModule } from '@nestjs/testing';
import { UrlValidatorService } from './url-validator.service';

describe('UrlValidatorService', () => {
  let service: UrlValidatorService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlValidatorService],
    }).compile();

    service = module.get<UrlValidatorService>(UrlValidatorService);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUrl', () => {
    it('should return isLive: false if URL parsing fails', async () => {
      const result = await service.validateUrl('not-a-valid-url');
      expect(result.isLive).toBe(false);
      expect(result.platform).toBe('Other');
    });

    it('should correctly identify platforms', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<html><body>Valid post content</body></html>'),
      } as any);

      const yt = await service.validateUrl('https://youtube.com/watch?v=123');
      expect(yt.platform).toBe('YouTube');

      const ig = await service.validateUrl('https://instagram.com/p/abc');
      expect(ig.platform).toBe('Instagram');

      const tt = await service.validateUrl('https://tiktok.com/@user/video/123');
      expect(tt.platform).toBe('TikTok');

      const x = await service.validateUrl('https://x.com/user/status/123');
      expect(x.platform).toBe('X');
    });

    it('should return isLive: true on successful HEAD response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<html><body>Valid post content</body></html>'),
      } as any);

      const result = await service.validateUrl('https://instagram.com/p/abc');
      expect(result.isLive).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should fall back to GET and return isLive: true on 403 Forbidden client check', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: jest
            .fn()
            .mockResolvedValue('<html><body>Access denied or verification challenge</body></html>'),
        } as any);

      const result = await service.validateUrl('https://instagram.com/p/abc');
      expect(result.isLive).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should return isLive: false on 404 Not Found response status', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('HEAD request blocked')).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const result = await service.validateUrl('https://instagram.com/p/abc');
      expect(result.isLive).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should return isLive: false on 200 status carrying missing content signatures (Instagram)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('HEAD request blocked')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue(
            "<html><body>Sorry, this page isn't available. Please try again.</body></html>",
          ),
      } as any);

      const result = await service.validateUrl('https://instagram.com/p/abc');
      expect(result.isLive).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should return isLive: false on 200 status carrying missing content signatures (TikTok)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('HEAD request blocked')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue('<html><body>Video currently unavailable. Try later!</body></html>'),
      } as any);

      const result = await service.validateUrl('https://tiktok.com/@user/video/123');
      expect(result.isLive).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should return isLive: false on 500 Server Error response', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('HEAD request blocked')).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const result = await service.validateUrl('https://instagram.com/p/abc');
      expect(result.isLive).toBe(false);
    });
  });
});
