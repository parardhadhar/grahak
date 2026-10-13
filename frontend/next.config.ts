/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  async redirects() {
    if (process.env.NEXT_PUBLIC_LAUNCH_MODE !== 'early-access') return [];
    return ['signup','login','onboarding','dashboard','overview','contacts/:path*','settings','search','reminders'].map(path => ({
      source: `/${path}`, destination: '/early-access', permanent: false,
    }));
  },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_LAUNCH_MODE === 'early-access') return [];
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
