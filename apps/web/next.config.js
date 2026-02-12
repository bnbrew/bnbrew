/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@bnbrew/shared'],
};

module.exports = nextConfig;
