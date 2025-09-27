/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const isGitHubPages = process.env.IS_GITHUB_PAGES === 'true';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['drive.google.com', 'lh3.googleusercontent.com'],
    unoptimized: true,
  },
  trailingSlash: true,
  // Add basePath for GitHub Pages deployment
  basePath: isGitHubPages ? '/portfolio' : '',
  assetPrefix: isGitHubPages ? '/portfolio' : '',
};

module.exports = nextConfig; 