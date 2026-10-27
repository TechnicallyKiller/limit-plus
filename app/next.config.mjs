import webpack from "next/dist/compiled/webpack/webpack-lib.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@limit-plus/sdk", "@limit-plus/pricing"],
  webpack(config) {
    // Anchor and web3.js expect Node's Buffer in the browser.
    config.plugins.push(new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }));
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false, crypto: false };
    return config;
  },
};
export default nextConfig;
