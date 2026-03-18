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
          {[
            { href: "https://open.spotify.com/show/5zlVU4gsqmvC0quDKrQheq", label: "Spotify Podcast" },
            { href: "https://www.youtube.com/@TheConstructionBusinessCoach", label: "YouTube Channel" },
            { href: "https://podcasts.apple.com/us/podcast/marc-watters-construction-business-blueprint/id1842833723", label: "Apple Podcasts" },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="block text-text-muted no-underline text-[0.85rem] mb-2.5 hover:text-accent-light hover:translate-x-[3px] transition-all duration-300">
              {link.label}
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
            { title: "YouTube", href: "https://www.youtube.com/@TheConstructionBusinessCoach", d: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
            { title: "Spotify", href: "https://open.spotify.com/show/5zlVU4gsqmvC0quDKrQheq", d: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" },
            { title: "Apple Podcasts", href: "https://podcasts.apple.com/us/podcast/marc-watters-construction-business-blueprint/id1842833723", d: "M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.6-.24 1.2-.84 1.32-.6.12-1.2-.24-1.32-.84-.264-1.344-.792-2.4-1.68-3.324-1.272-1.332-2.868-1.992-4.56-1.992-1.692 0-3.336.708-4.56 1.992-.888.924-1.416 1.98-1.68 3.324-.12.6-.72.96-1.32.84-.6-.12-.96-.72-.84-1.32.352-1.773 1.04-3.12 2.264-4.392 1.656-1.685 3.72-2.587 6.216-2.587zM11.88 6.72c1.536 0 2.904.588 3.96 1.692.804.84 1.296 1.812 1.536 3.048.072.6-.312 1.152-.912 1.248-.6.072-1.152-.312-1.248-.912-.144-.804-.456-1.416-.984-1.968-.672-.708-1.464-1.044-2.376-1.044s-1.704.336-2.376 1.044c-.528.552-.84 1.164-.984 1.968-.096.6-.648.984-1.248.912-.6-.096-.984-.648-.912-1.248.24-1.236.732-2.208 1.536-3.048 1.08-1.104 2.424-1.692 4.008-1.692zm-.024 4.176c1.224 0 2.232 1.008 2.232 2.232 0 .792-.408 1.488-1.032 1.872v5.88c0 .648-.528 1.176-1.176 1.176-.648 0-1.176-.528-1.176-1.176V15c-.648-.384-1.08-1.08-1.08-1.872 0-1.224 1.008-2.232 2.232-2.232z" },
          ].map((icon) => (
            <a
              key={icon.title}
              href={icon.href}
              target="_blank"
              rel="noopener noreferrer"
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
