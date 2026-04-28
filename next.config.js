/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              'autoplay=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
              'fullscreen=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
              'encrypted-media=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
              'picture-in-picture=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
            ].join(", "),
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://*.supabase.co https://lh3.googleusercontent.com https://i.ytimg.com",
              "connect-src 'self' https://*.supabase.co https://api.ftcscout.org https://va.vercel-scripts.com https://vitals.vercel-insights.com",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
