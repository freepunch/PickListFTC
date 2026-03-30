"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
        <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-zinc-200 mb-2">Something went wrong</h2>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 text-sm font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
