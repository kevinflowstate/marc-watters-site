"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { InlineNotice } from "@/components/ui/PortalState";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestedPrompts = [
  {
    label: "Weekly focus",
    prompt: "What should I focus on this week?",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4",
  },
  {
    label: "Pricing",
    prompt: "Help me with pricing my services",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    label: "Training",
    prompt: "What training do I have left?",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    label: "Plan progress",
    prompt: "Summarise my business plan progress",
    icon: "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z",
  },
];

function BlueprintIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center border border-accent/25 bg-accent/10 text-accent-bright ${
        compact ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-[var(--cbb-radius-md)]"
      }`}
      aria-hidden
    >
      <svg className={compact ? "h-4 w-4" : "h-6 w-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547Z" />
      </svg>
    </span>
  );
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);

  return parts.map((part, index) => {
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (!linkMatch) return <span key={index}>{part}</span>;

    return (
      <Link
        key={index}
        href={linkMatch[2]}
        className="font-semibold text-accent-bright underline decoration-accent/30 underline-offset-4 hover:decoration-accent-bright"
      >
        {linkMatch[1]}
      </Link>
    );
  });
}

function renderContentLine(line: string) {
  return line.split(/(\*\*.*?\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={index}>{renderMarkdown(part)}</span>;
  });
}

function renderContent(text: string) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: { content: string; lineIndex: number }[] = [];
      while (index < lines.length && (lines[index].startsWith("- ") || lines[index].startsWith("* "))) {
        items.push({ content: lines[index].slice(2), lineIndex: index });
        index += 1;
      }
      blocks.push(
        <ul key={`list-${items[0].lineIndex}`} className="space-y-1.5 pl-5">
          {items.map((item) => (
            <li key={item.lineIndex} className="list-disc pl-1 marker:text-accent-bright">
              {renderContentLine(item.content)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("**") && line.endsWith("**")) {
      blocks.push(
        <h3 key={index} className="font-semibold text-text-primary">
          {line.slice(2, -2)}
        </h3>,
      );
      index += 1;
      continue;
    }

    blocks.push(<p key={index}>{renderContentLine(line)}</p>);
    index += 1;
  }

  return blocks;
}

function errorMessageForResponse(status: number, serverMessage?: string) {
  if (status === 429) {
    return "Blueprint AI is receiving a lot of requests. Please wait a moment, then try again.";
  }

  if (status === 503) {
    return serverMessage || "Blueprint AI is temporarily unavailable. Please try again later or contact Marc.";
  }

  return serverMessage || "Blueprint AI couldn’t complete that response. Please try again.";
}

const AssistantMessage = memo(function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3">
      <BlueprintIcon compact />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-2 text-xs font-bold text-accent-bright">Blueprint AI</div>
        <div className="space-y-2 text-sm leading-7 text-text-secondary">{renderContent(content)}</div>
      </div>
    </div>
  );
});

export default function BlueprintAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedPrompt, setFailedPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [messages, loading, error]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, []);

  async function submitPrompt(prompt: string, conversation: Message[], isRetry = false) {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const userMessage: Message = { role: "user", content: trimmed };
    const visibleConversation = isRetry ? conversation : [...conversation, userMessage];
    const requestHistory = isRetry ? conversation.slice(0, -1) : conversation;

    setMessages(visibleConversation);
    setInput("");
    setError("");
    setFailedPrompt("");
    setLoading(true);

    if (inputRef.current) inputRef.current.style.height = "48px";

    try {
      const response = await fetch("/api/portal/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: requestHistory,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        setError(errorMessageForResponse(response.status, data.error));
        setFailedPrompt(trimmed);
        return;
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        setError("Blueprint AI returned an empty response. Please try again.");
        setFailedPrompt(trimmed);
        return;
      }

      setMessages([...visibleConversation, { role: "assistant", content: data.reply }]);
    } catch (requestError) {
      if ((requestError as Error).name === "AbortError" || requestId !== requestIdRef.current) return;
      setError("Blueprint AI couldn’t connect. Check your connection and try again.");
      setFailedPrompt(trimmed);
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setLoading(false);
        window.setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }

  function handleSend(override?: string) {
    void submitPrompt(override || input, messages);
  }

  function handleRetry() {
    if (!failedPrompt) return;
    void submitPrompt(failedPrompt, messages, true);
  }

  function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    event.currentTarget.style.height = "48px";
    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 128)}px`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function clearConversation() {
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setMessages([]);
    setError("");
    setFailedPrompt("");
    setInput("");
    setLoading(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  const hasConversation = messages.length > 0;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] min-h-[600px] max-w-5xl flex-col lg:h-[calc(100vh-5rem)]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="v2-eyebrow mb-3">Coaching support</div>
          <h1 className="v2-page-title">Blueprint AI</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Ask practical questions about your Business Plan, assigned training and next steps.
          </p>
        </div>

        {hasConversation && (
          <button type="button" onClick={clearConversation} className="v2-button-secondary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14m7-7H5" />
            </svg>
            New conversation
          </button>
        )}
      </header>

      <section className="v2-surface flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Blueprint AI conversation">
        <div className="flex min-h-14 items-center gap-4 border-b border-white/[0.065] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <BlueprintIcon compact />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary">Blueprint AI</div>
              <div className="text-xs text-text-muted">
                <span className="sm:hidden">Uses your plan and training</span>
                <span className="hidden sm:inline">Your plan and assigned training provide context</span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
          {!hasConversation && !loading ? (
            <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-8">
              <div className="w-full max-w-2xl">
                <div className="flex flex-col items-center text-center">
                  <BlueprintIcon />
                  <h2 className="mt-4 font-heading text-xl font-bold tracking-[-0.02em] text-text-primary">
                    What would help you move forward?
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-secondary">
                    Ask a direct question, work through a decision or get clarity on the next action in your plan.
                  </p>
                </div>

                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                  {suggestedPrompts.map((suggestion) => (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => handleSend(suggestion.prompt)}
                      className="group flex min-h-16 items-center gap-3 rounded-[var(--cbb-radius-md)] border border-white/[0.075] bg-white/[0.02] px-4 py-3 text-left transition-[border-color,background-color] duration-200 hover:border-accent/30 hover:bg-accent/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/70 motion-reduce:transition-none"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-text-muted transition-colors group-hover:border-accent/20 group-hover:text-accent-bright">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={suggestion.icon} />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-accent-bright">{suggestion.label}</span>
                        <span className="mt-0.5 block text-sm leading-snug text-text-primary">{suggestion.prompt}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[88%] rounded-[var(--cbb-radius-md)] rounded-br-sm border border-accent/20 bg-accent/12 px-4 py-3 text-sm leading-6 text-text-primary sm:max-w-[76%]">
                      {message.content}
                    </div>
                  </div>
                ) : <AssistantMessage key={index} content={message.content} />,
              )}

              {loading && (
                <div className="flex items-start gap-3" role="status">
                  <BlueprintIcon compact />
                  <div className="pt-1">
                    <div className="mb-2 text-xs font-bold text-accent-bright">Blueprint AI</div>
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <span className="flex items-center gap-1.5" aria-hidden>
                        {[0, 160, 320].map((delay) => (
                          <span
                            key={delay}
                            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-bright/65"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                      Thinking through your question…
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <InlineNotice
                  tone="error"
                  action={
                    <button type="button" onClick={handleRetry} disabled={loading} className="text-xs font-bold text-red-100 underline underline-offset-4 disabled:opacity-50">
                      Try again
                    </button>
                  }
                >
                  {error}
                </InlineNotice>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.065] bg-black/10 p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative rounded-[var(--cbb-radius-md)] border border-white/[0.1] bg-white/[0.035] p-1.5 transition-colors focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/10">
              <label htmlFor="blueprint-ai-message" className="sr-only">Ask Blueprint AI</label>
              <textarea
                id="blueprint-ai-message"
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask Blueprint AI…"
                rows={1}
                disabled={loading}
                className="block min-h-12 max-h-32 w-full resize-none bg-transparent py-3 pl-3 pr-14 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-[var(--cbb-radius-sm)] border border-accent/25 bg-accent text-white shadow-[0_6px_18px_rgba(34,114,222,0.2)] transition-[background-color,opacity] hover:bg-accent-light disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-white/[0.04] disabled:text-text-muted disabled:shadow-none"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0-7 7m7-7 7 7" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-text-muted">
              Blueprint AI can support your thinking. Check important business decisions with Marc.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
