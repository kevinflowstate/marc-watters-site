import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultCheckinConfig } from "@/lib/checkins";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CheckIn, CheckinFormConfig, FormQuestion } from "@/lib/types";

function formatCheckinDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PortalCheckinReplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const admin = createAdminClient();
  const [{ data: clientProfile }, { data: configRow }] = await Promise.all([
    admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single<{ id: string }>(),
    admin
      .from("form_config")
      .select("config")
      .eq("form_type", "checkin")
      .maybeSingle<{ config: CheckinFormConfig }>(),
  ]);

  if (!clientProfile) {
    notFound();
  }

  const { data: checkin } = await admin
    .from("checkins")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientProfile.id)
    .single<CheckIn>();

  if (!checkin) {
    notFound();
  }

  const checkinConfig = configRow?.config || defaultCheckinConfig;
  const questions = checkinConfig.questions || [];
  const answeredQuestions = checkin.responses
    ? questions
        .map((question) => ({
          question,
          answer: getQuestionAnswerLabel(question, checkin.responses),
        }))
        .filter(
          (entry): entry is { question: FormQuestion; answer: string } =>
            Boolean(entry.answer),
        )
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-[rgba(255,255,255,0.05)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <Link
          href="/portal/inbox"
          className="inline-flex items-center gap-2 rounded-xl border border-[rgba(34,114,222,0.18)] bg-[rgba(34,114,222,0.08)] px-4 py-2 text-sm text-accent-bright no-underline transition-colors hover:bg-[rgba(34,114,222,0.12)]"
        >
          Message Marc
        </Link>
      </div>

      <div className="rounded-3xl border border-[rgba(34,114,222,0.16)] bg-[linear-gradient(180deg,rgba(34,114,222,0.08),rgba(255,255,255,0.02))] p-6">
        <div className="inline-flex rounded-full border border-[rgba(34,114,222,0.18)] bg-[rgba(34,114,222,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">
          Check-In Reply
        </div>
        <h1 className="mt-4 text-3xl font-heading font-bold text-text-primary">
          Marc replied to your Week {checkin.week_number} check-in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Your original check-in and Marc&apos;s reply are below in one place, so you do not need to
          hunt between the dashboard and inbox.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">Your Check-In</div>
              <div className="text-xs text-text-muted mt-1">
                Submitted {formatCheckinDate(checkin.created_at)}
              </div>
            </div>
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-medium text-text-secondary">
              Week {checkin.week_number}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {answeredQuestions.length > 0 ? (
              answeredQuestions.map(({ question, answer }) => (
                <div key={question.id}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
                    {question.label}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
                    {answer}
                  </p>
                </div>
              ))
            ) : (
              <>
                {checkin.wins && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">Wins</div>
                    <p className="text-sm leading-relaxed text-text-secondary">{checkin.wins}</p>
                  </div>
                )}
                {checkin.challenges && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">Challenges</div>
                    <p className="text-sm leading-relaxed text-text-secondary">{checkin.challenges}</p>
                  </div>
                )}
                {checkin.questions && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">Questions</div>
                    <p className="text-sm leading-relaxed text-text-secondary">{checkin.questions}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[rgba(34,114,222,0.18)] bg-[rgba(34,114,222,0.08)] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">
              Marc&apos;s Reply
            </div>
            {checkin.admin_reply ? (
              <>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text-primary">
                  {checkin.admin_reply}
                </p>
                {checkin.replied_at && (
                  <div className="mt-4 text-xs text-text-muted">
                    Replied {formatCheckinDate(checkin.replied_at)}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                Marc has not replied to this check-in yet.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-5">
            <div className="text-sm font-semibold text-text-primary">Need to reply back?</div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              If you want to ask a follow-up question about this check-in, send Marc a message in your inbox.
            </p>
            <Link
              href="/portal/inbox"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent-bright no-underline hover:text-accent-light"
            >
              Open Inbox
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
