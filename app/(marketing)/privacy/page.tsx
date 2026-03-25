import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Construction Business Blueprint",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-[120px] pb-20 px-8">
      <div className="max-w-[700px] mx-auto">
        <h1 className="font-heading text-[2.25rem] font-black leading-[1.1] tracking-[-1px] mb-8">Privacy Policy</h1>
        <p className="text-text-muted text-sm mb-8">Last updated: 25 March 2026</p>

        <div className="space-y-8 text-text-secondary text-[0.95rem] leading-[1.85]">
          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Who We Are</h2>
            <p>This website is operated by Marc Watters trading as Construction Business Blueprint. We provide private mentorship and coaching services for trade and construction business owners across the UK and Ireland.</p>
            <p className="mt-2">Contact: info@constructionbusinessblueprint.co.uk</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">What Data We Collect</h2>
            <p>We collect the following information when you interact with our website:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Name, email address, and phone number (when you submit a form or apply for coaching)</li>
              <li>Business information you provide during your application</li>
              <li>Usage data such as pages visited and time on site (via cookies and analytics)</li>
              <li>Device and browser information</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To respond to coaching applications and enquiries</li>
              <li>To provide our mentorship services and client portal access</li>
              <li>To send relevant communications about our services</li>
              <li>To improve our website and marketing through analytics</li>
              <li>To deliver targeted advertising via Meta (Facebook/Instagram)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Cookies and Tracking</h2>
            <p>We use the Meta Pixel to measure advertising effectiveness and deliver relevant ads. This uses cookies to track website activity. By using this website, you consent to the use of these cookies.</p>
            <p className="mt-2">You can control cookies through your browser settings. Disabling cookies may affect your experience on this site.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Third-Party Services</h2>
            <p>We use the following third-party services that may process your data:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>GoHighLevel (CRM and form submissions)</li>
              <li>Meta Platforms (advertising and analytics)</li>
              <li>Vercel (website hosting)</li>
              <li>Supabase (client portal data storage)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Data Retention</h2>
            <p>We retain your personal data only for as long as necessary to fulfil the purposes outlined above, or as required by law. If you become a client, your data is retained for the duration of our working relationship and a reasonable period afterwards.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Your Rights</h2>
            <p>Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Request restriction of processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at info@constructionbusinessblueprint.co.uk.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-text-primary mb-3">Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
