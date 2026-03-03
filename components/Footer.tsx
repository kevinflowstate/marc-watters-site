import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="pt-20 pb-10 px-8 border-t border-[rgba(255,255,255,0.03)] bg-bg-primary relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.15)] to-transparent" />

      <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/images/cbb-logo.png" alt="CBB" width={28} height={28} className="h-7 w-auto" />
            <span className="font-heading font-extrabold text-[0.95rem] text-text-primary">Marc Watters</span>
          </div>
          <p className="text-text-muted text-[0.85rem] leading-[1.7] max-w-[280px]">
            Private mentorship for trade and construction business owners who want profit, structure, and a business that works without them.
          </p>
        </div>

        <div>
          <h4 className="font-heading text-[0.8rem] font-bold mb-4 text-text-primary uppercase tracking-[1px]">Pages</h4>
          {[
            { href: "/about", label: "About" },
            { href: "/testimonials", label: "Testimonials" },
            { href: "/#how-it-works", label: "How It Works" },
            { href: "/articles", label: "Articles" },
            { href: "/apply", label: "Apply" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="block text-text-muted no-underline text-[0.85rem] mb-2.5 hover:text-accent-light hover:translate-x-[3px] transition-all duration-300">
              {link.label}
            </Link>
          ))}
        </div>

        <div>
          <h4 className="font-heading text-[0.8rem] font-bold mb-4 text-text-primary uppercase tracking-[1px]">Listen</h4>
          {["Spotify Podcast", "YouTube Channel", "Instagram", "LinkedIn"].map((label) => (
            <a key={label} href="#" className="block text-text-muted no-underline text-[0.85rem] mb-2.5 hover:text-accent-light hover:translate-x-[3px] transition-all duration-300">
              {label}
            </a>
          ))}
        </div>

        <div>
          <h4 className="font-heading text-[0.8rem] font-bold mb-4 text-text-primary uppercase tracking-[1px]">Legal</h4>
          <a href="#" className="block text-text-muted no-underline text-[0.85rem] mb-2.5 hover:text-accent-light hover:translate-x-[3px] transition-all duration-300">Privacy Policy</a>
          <a href="#" className="block text-text-muted no-underline text-[0.85rem] mb-2.5 hover:text-accent-light hover:translate-x-[3px] transition-all duration-300">Terms of Service</a>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-[rgba(255,255,255,0.03)] flex flex-col sm:flex-row justify-between items-center gap-4 text-[0.78rem] text-text-muted">
        <span>2026 Marc Watters. All rights reserved.</span>
        <div className="flex gap-3">
          {[
            { title: "Instagram", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
            { title: "YouTube", d: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
            { title: "Spotify", d: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" },
            { title: "LinkedIn", d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
          ].map((icon) => (
            <a
              key={icon.title}
              href="#"
              title={icon.title}
              className="text-text-muted w-[38px] h-[38px] flex items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.04)] bg-[rgba(12,12,18,0.6)] hover:text-accent-light hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(34,114,222,0.1)] transition-all duration-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d={icon.d} /></svg>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
