import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultCheckinConfig } from "@/lib/checkins";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CheckIn, CheckinFormConfig, FormQuestion } from "@/lib/types";
import { Chip, Icon } from "@/components/ops/workspace/WorkspaceUI";

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
    <div className="ws ws-page ws-cr-page">
      <div className="ws-cr-nav">
        <Link
          href="/portal"
          className="ws-back ws-focus"
        >
          <Icon name="chevron" size={14} className="ws-back-ic" />
          Back to dashboard
        </Link>
        <Link
          href="/portal/inbox"
          className="ws-btn ws-btn-sm ws-focus"
        >
          Message Marc
        </Link>
      </div>

      <div className="ws-ph">
        <div className="min-w-0">
          <div className="ws-caption">Check-in reply</div>
          <h1 className="ws-title mt-1">
            Marc replied to your Week {checkin.week_number} check-in
          </h1>
          <p className="ws-meta mt-1">
            Your original check-in and Marc&apos;s reply are below in one place, so you do not need to
            hunt between the dashboard and inbox.
          </p>
        </div>
      </div>

      <div className="ws-cr-grid">
        <section className="ws-panel min-w-0">
          <div className="ws-panel-head">
            <div className="min-w-0 ws-cr-head-t">
              <h2 className="ws-h2">Your check-in</h2>
              <div className="ws-caption">
                Submitted {formatCheckinDate(checkin.created_at)}
              </div>
            </div>
            <Chip>
              Week {checkin.week_number}
            </Chip>
          </div>

          <div className="ws-cr-answers">
            {answeredQuestions.length > 0 ? (
              answeredQuestions.map(({ question, answer }) => (
                <div key={question.id} className="ws-cd-qa">
                  <div className="ws-field-l">
                    {question.label}
                  </div>
                  <p className="ws-prose">
                    {answer}
                  </p>
                </div>
              ))
            ) : (
              <>
                {checkin.wins && (
                  <div className="ws-cd-qa">
                    <div className="ws-field-l">Wins</div>
                    <p className="ws-prose">{checkin.wins}</p>
                  </div>
                )}
                {checkin.challenges && (
                  <div className="ws-cd-qa">
                    <div className="ws-field-l">Challenges</div>
                    <p className="ws-prose">{checkin.challenges}</p>
                  </div>
                )}
                {checkin.questions && (
                  <div className="ws-cd-qa">
                    <div className="ws-field-l">Questions</div>
                    <p className="ws-prose">{checkin.questions}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="ws-stack">
          <div className="ws-panel">
            <div className="ws-panel-head">
              <span className="ws-dot" style={{ color: "var(--ws-accent-ink)" }} />
              <h2 className="ws-h2">Marc&apos;s reply</h2>
            </div>
            <div className="ws-pad">
            {checkin.admin_reply ? (
              <>
                <p className="ws-prose ws-cr-reply">
                  {checkin.admin_reply}
                </p>
                {checkin.replied_at && (
                  <div className="ws-caption mt-3">
                    Replied {formatCheckinDate(checkin.replied_at)}
                  </div>
                )}
              </>
            ) : (
              <p className="ws-meta">
                Marc has not replied to this check-in yet.
              </p>
            )}
            </div>
          </div>

          {checkin.client_reply && (
            <div className="ws-panel">
              <div className="ws-panel-head">
                <span className="ws-dot" style={{ color: "var(--ws-ok)" }} />
                <h2 className="ws-h2">Your previous reply</h2>
              </div>
              <div className="ws-pad">
              <p className="ws-prose ws-cr-reply">
                {checkin.client_reply}
              </p>
              {checkin.client_replied_at && (
                <div className="ws-caption mt-3">
                  Sent {formatCheckinDate(checkin.client_replied_at)}
                </div>
              )}
              </div>
            </div>
          )}

          <div className="ws-panel ws-pad">
            <h2 className="ws-h2">Reply in inbox</h2>
            <p className="ws-meta mt-1">
              Marc&apos;s reply also appears in your inbox with this check-in attached for context, so follow-up messages stay in one conversation.
            </p>
            <Link
              href="/portal/inbox"
              className="ws-link ws-cr-open"
            >
              Open inbox
              <Icon name="chevron" size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
