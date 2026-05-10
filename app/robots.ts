import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://hantavirustracer.com/sitemap.xml',
    host: 'https://hantavirustracer.com',
  };
}
