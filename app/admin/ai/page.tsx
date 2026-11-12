"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      return (
        <Link
          key={i}
          href={linkMatch[2]}
          className="ws-link"
        >
          {linkMatch[1]}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className="ws-ai-strong">
          {line.slice(2, -2)}
        </p>
      );
    }
    const boldParts = line.split(/(\*\*.*?\*\*)/g);
    const rendered = boldParts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="ws-ai-strong">{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{renderMarkdown(part)}</span>;
    });
    if (line.trim() === "") return <br key={i} />;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li key={i} className="ws-ai-li">
          {rendered.slice(0, 1)}
          {boldParts.length > 1 ? rendered.slice(1) : renderMarkdown(line.slice(2))}
        </li>
      );
    }
    return <p key={i}>{rendered}</p>;
  });
}

export default function AdminBlueprintAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

      currentPage.style.setProperty("--admin-ai-top", `${Math.floor(pageTop)}px`);
      currentPage.style.setProperty("--admin-ai-bottom", `${Math.ceil(bottomClearance)}px`);
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
        scrollArea.scrollTop += responseBounds.top - scrollBounds.top - 16;
      } else {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }

      pendingScrollRef.current = null;
      const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
      isPinnedToLatestRef.current = distanceFromBottom < 80;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  function focusComposerForKeyboardUser(delay: number) {
    window.setTimeout(() => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      inputRef.current?.focus({ preventScroll: true });
    }, delay);
  }

  function appendAssistantMessage(conversation: Message[], content: string) {
    pendingScrollRef.current = isPinnedToLatestRef.current ? "response-start" : null;
    setMessages([...conversation, { role: "assistant", content }]);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    pendingScrollRef.current = "bottom";
    isPinnedToLatestRef.current = true;
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      if (!res.ok) {
        appendAssistantMessage(updated, "Sorry, something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      appendAssistantMessage(updated, data.reply);
    } catch {
      appendAssistantMessage(updated, "Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
      focusComposerForKeyboardUser(100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleConversationScroll(event: React.UIEvent<HTMLDivElement>) {
    const scrollArea = event.currentTarget;
    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    isPinnedToLatestRef.current = distanceFromBottom < 80;
  }

  return (
    <div
      ref={pageRef}
      className="ws ws-ai mx-auto flex h-[calc(100dvh-2rem)] min-h-0 max-w-3xl flex-col overflow-hidden"
      style={{ height: "max(240px, calc(100dvh - var(--admin-ai-top, 2rem) - var(--admin-ai-bottom, 0px)))" }}
      data-admin-ai-shell
    >
      <div className="ws-ai-head shrink-0">
        <h1 className="ws-title">Blueprint AI</h1>
        <p className="ws-meta mt-1">
          Your coaching business assistant - ask about clients, training, check-ins, or business plans.
        </p>
      </div>

      <div
        ref={scrollAreaRef}
        onScroll={handleConversationScroll}
        className="ws-ai-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
        data-admin-ai-scroll
        aria-live="polite"
      >
        <div className="ws-ai-thread flex min-h-full flex-col">
          {messages.length === 0 && !loading && (
            <div className="ws-ai-empty flex min-h-full flex-col items-center justify-center text-center">
              <span className="ws-ai-glyph">
                <Icon name="bulb" size={20} />
              </span>
              <h2 className="ws-ai-empty-h">How can I help?</h2>
              <p className="ws-ai-empty-p">
                I know all your clients, their plans, check-ins, and training modules. Ask me anything.
              </p>
              <div className="ws-ai-prompts">
                {[
                  "Which clients need attention this week?",
                  "Summarise recent check-ins",
                  "Who hasn't checked in recently?",
                  "Draft a reply to the latest check-in",
                  "Which clients are on track?",
                  "What training should I assign next?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="ws-ai-prompt ws-focus"
                  >
                    <Icon name="sparkle" size={13} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && <div className="mt-auto" aria-hidden="true" />}

          {messages.map((msg, i) => (
            <div
              key={i}
              ref={msg.role === "assistant" && i === messages.length - 1 ? latestAssistantRef : undefined}
              className={`ws-ai-msg flex shrink-0 ${msg.role === "user" ? "is-own justify-end" : "justify-start"}`}
            >
              <div className="ws-ai-bubble">
                <div className="ws-ai-text">
                  {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="ws-ai-msg flex shrink-0 justify-start" role="status">
              <div className="ws-ai-bubble ws-ai-wait">
                <span className="ws-skel" style={{ width: 180, height: 9 }} />
                <span className="ws-skel" style={{ width: 120, height: 9 }} />
                <span className="sr-only">Thinking</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ws-ai-composer relative shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Blueprint AI..."
          rows={1}
          className="ws-ai-input"
          style={{ minHeight: "48px", maxHeight: "120px" }}
          aria-label="Ask Blueprint AI"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          aria-label="Send message"
          className="ws-ai-send ws-focus"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
