import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://picklistftc.com",
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://picklistftc.com/leaderboard",
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://picklistftc.com/compare",
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://picklistftc.com/partners",
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
