// theme v1. The canonical copy lives in luvwadhwani/portfolio-hub (lib/theme.ts). Copy it unchanged into each project.
export const THEME_COOKIE = 'lw_theme';
export const BASE_DOMAIN = 'luvwadhwani.com';

export type Theme = 'light' | 'dark' | 'system';

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Shared across *.luvwadhwani.com so a choice made on the hub follows into every project; host-only elsewhere. */
export function themeCookieDomain(hostname: string): string | null {
  return hostname === BASE_DOMAIN || hostname.endsWith(`.${BASE_DOMAIN}`) ? `.${BASE_DOMAIN}` : null;
}

export function themeCookie(theme: Theme, hostname: string): string {
  const domain = themeCookieDomain(hostname);
  const scope = `; path=/; samesite=lax${domain ? `; domain=${domain}` : ''}`;
  return theme === 'system' ? `${THEME_COOKIE}=; max-age=0${scope}` : `${THEME_COOKIE}=${theme}; max-age=31536000${scope}`;
}

/** The value for <html data-theme>: only an explicit choice sets it; "system" leaves it to the device. */
export const themeAttribute = (theme: Theme): 'light' | 'dark' | undefined => (theme === 'system' ? undefined : theme);
