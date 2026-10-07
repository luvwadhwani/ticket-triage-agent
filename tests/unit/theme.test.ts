import { describe, expect, it } from 'vitest';
import { parseTheme, themeAttribute, themeCookie, themeCookieDomain, themeFromCookies } from '@/lib/theme';

describe('theme', () => {
  it('reads only light or dark from the cookie; anything else means match the device', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('purple')).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
  });

  it('shares the choice across *.luvwadhwani.com and keeps it host-only anywhere else', () => {
    expect(themeCookieDomain('work.luvwadhwani.com')).toBe('.luvwadhwani.com');
    expect(themeCookieDomain('luvwadhwani.com')).toBe('.luvwadhwani.com');
    expect(themeCookieDomain('localhost')).toBeNull();
    expect(themeCookieDomain('ticket-triage-agent-seven.vercel.app')).toBeNull();
    expect(themeCookieDomain('luvwadhwani.com.evil.example')).toBeNull();
  });

  it('writes a year-long cookie for a choice, and clears it for "match device"', () => {
    expect(themeCookie('dark', 'triage.luvwadhwani.com')).toBe('lw_theme=dark; max-age=31536000; path=/; samesite=lax; domain=.luvwadhwani.com');
    expect(themeCookie('light', 'localhost')).toBe('lw_theme=light; max-age=31536000; path=/; samesite=lax');
    expect(themeCookie('system', 'work.luvwadhwani.com')).toBe('lw_theme=; max-age=0; path=/; samesite=lax; domain=.luvwadhwani.com');
  });

  it('reads the choice from a browser cookie string, wherever it sits among other cookies', () => {
    expect(themeFromCookies('a=1; lw_theme=dark; b=2')).toBe('dark');
    expect(themeFromCookies('lw_theme=light')).toBe('light');
    expect(themeFromCookies('xlw_theme=dark; lw_theme_old=dark')).toBe('system');
    expect(themeFromCookies('')).toBe('system');
  });

  it('sets the html attribute only for an explicit choice', () => {
    expect(themeAttribute('dark')).toBe('dark');
    expect(themeAttribute('system')).toBeUndefined();
  });
});
