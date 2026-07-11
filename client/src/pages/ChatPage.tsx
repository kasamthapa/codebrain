import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askQuestion } from "../api/askQuestion.api";

// Define what a message looks like
interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const repoUrl = location.state?.repoUrl || "";
  const indexMessage = location.state?.indexMessage || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  // if someone lands here without indexing a repo first, send them home
  useEffect(() => {
    if (!repoUrl) navigate("/");
  }, [repoUrl, navigate]);

  useEffect(() => {
    if (!query) return;

    async function handleRequest() {
      // 1. Add the user's question to the chat list immediately
      const userMessageId = Date.now();
      const botMessageId = userMessageId + 1;

      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", text: query },
      ]);

      let firstChunk = true;
      setIsStreaming(true);

      try {
        await askQuestion(repoUrl, query, (chunk: string) => {
          if (firstChunk) {
            firstChunk = false;
            setMessages((prev) => [
              ...prev,
              { id: botMessageId, role: "bot", text: chunk },
            ]);
          } else {
            setMessages((prev) => {
              // 3. For subsequent chunks, map through and update only that specific bot message
              return prev.map((msg) =>
                msg.id === botMessageId
                  ? { ...msg, text: msg.text + chunk }
                  : msg,
              );
            });
          }
        });
      } catch (error) {
        console.error("Failed to fetch streaming response:", error);
      } finally {
        setIsStreaming(false);
      }
    }

    handleRequest();
  }, [repoUrl, query]);

  // keep the log pinned to the latest line
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim()) return;

    setQuery(question);
    setQuestion(""); // Clear the input right away
  }

  const repoLabel = repoUrl
    ? repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")
    : "no repo";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0f0c] px-4 py-10 text-[#c9d1c4]">
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .term-cursor { animation: blink 1s step-end infinite; }
        @media (prefers-reduced-motion: reduce) {
          .term-cursor { animation: none !important; }
        }
      `}</style>

      <div className="flex h-[85vh] w-full max-w-3xl flex-col font-mono">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#2a2f26] bg-[#14170f] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4a4f42]" />
          <span className="ml-3 truncate text-xs text-[#5c6354]">
            codebrain — {repoLabel}
          </span>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="ml-auto flex shrink-0 items-center gap-1 rounded border border-[#2a2f26] px-2.5 py-1 text-xs text-[#8a9180] transition hover:border-[#3d5c30] hover:text-[#a9e097]"
          >
            &larr; new repo
          </button>
        </div>

        {/* chat log */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto border border-[#2a2f26] bg-[#0f120d] px-6 py-6 text-sm shadow-[0_0_60px_-15px_rgba(120,200,80,0.15)]"
        >
          {indexMessage && (
            <p className="text-[#7cc86a]">
              <span className="text-[#5c6354]">[ok] </span>
              {indexMessage}
            </p>
          )}

          {messages.length === 0 && (
            <p className="text-[#5c6354]">
              $ ready. ask a question about {repoLabel}.
            </p>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="leading-6">
              {msg.role === "user" ? (
                <p>
                  <span className="text-[#7cc86a]">you&gt;</span>{" "}
                  <span className="text-[#e8ecdf]">{msg.text}</span>
                </p>
              ) : (
                <div className="markdown-body">
                  <p className="mb-1 text-[#e0a458]">codebrain&gt;</p>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 text-[#c9d1c4] last:mb-0">
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-[#e8ecdf]">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-[#8a9180]">{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul className="my-2 ml-4 list-disc space-y-1 text-[#c9d1c4]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-2 ml-4 list-decimal space-y-1 text-[#c9d1c4]">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ children }) => (
                        <code className="rounded bg-[#1a2614] px-1.5 py-0.5 text-[#7cc86a]">
                          {children}
                        </code>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#7cc86a] underline underline-offset-2"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <p className="text-[#e0a458]">
                codebrain&gt; <span className="text-[#5c6354]">thinking…</span>
              </p>
            )}
        </div>

        {/* input */}
        <form
          onSubmit={handleSubmit}
          className="rounded-b-lg border border-[#2a2f26] bg-[#0f120d] p-3"
        >
          <div className="flex items-center gap-2 rounded border border-[#2a2f26] bg-[#0a0c08] px-3 py-2.5 transition focus-within:border-[#4a7a3a]">
            <span className="shrink-0 text-sm text-[#7cc86a]">you&gt;</span>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="ask codebrain..."
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-[#e8ecdf] placeholder:text-[#4a4f42] focus:outline-none"
            />
            {!isStreaming && (
              <span className="term-cursor h-4 w-2 shrink-0 bg-[#7cc86a]" />
            )}
            <button
              type="submit"
              disabled={!question.trim()}
              className="shrink-0 rounded border border-[#3d5c30] bg-[#1a2614] px-4 py-1.5 text-sm font-medium text-[#a9e097] transition hover:bg-[#233420] disabled:cursor-not-allowed disabled:border-[#2a2f26] disabled:bg-transparent disabled:text-[#4a4f42]"
            >
              send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatPage;
