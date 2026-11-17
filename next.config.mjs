/** @type {import('next').NextConfig} */
const nextConfig = {
  // Uploaded images and Claude requests can be a few MB.
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};
export default nextConfig;
