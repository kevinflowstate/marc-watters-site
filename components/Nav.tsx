"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[1000] backdrop-blur-[24px] backdrop-saturate-[1.2] px-8 transition-colors duration-300 ${
        scrolled
          ? "bg-[rgba(5,5,7,0.95)] border-b border-[rgba(34,114,222,0.1)]"
          : "bg-[rgba(5,5,7,0.8)] border-b border-[rgba(255,255,255,0.04)]"
      }`}
    >
      <div className="max-w-[1200px] mx-auto flex justify-between items-center h-[72px]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Image src="/images/cbb-logo.png" alt="CBB Logo" width={34} height={34} className="h-[34px] w-auto" />
          <span className="font-heading font-extrabold text-[1.1rem] text-text-primary tracking-[-0.5px]">
            MARC <span className="text-accent-light">WATTERS</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-8 items-center">
          {[
            { href: "/about", label: "About" },
            { href: "/testimonials", label: "Testimonials" },
            { href: "/#how-it-works", label: "How It Works" },
            { href: "/articles", label: "Articles" },
            { href: "/#portal-preview", label: "Client Portal" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-text-secondary no-underline text-[0.88rem] font-medium hover:text-text-primary transition-colors duration-300 group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent scale-x-0 origin-right group-hover:scale-x-100 group-hover:origin-left transition-transform duration-300" />
            </Link>
          ))}
          <Link
            href="/apply"
            className="bg-accent text-white px-6 py-2.5 rounded-lg font-semibold text-[0.85rem] no-underline transition-all duration-300 hover:bg-accent-light hover:-translate-y-px hover:shadow-[0_0_20px_rgba(34,114,222,0.4)]"
          >
            Apply for Coaching
          </Link>
        </div>

        {/* Mobile */}
        <button className="md:hidden bg-transparent border-none cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="w-7 h-7 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden pb-6 flex flex-col gap-4 px-4">
          {["About", "Testimonials", "How It Works", "Articles", "Client Portal"].map((label) => (
            <Link
              key={label}
              href={label === "About" ? "/about" : label === "Testimonials" ? "/testimonials" : label === "Articles" ? "/articles" : `/#${label.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMobileOpen(false)}
              className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/apply"
            onClick={() => setMobileOpen(false)}
            className="bg-accent text-white px-6 py-2.5 rounded-lg font-semibold text-[0.85rem] text-center no-underline"
          >
            Apply for Coaching
          </Link>
        </div>
      )}
    </nav>
  );
}
