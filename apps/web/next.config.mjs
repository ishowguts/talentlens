/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/shared ships TypeScript source with NodeNext-style ".js" import specifiers.
  transpilePackages: ['shared'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
