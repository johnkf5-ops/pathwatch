/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // /faq merged into /hantavirus#faq during the consolidation patch.
      // 301 preserves any inbound links Google may have indexed.
      { source: '/faq', destination: '/hantavirus#faq', permanent: true },
    ];
  },
};
module.exports = nextConfig;
