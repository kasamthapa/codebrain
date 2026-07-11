import { useState } from "react";
import { indexRepo } from "../api/indexRepo.api";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await indexRepo(repoUrl);
      navigate("/chat", {
        state: {
          repoUrl,
          indexMessage: response.message,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#0d0f0c] px-4 py-16 text-[#c9d1c4]">
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes typeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .term-line { animation: typeIn 0.35s ease-out both; }
        .term-cursor { animation: blink 1s step-end infinite; }
        @media (prefers-reduced-motion: reduce) {
          .term-line, .term-cursor { animation: none !important; }
        }
      `}</style>

      <div className="w-full max-w-3xl font-mono">
        <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#2a2f26] bg-[#14170f] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="ml-3 text-xs text-[#5c6354]">
            codebrain — /usr/bin/env
          </span>
        </div>

        <div className="rounded-b-lg border border-[#2a2f26] bg-[#0f120d] px-8 py-10 shadow-[0_0_60px_-15px_rgba(120,200,80,0.15)] md:px-10 md:py-12">
          <p
            style={{ animationDelay: "0ms" }}
            className="term-line text-sm text-[#5c6354]"
          >
            $ codebrain --init
          </p>
          <p
            style={{ animationDelay: "150ms" }}
            className="term-line mt-1 text-sm text-[#5c6354]"
          >
            loaded. paste a repository to begin.
          </p>

          <h1
            style={{ animationDelay: "300ms" }}
            className="term-line mt-8 text-3xl font-semibold tracking-tight text-[#e8ecdf] md:text-4xl"
          >
            <span className="text-[#7cc86a]">Code</span>Brain
          </h1>
          <p
            style={{ animationDelay: "420ms" }}
            className="term-line mt-3 max-w-lg text-base leading-7 text-[#c9d1c4]"
          >
            Drop in any GitHub repo and understand it by asking, not skimming.
            No more opening forty files just to find out how one feature works.
          </p>
          <p
            style={{ animationDelay: "480ms" }}
            className="term-line mt-2 text-sm leading-6 text-[#8a9180]"
          >
            Answers point back to the exact lines that support them.
          </p>

          <form
            style={{ animationDelay: "550ms" }}
            className="term-line mt-8"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center gap-2 rounded border border-[#2a2f26] bg-[#0a0c08] px-3 py-2.5 transition focus-within:border-[#4a7a3a]">
              <span className="shrink-0 text-sm text-[#7cc86a]">repo&gt;</span>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="github.com/user/repository"
                disabled={isSubmitting}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-[#e8ecdf] placeholder:text-[#4a4f42] focus:outline-none disabled:opacity-50"
              />
              {!isSubmitting && (
                <span className="term-cursor h-4 w-2 shrink-0 bg-[#7cc86a]" />
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !repoUrl.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-[#3d5c30] bg-[#1a2614] py-2.5 text-sm font-medium text-[#a9e097] transition hover:bg-[#233420] disabled:cursor-not-allowed disabled:border-[#2a2f26] disabled:bg-transparent disabled:text-[#4a4f42]"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#4a4f42] border-t-[#7cc86a]" />
                  running index --repo
                </>
              ) : (
                "run index --repo"
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 border-t border-[#2a2f26] pt-4 text-sm">
              <p className="text-[#e0776a]">
                <span className="text-[#5c6354]">[error] </span>
                {error}
              </p>
            </div>
          )}

          <div
            style={{ animationDelay: "650ms" }}
            className="term-line mt-8 space-y-1 border-t border-[#2a2f26] pt-4 text-xs text-[#5c6354]"
          >
            <p># 1. index clones and parses the repository</p>
            <p># 2. ask questions in plain language</p>
            <p># 3. every answer cites the file it came from</p>
          </div>
        </div>
      </div>
    </section>
  );
}
