"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-100 bg-bg-primary/92 backdrop-blur-[20px] border-b border-border px-8">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center h-[72px]">
        <Link href="/" className="font-heading font-extrabold text-xl text-text-primary tracking-[-0.5px] no-underline">
          MARC <span className="text-accent">WATTERS</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-8 items-center">
          <Link href="/about" className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">About</Link>
          <Link href="/testimonials" className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">Testimonials</Link>
          <Link href="/#how-it-works" className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">How It Works</Link>
          <Link href="/#portal-preview" className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">Client Portal</Link>
          <Link href="/apply" className="gradient-accent text-bg-primary px-6 py-2.5 rounded-md font-semibold text-[0.85rem] hover:opacity-90 transition-opacity no-underline">
            Apply for Coaching
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden bg-transparent border-none cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-7 h-7 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden pb-6 flex flex-col gap-4 px-4">
          <Link href="/about" onClick={() => setMobileOpen(false)} className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">About</Link>
          <Link href="/testimonials" onClick={() => setMobileOpen(false)} className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">Testimonials</Link>
          <Link href="/#how-it-works" onClick={() => setMobileOpen(false)} className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">How It Works</Link>
          <Link href="/#portal-preview" onClick={() => setMobileOpen(false)} className="text-text-secondary no-underline text-sm font-medium hover:text-text-primary transition-colors">Client Portal</Link>
          <Link href="/apply" onClick={() => setMobileOpen(false)} className="gradient-accent text-bg-primary px-6 py-2.5 rounded-md font-semibold text-[0.85rem] text-center no-underline">
            Apply for Coaching
          </Link>
        </div>
      )}
    </nav>
  );
}
