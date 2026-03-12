import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Call with Marc | Marc Watters",
  description: "Pick the time that works for you, fill in your details and we'll see you soon.",
};

export default function BookMarcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
