import { extractInstagramShortcode } from './instagram-insights.service';
import { extractTiktokVideoId } from './tiktok-insights.service';
import { extractYoutubeVideoId } from './youtube-insights.service';
import { extractFacebookPostRef } from './facebook-insights.service';
import { extractTweetId } from './twitter-insights.service';

/**
 * These extractors gate the whole reporting pipeline: a URL that does not
 * parse can never be resolved, and a URL that parses to the WRONG id would
 * report another account's numbers to an advertiser.
 */
describe('live post URL extractors', () => {
  describe('Instagram', () => {
    it.each([
      ['https://www.instagram.com/p/Cx1y2z3AbCd/', 'Cx1y2z3AbCd'],
      ['https://www.instagram.com/reel/Cx1y2z3AbCd/', 'Cx1y2z3AbCd'],
      ['https://www.instagram.com/reels/Cx1y2z3AbCd/', 'Cx1y2z3AbCd'],
      ['https://instagram.com/tv/Cx1y2z3AbCd', 'Cx1y2z3AbCd'],
      ['https://www.instagram.com/creatorhandle/p/Cx1y2z3AbCd/?utm=1', 'Cx1y2z3AbCd'],
    ])('parses %s', (url, expected) => {
      expect(extractInstagramShortcode(url)).toBe(expected);
    });

    it('refuses /share/ links rather than risk a false ownership failure', () => {
      // The /share/ code is an opaque redirect token, never the permalink
      // shortcode — comparing it would flag a genuine post as "not owned".
      expect(extractInstagramShortcode('https://www.instagram.com/share/BAbCdEf123')).toBeNull();
    });

    it('returns null for a non-Instagram URL', () => {
      expect(extractInstagramShortcode('https://example.com/p/abc')).toBeNull();
    });
  });

  describe('TikTok', () => {
    it('parses a full share URL', () => {
      expect(
        extractTiktokVideoId('https://www.tiktok.com/@creator/video/7234567890123456789'),
      ).toBe('7234567890123456789');
    });

    it('refuses vm/vt short links, which carry no video id', () => {
      expect(extractTiktokVideoId('https://vm.tiktok.com/ZMabcdef/')).toBeNull();
      expect(extractTiktokVideoId('https://vt.tiktok.com/ZSabcdef/')).toBeNull();
    });
  });

  describe('YouTube', () => {
    it.each([
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=10', 'dQw4w9WgXcQ'],
    ])('parses %s', (url, expected) => {
      expect(extractYoutubeVideoId(url)).toBe(expected);
    });

    it('rejects an id that is not 11 characters', () => {
      expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=tooshort')).toBeNull();
    });
  });

  describe('Facebook', () => {
    it('builds the pageId_postId composite from permalink.php', () => {
      expect(
        extractFacebookPostRef('https://www.facebook.com/permalink.php?story_fbid=999&id=111'),
      ).toBe('111_999');
    });

    it('keeps an already-composite post id', () => {
      expect(extractFacebookPostRef('https://www.facebook.com/Page/posts/111_999')).toBe('111_999');
    });

    it('parses a bare numeric post id', () => {
      expect(extractFacebookPostRef('https://www.facebook.com/Page/posts/123456')).toBe('123456');
    });

    it('parses video and reel URLs', () => {
      expect(extractFacebookPostRef('https://www.facebook.com/Page/videos/778899')).toBe('778899');
      expect(extractFacebookPostRef('https://www.facebook.com/reel/445566')).toBe('445566');
    });

    it('returns null for pfbid-style opaque permalinks', () => {
      // pfbid tokens are not usable as Graph API ids.
      expect(
        extractFacebookPostRef('https://www.facebook.com/Page/posts/pfbid0abcXYZ123'),
      ).toBeNull();
    });
  });

  describe('X', () => {
    it.each([
      ['https://x.com/creator/status/1234567890', '1234567890'],
      ['https://twitter.com/creator/status/1234567890', '1234567890'],
      ['https://twitter.com/creator/statuses/1234567890', '1234567890'],
    ])('parses %s', (url, expected) => {
      expect(extractTweetId(url)).toBe(expected);
    });
  });
});
