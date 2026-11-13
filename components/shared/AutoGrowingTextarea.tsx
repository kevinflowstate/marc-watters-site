"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";

type Props = Omit<ComponentPropsWithoutRef<"textarea">, "value"> & {
  value: string;
  maxHeight?: number;
};

/** Grow for typing, pasted text and loaded drafts; keep long replies within the viewport. */
export default function AutoGrowingTextarea({
  value,
  maxHeight = 320,
  style,
  ...props
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const field = ref.current;
    if (!field) return;
    const previousScrollTop = field.scrollTop;
    const typingAtEnd =
      document.activeElement === field &&
      field.selectionStart === field.value.length &&
      field.selectionEnd === field.value.length;
    const minimum = Number.parseFloat(getComputedStyle(field).minHeight) || 0;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const limit = Math.max(minimum, Math.min(maxHeight, viewportHeight * 0.4));
    field.style.maxHeight = `${limit}px`;
    field.style.height = "auto";
    const css = getComputedStyle(field);
    const borders =
      (Number.parseFloat(css.borderTopWidth) || 0) +
      (Number.parseFloat(css.borderBottomWidth) || 0);
    const height = field.scrollHeight + borders;
    field.style.height = `${Math.min(height, limit)}px`;
    field.style.overflowY = height > limit ? "auto" : "hidden";
    // Measuring at auto height can reset scroll position. Keep the active last
    // line visible, and preserve the reading position when editing in the middle.
    field.scrollTop =
      height > limit
        ? typingAtEnd
          ? field.scrollHeight
          : previousScrollTop
        : 0;
  }, [maxHeight]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    let width = field.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = field.getBoundingClientRect().width;
      // Ignore our own height changes, but remeasure when text wraps at a new width.
      if (nextWidth !== width) {
        width = nextWidth;
        resize();
      }
    });
    observer.observe(field);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [resize]);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      style={{ ...style, boxSizing: "border-box", resize: "none" }}
    />
  );
}
