"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { WsNotice as InlineNotice } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

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
      className={`ws-ai-mark ${
        compact ? "is-sm" : ""
      }`}
      aria-hidden
    >
      <Icon name="bulb" size={compact ? 14 : 18} />
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
        className="ws-ai-a"
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
        <strong key={index} className="ws-ai-strong">
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
        <ul key={`list-${items[0].lineIndex}`} className="ws-ai-ul">
          {items.map((item) => (
            <li key={item.lineIndex} className="ws-ai-li">
              {renderContentLine(item.content)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("**") && line.endsWith("**")) {
      blocks.push(
        <h3 key={index} className="ws-ai-h">
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

const AssistantMessage = memo(function AssistantMessage({
  content,
  messageRef,
}: {
  content: string;
  messageRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={messageRef} className="ws-ai-msg">
      <BlueprintIcon compact />
      <div className="min-w-0 flex-1">
        <div className="ws-ai-who">Blueprint AI</div>
        <div className="ws-ai-body">{renderContent(content)}</div>
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
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const isPinnedToLatestRef = useRef(true);
  const pendingScrollRef = useRef<"bottom" | "response-start" | null>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const bodyOverflow = document.body.style.overflowY;
    const htmlOverflow = document.documentElement.style.overflowY;
    let orientationTimeout = 0;

    function updateLayoutOffsets() {
      const currentPage = pageRef.current;
      if (!currentPage) return;

      const pageTop = Math.max(currentPage.getBoundingClientRect().top, 0);
      const mobileNav = window.innerWidth < 1024
        ? document.querySelector<HTMLElement>(".adm-bottomnav")
        : null;
      const bottomClearance = mobileNav ? mobileNav.getBoundingClientRect().height + 8 : 16;

      currentPage.style.setProperty("--blueprint-ai-top", `${Math.floor(pageTop)}px`);
      currentPage.style.setProperty("--blueprint-ai-bottom", `${Math.ceil(bottomClearance)}px`);
    }

    window.scrollTo({ top: 0, left: 0 });
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";

    updateLayoutOffsets();
    const settleTimeouts = [
      window.setTimeout(updateLayoutOffsets, 250),
      window.setTimeout(updateLayoutOffsets, 1000),
    ];

    function handleOrientationChange() {
      window.clearTimeout(orientationTimeout);
      orientationTimeout = window.setTimeout(updateLayoutOffsets, 250);
    }

    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      settleTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      window.clearTimeout(orientationTimeout);
      window.removeEventListener("orientationchange", handleOrientationChange);
      document.body.style.overflowY = bodyOverflow;
      document.documentElement.style.overflowY = htmlOverflow;
    };
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const pendingScroll = pendingScrollRef.current;
    if (!scrollArea || !pendingScroll) return;

    const frame = window.requestAnimationFrame(() => {
      if (pendingScroll === "response-start" && latestAssistantRef.current) {
        const scrollBounds = scrollArea.getBoundingClientRect();
        const responseBounds = latestAssistantRef.current.getBoundingClientRect();
        scrollArea.scrollTop += responseBounds.top - scrollBounds.top - 24;
      } else {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }

      pendingScrollRef.current = null;
      const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
      isPinnedToLatestRef.current = distanceFromBottom < 80;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading, error]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, []);

  function focusComposerForKeyboardUser(delay: number) {
    window.setTimeout(() => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      inputRef.current?.focus({ preventScroll: true });
    }, delay);
  }

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

    pendingScrollRef.current = "bottom";
    isPinnedToLatestRef.current = true;
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
        pendingScrollRef.current = isPinnedToLatestRef.current ? "bottom" : null;
        setError(errorMessageForResponse(response.status, data.error));
        setFailedPrompt(trimmed);
        return;
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        pendingScrollRef.current = isPinnedToLatestRef.current ? "bottom" : null;
        setError("Blueprint AI returned an empty response. Please try again.");
        setFailedPrompt(trimmed);
        return;
      }

      pendingScrollRef.current = isPinnedToLatestRef.current ? "response-start" : null;
      setMessages([...visibleConversation, { role: "assistant", content: data.reply }]);
    } catch (requestError) {
      if ((requestError as Error).name === "AbortError" || requestId !== requestIdRef.current) return;
      pendingScrollRef.current = isPinnedToLatestRef.current ? "bottom" : null;
      setError("Blueprint AI couldn’t connect. Check your connection and try again.");
      setFailedPrompt(trimmed);
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setLoading(false);
        focusComposerForKeyboardUser(100);
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

  function handleConversationScroll(event: React.UIEvent<HTMLDivElement>) {
    const scrollArea = event.currentTarget;
    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    isPinnedToLatestRef.current = distanceFromBottom < 80;
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
    pendingScrollRef.current = null;
    isPinnedToLatestRef.current = true;
    focusComposerForKeyboardUser(50);
  }

  const hasConversation = messages.length > 0;

  return (
    <div
      ref={pageRef}
      className="ws ws-ai mx-auto flex h-[calc(100dvh-7.5rem)] min-h-0 max-w-5xl flex-col overflow-hidden"
      style={{ height: "max(240px, calc(100dvh - var(--blueprint-ai-top, 7.5rem) - var(--blueprint-ai-bottom, 0px)))" }}
      data-blueprint-ai-shell
    >
      <header
        className={`ws-ph ws-ai-head ${
          hasConversation ? "has-chat" : ""
        }`}
      >
        <div className="min-w-0">
          <h1 className="ws-title">Blueprint AI</h1>
          <p className={`ws-meta mt-1 max-w-2xl ${hasConversation ? "hidden sm:block" : ""}`}>
            Ask practical questions about your Business Plan, assigned training and next steps.
          </p>
        </div>

        {hasConversation && (
          <button type="button" onClick={clearConversation} className="ws-btn ws-focus shrink-0" aria-label="New conversation">
            <Icon name="plus" size={14} />
            <span className="sm:hidden">New chat</span>
            <span className="hidden sm:inline">New conversation</span>
          </button>
        )}
      </header>

      <section className="ws-panel ws-ai-panel" aria-label="Blueprint AI conversation">
        <div className="ws-panel-head ws-ai-bar">
          <div className="flex min-w-0 items-center gap-3">
            <BlueprintIcon compact />
            <div className="min-w-0">
              <div className="ws-h2">Blueprint AI</div>
              <div className="ws-caption">
                <span className="sm:hidden">Uses your plan and training</span>
                <span className="hidden sm:inline">Your plan and assigned training provide context</span>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={scrollAreaRef}
          onScroll={handleConversationScroll}
          className="ws-ai-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
          data-blueprint-ai-scroll
          aria-live="polite"
        >
          {!hasConversation && !loading ? (
            <div className="ws-ai-start">
              <div className="w-full max-w-2xl">
                <div className="ws-ai-start-head">
                  <BlueprintIcon />
                  <h2 className="ws-cd-h">
                    What would help you move forward?
                  </h2>
                  <p className="ws-meta">
                    Ask a direct question, work through a decision or get clarity on the next action in your plan.
                  </p>
                </div>

                <div className="ws-ai-prompts">
                  {suggestedPrompts.map((suggestion) => (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => handleSend(suggestion.prompt)}
                      className="ws-ai-prompt ws-focus"
                    >
                      <span className="ws-ai-prompt-ic">
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={suggestion.icon} />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="ws-ai-prompt-l">{suggestion.label}</span>
                        <span className="ws-ai-prompt-t">{suggestion.prompt}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="ws-ai-thread">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div key={index} className="ws-ai-user">
                    <div className="ws-ai-bubble">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={index}
                    content={message.content}
                    messageRef={index === messages.length - 1 ? latestAssistantRef : undefined}
                  />
                ),
              )}

              {loading && (
                <div className="ws-ai-msg" role="status">
                  <BlueprintIcon compact />
                  <div className="min-w-0">
                    <div className="ws-ai-who">Blueprint AI</div>
                    <div className="ws-ai-thinking">
                      <span className="ws-ai-dots" aria-hidden>
                        {[0, 160, 320].map((delay) => (
                          <span
                            key={delay}
                            className="ws-ai-dot"
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
                    <button type="button" onClick={handleRetry} disabled={loading} className="ws-btn ws-btn-sm ws-focus">
                      Try again
                    </button>
                  }
                >
                  {error}
                </InlineNotice>
              )}
            </div>
          )}
        </div>

        <div className="ws-ai-foot">
          <div className="mx-auto max-w-3xl">
            <div className="ws-ai-box">
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
                className="ws-ai-input"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="ws-ai-send ws-focus"
              >
                <Icon name="send" size={15} />
              </button>
            </div>
            <p className="ws-caption ws-ai-note">
              Blueprint AI can support your thinking. Check important business decisions with Marc.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
