import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UrlValidatorService {
  private readonly logger = new Logger(UrlValidatorService.name);

  /**
   * Performs a Tier 1 non-blocking validation check on a given URL.
   * Sends a HEAD request and falls back to a GET request if HEAD is blocked.
   */
  async validateUrl(url: string): Promise<{ isLive: boolean; platform: string; checkedAt: Date }> {
    const checkedAt = new Date();
    let platform = 'Other';

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        platform = 'YouTube';
      } else if (hostname.includes('instagram.com')) {
        platform = 'Instagram';
      } else if (hostname.includes('tiktok.com')) {
        platform = 'TikTok';
      } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        platform = 'X';
      } else if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
        platform = 'Facebook';
      }
    } catch {
      this.logger.warn(`Failed to parse URL: ${url}`);
      return { isLive: false, platform, checkedAt };
    }

    try {
      // 1. Try HEAD request with 5-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (headResponse) {
        if (headResponse.ok || (headResponse.status >= 300 && headResponse.status < 400)) {
          return { isLive: true, platform, checkedAt };
        }
        // If it's a client error like 405 (Method Not Allowed) or 403 (Forbidden), we fall back to GET
        if (
          headResponse.status !== 405 &&
          headResponse.status !== 403 &&
          headResponse.status !== 400
        ) {
          return { isLive: false, platform, checkedAt };
        }
      }

      // 2. Fallback to GET request
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 5000);

      const getResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: 'bytes=0-10240', // Request only the first 10KB to optimize performance
        },
        signal: getController.signal,
      }).catch(() => null);

      clearTimeout(getTimeoutId);

      if (getResponse) {
        if (getResponse.status >= 500) {
          return { isLive: false, platform, checkedAt };
        }
        if (getResponse.status === 404 || getResponse.status === 410) {
          return { isLive: false, platform, checkedAt };
        }

        try {
          const bodyText = await getResponse.text();
          const lowerText = bodyText.toLowerCase();

          // Check platform-specific SPA missing content indicators
          if (platform === 'Instagram') {
            if (
              lowerText.includes("sorry, this page isn't available") ||
              lowerText.includes("page isn't available") ||
              lowerText.includes('link you followed may be broken')
            ) {
              return { isLive: false, platform, checkedAt };
            }
          } else if (platform === 'TikTok') {
            if (
              lowerText.includes('video currently unavailable') ||
              lowerText.includes('video unavailable') ||
              lowerText.includes('video is unavailable')
            ) {
              return { isLive: false, platform, checkedAt };
            }
          } else if (platform === 'YouTube') {
            if (
              lowerText.includes('video unavailable') ||
              lowerText.includes('this video is unavailable')
            ) {
              return { isLive: false, platform, checkedAt };
            }
          } else if (platform === 'X') {
            if (
              lowerText.includes("page doesn't exist") ||
              lowerText.includes('page doesn’t exist')
            ) {
              return { isLive: false, platform, checkedAt };
            }
          }
        } catch {
          // Fallback to true if reading body fails but status code is valid (e.g. 200/403)
        }

        return { isLive: true, platform, checkedAt };
      }

      return { isLive: false, platform, checkedAt };
    } catch (error) {
      this.logger.error(
        `Error validating URL: ${url}`,
        error instanceof Error ? error.stack : error,
      );
      return { isLive: false, platform, checkedAt };
    }
  }
}
