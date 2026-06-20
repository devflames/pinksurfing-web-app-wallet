/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || '';

const nextConfig = {
  transpilePackages: ['@pinksurfing/ui'],
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
