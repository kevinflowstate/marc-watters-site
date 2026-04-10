import type { CheckinFormConfig } from "@/lib/types";

export const defaultCheckinConfig: CheckinFormConfig = {
  checkin_day: "monday",
  mood_enabled: false,
  mood_options: [],
  questions: [
    {
      id: "overall_week_rating",
      section: "Weekly Snapshot",
      label: "Rate your week overall",
      type: "scale",
      required: true,
      min: 1,
      max: 10,
      min_label: "1",
      max_label: "10",
    },
    {
      id: "business_feeling",
      label: "How are you feeling about the business right now?",
      type: "single_choice",
      required: true,
      options: [
        {
          value: "great",
          label: "Fantastic - I'm energised, things are flowing, I'm in control",
        },
        {
          value: "good",
          label: "Good - Steady progress, mostly on track, minor concerns",
        },
        {
          value: "struggling",
          label: "Struggling - There's friction, I'm stretched, need to fix some things",
        },
        {
          value: "awful",
          label: "Awful - I need help, this isn't working, feeling overwhelmed",
        },
      ],
    },
    {
      id: "what_went_well",
      section: "Reflection",
      label: "What went well this week?",
      type: "single_choice",
      required: true,
      allow_other: true,
      options: [
        { value: "revenue", label: "Revenue" },
        { value: "team", label: "Team" },
        { value: "pipeline", label: "Work won / project pipeline" },
        { value: "project_delivery", label: "Project delivery" },
        { value: "founder_balance", label: "Founder time / balance" },
        { value: "planning_structure", label: "Planning / structure" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "what_went_well_detail",
      label: "Why did you make this choice - explain what went well?",
      type: "textarea",
      required: true,
      placeholder: "Explain what went well this week",
    },
    {
      id: "what_didnt_go_well",
      label: "What didn't go well this week?",
      type: "single_choice",
      required: true,
      allow_other: true,
      options: [
        { value: "revenue", label: "Revenue" },
        { value: "team", label: "Team" },
        { value: "pipeline", label: "Work won / project pipeline" },
        { value: "project_delivery", label: "Project delivery" },
        { value: "founder_balance", label: "Founder time / balance" },
        { value: "planning_structure", label: "Planning / structure" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "what_didnt_go_well_detail",
      label: "Why did you make this choice - explain what didn't go well",
      type: "textarea",
      required: true,
      placeholder: "Explain what needs attention",
    },
    {
      id: "next_week_mapped_out",
      section: "Looking Ahead",
      label: "Is next week mapped out?",
      type: "single_choice",
      required: true,
      options: [
        { value: "yes_fully_planned", label: "Yes - fully planned & scheduled" },
        { value: "partly_need_review", label: "Partly - need to review" },
        { value: "no_not_planned", label: "No - I haven't planned it yet" },
      ],
    },
    {
      id: "founder_time_blocked",
      label: "Have you blocked out founder time for next week?",
      type: "single_choice",
      required: true,
      options: [
        { value: "yes_blocked", label: "Yes - blocked out and protected" },
        { value: "no_but_review", label: "No - but I'll go back and review" },
        { value: "no_no_chance", label: "No - there is no chance" },
      ],
    },
    {
      id: "headline_goal_next_week",
      label: "What is your headline goal or focus for next week?",
      type: "textarea",
      required: true,
      placeholder: "Your main focus for next week",
    },
    {
      id: "need_anything_from_marc",
      label: "Do you need anything from me?",
      type: "textarea",
      required: true,
      placeholder: "Anything you want Marc to help with or review",
    },
  ],
};

export function deriveCheckinMood(responses: Record<string, string>): string {
  const mappedMood = responses.business_feeling;
  if (mappedMood === "great" || mappedMood === "good" || mappedMood === "struggling" || mappedMood === "awful") {
    return mappedMood;
  }

  return "good";
}
