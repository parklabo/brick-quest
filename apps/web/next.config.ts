import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@brick-quest/shared', 'three'],
};

export default nextConfig;
