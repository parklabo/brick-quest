import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: `${BASE_URL}/${locale}`,
    lastModified: new Date('2026-02-14'),
    changeFrequency: 'monthly' as const,
    priority: 1,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${BASE_URL}/${l}`]),
      ),
    },
  }));
}
