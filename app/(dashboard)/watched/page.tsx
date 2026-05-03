"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WatchedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/season?tab=teams");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
    </div>
  );
}
