"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";

export default function WorkspaceRenewedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
          <p className="text-sm text-[var(--foreground-dim)]">Loading…</p>
        </div>
      }
    >
      <RenewedInner />
    </Suspense>
  );
}

function RenewedInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const ws = useWorkspaceOptional();
  const [status, setStatus] = useState<"verifying" | "done" | "error">(
    "verifying"
  );
  const [message, setMessage] = useState("Verifying your renewal…");
  const ranRef = useRef(false);

  const sessionId = params.get("session_id");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing checkout session id.");
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/workspace-renew-verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(json.error ?? "Could not renew workspace.");
          return;
        }
        setStatus("done");
        setMessage("Workspace renewed! Redirecting…");
        if (ws) await ws.refresh();
        setTimeout(() => router.replace("/workspace"), 800);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Network error");
      }
    })();
  }, [authLoading, user, sessionId, router, ws]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 max-w-md w-full text-center shadow-xl">
        {status !== "error" ? (
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--accent)]/15 flex items-center justify-center mb-4">
            <svg
              className={`w-6 h-6 text-[var(--accent)] ${
                status === "done" ? "" : "animate-spin"
              }`}
              fill="none"
              viewBox="0 0 24 24"
            >
              {status === "done" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  stroke="currentColor"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              ) : (
                <>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth={4}
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </>
              )}
            </svg>
          </div>
        ) : (
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/15 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
        )}
        <h1 className="text-lg font-semibold text-[var(--foreground)] mb-1">
          {status === "done"
            ? "Workspace renewed"
            : status === "error"
            ? "Something went wrong"
            : "Renewing your workspace"}
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">{message}</p>
        {status === "error" && (
          <button
            onClick={() => router.replace("/workspace")}
            className="mt-4 px-4 py-2 rounded-md text-sm font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Back to workspace
          </button>
        )}
      </div>
    </div>
  );
}
