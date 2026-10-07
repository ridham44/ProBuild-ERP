import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
  it('names browser and system', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0',
      ),
    ).toBe('Edge on Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1',
      ),
    ).toBe('Safari on iOS');
  });

  it('handles missing values', () => {
    expect(describeUserAgent(null)).toBe('Unknown device');
    expect(describeUserAgent('curl/8.0')).toBe('Unknown device');
  });
});
