"use client";

function ErrorPage({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <p className="mb-4 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
        Surface paused
      </p>
      <h1 className="text-xl font-semibold mb-2">This decision surface hit an error.</h1>
      <p className="text-stone-400 text-sm mb-2 text-center max-w-md">
        Retry the surface to rebuild the latest context and continue.
      </p>
      {error.message && (
        <p className="text-xs text-stone-600 mb-6 font-mono bg-stone-950 border border-stone-800 rounded px-3 py-1.5 max-w-md truncate">
          {error.message}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="bg-amber-300 hover:bg-amber-200 text-stone-950 px-5 py-2.5 rounded-lg text-sm font-medium transition"
      >
        Retry surface
      </button>
    </main>
  );
}

export default ErrorPage;
