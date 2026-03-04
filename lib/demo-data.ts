import type { DemoClient, TrafficLight } from "./types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function weeksAgo(n: number): string {
  return daysAgo(n * 7);
}

export const demoClients: DemoClient[] = [
  // RED - highest priority (hasn't logged in 12 days, missed 2 check-ins)
  {
    id: "demo-1",
    name: "Ryan O'Neill",
    email: "ryan@oneillroofing.co.uk",
    phone: "07412 889 103",
    business_name: "O'Neill Roofing",
    business_type: "Roofing Contractor",
    goals: "Get off the tools, build a team of 4 roofers, hit 30k/month revenue consistently. Stop quoting every job himself.",
    start_date: weeksAgo(3),
    status: "red" as TrafficLight,
    current_week: 3,
    last_login: daysAgo(12),
    last_checkin: daysAgo(18),
    checkins: [
      {
        id: "ck-r1",
        client_id: "demo-1",
        week_number: 1,
        mood: "good",
        wins: "Started tracking job costs on the spreadsheet Marc gave me. Already spotted two jobs I was undercharging on.",
        challenges: "Still doing most of the quoting myself. Hard to find time to work on the business when I'm on roofs all day.",
        questions: "How do I price domestic re-roofs properly? I think I'm leaving money on the table.",
        admin_reply: "Good start Ryan. The fact you spotted the undercharging already shows the value of tracking. For domestic re-roofs, we'll go through the pricing calculator next session - bring your last 5 quotes.",
        replied_at: daysAgo(20),
        created_at: daysAgo(21),
      },
    ],
    business_plan: [
      {
        id: "plan-r1",
        client_id: "demo-1",
        summary: "Get Ryan off the tools and into a position to hire. Foundation first: know his numbers, fix his pricing, then build pipeline and systems to support a team of 4.",
        status: "active",
        created_at: weeksAgo(3),
        phases: [
          {
            id: "phase-r1",
            name: "Phase 1: Financial Foundation",
            notes: "Ryan's been undercharging on most jobs. Needs to understand true costs before anything else. Priority is getting the numbers right so he can price for profit.",
            order_index: 0,
            items: [
              { id: "bp-r1", category: "Financial Foundation", title: "Set up job costing spreadsheet", completed: true, completed_at: daysAgo(18) },
              { id: "bp-r2", category: "Financial Foundation", title: "Calculate true hourly rate (including overheads)", completed: false },
              { id: "bp-r3", category: "Financial Foundation", title: "Review last 10 quotes for margin analysis", completed: false },
              { id: "bp-r4", category: "Financial Foundation", title: "Set up separate business account for tax", completed: false },
            ],
            linked_trainings: ["mc-1-1", "mc-1-2", "mc-1-3"],
          },
          {
            id: "phase-r2",
            name: "Phase 2: Pipeline & Sales",
            notes: "Once pricing is fixed, build a proper quoting and lead tracking system. Ryan relies entirely on word of mouth right now.",
            order_index: 1,
            items: [
              { id: "bp-r5", category: "Pipeline & Sales", title: "Create standard quote template with T&Cs", completed: false },
              { id: "bp-r6", category: "Pipeline & Sales", title: "Set up lead tracking (enquiry to quote to win)", completed: false },
              { id: "bp-r7", category: "Pipeline & Sales", title: "Build a referral system with existing happy clients", completed: false },
            ],
            linked_trainings: ["mc-2-2", "mc-2-3"],
          },
          {
            id: "phase-r3",
            name: "Phase 3: Team & Systems",
            notes: "Can't hire until he has systems. Needs job descriptions, onboarding, and basic project management before bringing anyone on.",
            order_index: 2,
            items: [
              { id: "bp-r8", category: "Team & People", title: "Write job description for first hire", completed: false },
              { id: "bp-r9", category: "Team & People", title: "Create onboarding checklist for new roofer", completed: false },
              { id: "bp-r10", category: "Systems & Operations", title: "Set up project management tool (Trello/Monday)", completed: false },
              { id: "bp-r11", category: "Systems & Operations", title: "Create job completion checklist", completed: false },
              { id: "bp-r12", category: "Standards & Quality", title: "Build photo documentation process for every job", completed: false },
            ],
            linked_trainings: ["mc-3-1", "mc-3-3", "mc-4-1"],
          },
        ],
      },
    ],
  },

  // RED - hasn't logged in 10 days, missed 2 check-ins
  {
    id: "demo-2",
    name: "Paul Thompson",
    email: "paul@thompsonelectrical.com",
    phone: "07891 443 298",
    business_name: "Thompson Electrical",
    business_type: "Electrical Contractor",
    goals: "Stop working 60-hour weeks, hire an apprentice, get cash flow predictable. Currently doing residential and small commercial.",
    start_date: weeksAgo(4),
    status: "red" as TrafficLight,
    current_week: 4,
    last_login: daysAgo(10),
    last_checkin: daysAgo(16),
    checkins: [
      {
        id: "ck-p1",
        client_id: "demo-2",
        week_number: 1,
        mood: "okay",
        wins: "Finally sat down and worked out my actual profit on the last 3 months. It's lower than I thought.",
        challenges: "Cash flow is brutal. Got 8k out there in unpaid invoices. Two of them over 60 days.",
        questions: "What's the best way to chase overdue invoices without damaging the relationship?",
        admin_reply: "Good work facing the numbers Paul, that's the first step. On the invoices - we'll build you a 3-stage follow-up process. For the two over 60 days, let's discuss on the call - there's a specific approach for construction debt recovery.",
        replied_at: daysAgo(25),
        created_at: daysAgo(26),
      },
      {
        id: "ck-p2",
        client_id: "demo-2",
        week_number: 2,
        mood: "good",
        wins: "Chased the overdue invoices using the script Marc gave me. One paid within 48 hours. Other promised end of week.",
        challenges: "Quoted 3 jobs this week but feel like I'm still guessing on price. Takes me ages to put a quote together.",
        questions: "Can we look at a standard pricing structure for domestic rewires? I want to speed up quoting.",
        admin_reply: "Brilliant result on the invoices - that's 4-8k recovered. Yes, we'll build a quick-quote calculator for your most common jobs. Bring your top 5 job types to next session.",
        replied_at: daysAgo(17),
        created_at: daysAgo(19),
      },
    ],
    business_plan: [
      {
        id: "plan-p1",
        client_id: "demo-2",
        summary: "Fix cash flow and pricing first, then build pipeline systems. Paul is working 60-hour weeks because he has no systems and his pricing doesn't account for true costs. Goal: predictable income and space to hire an apprentice.",
        status: "active",
        created_at: weeksAgo(4),
        phases: [
          {
            id: "phase-p1",
            name: "Phase 1: Financial Foundation",
            notes: "Cash flow is the urgent problem - 8k in unpaid invoices. Fix the leaks first, then build pricing systems so he stops guessing on quotes.",
            order_index: 0,
            items: [
              { id: "bp-p1", category: "Financial Foundation", title: "Complete 3-month profit analysis", completed: true, completed_at: daysAgo(26) },
              { id: "bp-p2", category: "Financial Foundation", title: "Set up invoice chasing system (7/14/30 day)", completed: true, completed_at: daysAgo(19) },
              { id: "bp-p3", category: "Financial Foundation", title: "Build quick-quote calculator for top 5 jobs", completed: false },
              { id: "bp-p4", category: "Financial Foundation", title: "Set monthly revenue and profit targets", completed: false },
            ],
            linked_trainings: ["mc-1-1", "mc-1-2", "mc-1-3", "mc-1-4"],
          },
          {
            id: "phase-p2",
            name: "Phase 2: Pipeline & Sales",
            notes: "Paul doesn't know where his work comes from. Needs to audit lead sources and build a basic online presence.",
            order_index: 1,
            items: [
              { id: "bp-p5", category: "Pipeline & Sales", title: "Audit current lead sources (where does work come from?)", completed: true, completed_at: daysAgo(22) },
              { id: "bp-p6", category: "Pipeline & Sales", title: "Set up Google Business Profile properly", completed: false },
              { id: "bp-p7", category: "Pipeline & Sales", title: "Create a follow-up process for lost quotes", completed: false },
            ],
            linked_trainings: ["mc-2-1", "mc-2-4"],
          },
          {
            id: "phase-p3",
            name: "Phase 3: First Hire & Systems",
            notes: "Once cash flow is stable and pricing is solid, prep for the apprentice. Needs proper systems so the apprentice has structure from day one.",
            order_index: 2,
            items: [
              { id: "bp-p8", category: "Team & People", title: "Define apprentice role and requirements", completed: false },
              { id: "bp-p9", category: "Team & People", title: "Register with local college for apprentice scheme", completed: false },
              { id: "bp-p10", category: "Systems & Operations", title: "Standardise van stock list", completed: false },
              { id: "bp-p11", category: "Systems & Operations", title: "Create job sheet template (digital)", completed: false },
              { id: "bp-p12", category: "Standards & Quality", title: "Set up customer feedback system (post-job survey)", completed: false },
            ],
            linked_trainings: ["mc-3-1", "mc-3-2", "mc-3-3", "mc-4-3"],
          },
        ],
      },
    ],
  },

  // AMBER - missed one check-in
  {
    id: "demo-3",
    name: "Sean Murphy",
    email: "sean@murphyfitouts.ie",
    phone: "083 412 7791",
    business_name: "Murphy Commercial Fit-Outs",
    business_type: "Commercial Fit-Outs",
    goals: "Scale from 3-man team to 8. Win bigger contracts (50k+). Get proper project management in place so jobs don't overrun.",
    start_date: weeksAgo(6),
    status: "amber" as TrafficLight,
    current_week: 6,
    last_login: daysAgo(4),
    last_checkin: daysAgo(9),
    checkins: [
      {
        id: "ck-s1",
        client_id: "demo-3",
        week_number: 1,
        mood: "okay",
        wins: "Won a 35k fit-out for a dental practice. Biggest single job this year.",
        challenges: "The 35k job is great but I'm worried about cash flow during it. Materials alone will be 15k upfront.",
        questions: "How should I structure payment stages on bigger jobs?",
        admin_reply: "Great win Sean. For a 35k fit-out: 30% deposit, 30% at first fix complete, 30% at second fix, 10% on snag-free handover. Never start without the deposit cleared. We'll template this.",
        replied_at: daysAgo(38),
        created_at: daysAgo(40),
      },
      {
        id: "ck-s2",
        client_id: "demo-3",
        week_number: 2,
        mood: "great",
        wins: "Got the 30% deposit in before starting. That's the first time I've had proper cash staging on a job. Also hired a new joiner - starts Monday.",
        challenges: "Need to figure out how to onboard the new guy properly. Don't want him just standing around the first week.",
        questions: "Do you have an onboarding checklist template for new team members?",
        admin_reply: "Perfect cash flow management. Yes - I'll share the onboarding template. Key thing: have his first 2 weeks planned out with specific tasks and a mentor (even if that's you). We'll go through it on the call.",
        replied_at: daysAgo(31),
        created_at: daysAgo(33),
      },
      {
        id: "ck-s3",
        client_id: "demo-3",
        week_number: 3,
        mood: "good",
        wins: "New joiner settling in well. Dental practice job on track. Won another enquiry for a restaurant fit-out (quoting 28k).",
        challenges: "Running two bigger jobs at once is testing my project management. I'm the only one keeping track of everything.",
        questions: "What's the simplest way to track two parallel projects without it eating all my time?",
        admin_reply: "This is exactly why we need to get you off being the single point of tracking. Let's set up a simple Gantt in the tool we picked - one view for both jobs. 15 minutes each morning to update it. That's it.",
        replied_at: daysAgo(25),
        created_at: daysAgo(26),
      },
      {
        id: "ck-s4",
        client_id: "demo-3",
        week_number: 4,
        mood: "good",
        wins: "Project tracker set up and working. Both jobs running on time. Restaurant quote accepted - 28k job starting in 3 weeks.",
        challenges: "Cash is getting tight with materials for both jobs. The restaurant job needs a 12k materials order.",
        questions: "Should I negotiate better terms with suppliers or get a business credit card?",
        admin_reply: "Both. Open a 30-day account with your top 2 suppliers - you've got the track record. A business credit card is backup, not primary. Let's review your supplier relationships on the next call.",
        replied_at: daysAgo(17),
        created_at: daysAgo(19),
      },
      {
        id: "ck-s5",
        client_id: "demo-3",
        week_number: 5,
        mood: "great",
        wins: "Opened 30-day account with main timber supplier. Restaurant job deposit in. Hired a second labourer. Team of 5 now.",
        challenges: "Need to get better at delegating. I keep checking everyone's work instead of trusting them.",
        questions: "How do I build trust with the team so I'm not micromanaging?",
        admin_reply: "Good growth Sean - from 3 to 5 is a big step. On delegation: set clear expectations upfront, inspect results (not process), and give feedback same-day. We'll build a quality checklist they can self-inspect against.",
        replied_at: daysAgo(10),
        created_at: daysAgo(12),
      },
    ],
    business_plan: [
      {
        id: "plan-s1",
        client_id: "demo-3",
        summary: "Scale Sean from a 3-man operation to 8. He's winning bigger contracts but needs financial controls, project management, and team systems to handle the growth without burning out.",
        status: "active",
        created_at: weeksAgo(6),
        phases: [
          {
            id: "phase-s1",
            name: "Phase 1: Financial Controls",
            notes: "Sean is winning bigger jobs but cash flow nearly caught him out on the dental practice. Staged payments and supplier credit are critical for scaling.",
            order_index: 0,
            items: [
              { id: "bp-s1", category: "Financial Foundation", title: "Set up staged payment structure for all jobs over 10k", completed: true, completed_at: daysAgo(38) },
              { id: "bp-s2", category: "Financial Foundation", title: "Open 30-day trade accounts with top 3 suppliers", completed: true, completed_at: daysAgo(12) },
              { id: "bp-s3", category: "Financial Foundation", title: "Build cash flow forecast (rolling 8 weeks)", completed: true, completed_at: daysAgo(20) },
              { id: "bp-s4", category: "Financial Foundation", title: "Set profit margin targets per job type", completed: false },
            ],
            linked_trainings: ["mc-1-3", "mc-1-4"],
          },
          {
            id: "phase-s2",
            name: "Phase 2: Pipeline & Growth",
            notes: "Work is coming in but it's all reactive. Needs a tender template and referral partnerships to win consistent 50k+ contracts.",
            order_index: 1,
            items: [
              { id: "bp-s5", category: "Pipeline & Sales", title: "Create tender response template", completed: true, completed_at: daysAgo(30) },
              { id: "bp-s6", category: "Pipeline & Sales", title: "Build referral incentive program", completed: false },
              { id: "bp-s7", category: "Pipeline & Sales", title: "Target 3 architects/designers for repeat referrals", completed: false },
            ],
            linked_trainings: ["mc-2-2", "mc-2-3"],
          },
          {
            id: "phase-s3",
            name: "Phase 3: Team & Operations",
            notes: "Growing fast - from 3 to 5 already. Needs onboarding, team meetings, and project management to stop being the bottleneck.",
            order_index: 2,
            items: [
              { id: "bp-s8", category: "Team & People", title: "Write job descriptions for all roles", completed: true, completed_at: daysAgo(33) },
              { id: "bp-s9", category: "Team & People", title: "Create team onboarding checklist", completed: true, completed_at: daysAgo(30) },
              { id: "bp-s10", category: "Team & People", title: "Set up weekly 15-min team briefing", completed: false },
              { id: "bp-s11", category: "Systems & Operations", title: "Set up project management tool", completed: true, completed_at: daysAgo(25) },
              { id: "bp-s12", category: "Systems & Operations", title: "Create job handover process (site manager sign-off)", completed: false },
            ],
            linked_trainings: ["mc-3-2", "mc-3-3", "mc-3-4", "mc-4-1"],
          },
          {
            id: "phase-s4",
            name: "Phase 4: Quality & Standards",
            notes: "As the team grows, quality can't depend on Sean checking everything. Build checklists and documentation so the team self-inspects.",
            order_index: 3,
            items: [
              { id: "bp-s13", category: "Standards & Quality", title: "Build quality checklist per trade type", completed: false },
              { id: "bp-s14", category: "Standards & Quality", title: "Set up completion photo documentation", completed: true, completed_at: daysAgo(15) },
            ],
            linked_trainings: ["mc-6-1", "mc-6-2"],
          },
        ],
      },
    ],
  },

  // GREEN - active, engaged, ticking things off
  {
    id: "demo-4",
    name: "James McConnell",
    email: "james@mcconnellbuilds.co.uk",
    phone: "07723 551 882",
    business_name: "McConnell Residential Builds",
    business_type: "Residential Construction",
    goals: "Build to 50k/month consistent revenue, step back from tools within 6 months, win at least 2 extension jobs per month through referrals.",
    start_date: weeksAgo(8),
    status: "green" as TrafficLight,
    current_week: 8,
    last_login: daysAgo(0),
    last_checkin: daysAgo(2),
    checkins: [
      {
        id: "ck-j1",
        client_id: "demo-4",
        week_number: 6,
        mood: "great",
        wins: "Hit 42k revenue this month - best month yet. The pricing changes from Month 1 are compounding now. Won 3 new jobs through referrals alone.",
        challenges: "My site manager is good but needs more confidence making decisions without checking with me.",
        questions: "How do I push decision-making down to the site manager without losing quality?",
        admin_reply: "42k is brilliant James - that's the pricing and pipeline work paying off. For the site manager: give him a decision-making framework - anything under 500 cost, he decides. Over 500, he calls you. Quality: checklist-based inspection at each stage. We'll build this out.",
        replied_at: daysAgo(16),
        created_at: daysAgo(17),
      },
      {
        id: "ck-j2",
        client_id: "demo-4",
        week_number: 7,
        mood: "great",
        wins: "Site manager handled a client issue himself for the first time. Customer was happy. I didn't even know about it until he told me at end of day. Also, 2 more referrals came in.",
        challenges: "Starting to think about a second team. Is it too early?",
        questions: "What's the minimum revenue I need before it makes sense to split into two teams?",
        admin_reply: "That's a massive milestone - your site manager making autonomous decisions is exactly what 'stepping back from tools' looks like. On team 2: you need consistent 55k+ months with a healthy pipeline before splitting. We're close. Let's plan the trigger points.",
        replied_at: daysAgo(9),
        created_at: daysAgo(10),
      },
      {
        id: "ck-j3",
        client_id: "demo-4",
        week_number: 8,
        mood: "good",
        wins: "Took Friday off for the first time in 3 years. Site ran fine without me. Cash flow forecast looking strong for next 6 weeks.",
        challenges: "Need to get better at the sales side - I'm good at building but not great at selling the value on initial consultations.",
        questions: "Can we work on my sales pitch? I think I'm losing some of the bigger extension jobs at the consultation stage.",
        created_at: daysAgo(2),
      },
    ],
    business_plan: [
      {
        id: "plan-j1",
        client_id: "demo-4",
        summary: "James is the furthest along. Foundation is solid, pipeline is working, site manager is in place. Now focused on scaling: better sales process, team 2 planning, and quality systems that run without him.",
        status: "active",
        created_at: weeksAgo(8),
        phases: [
          {
            id: "phase-j1",
            name: "Phase 1: Financial Foundation",
            notes: "All done. Pricing rebuilt from scratch, cash flow process in place, job costing tracked. This phase drove the jump from ~30k to 42k months.",
            order_index: 0,
            items: [
              { id: "bp-j1", category: "Financial Foundation", title: "Rebuild pricing model with 25% minimum margin", completed: true, completed_at: daysAgo(50) },
              { id: "bp-j2", category: "Financial Foundation", title: "Set up weekly cash flow review process", completed: true, completed_at: daysAgo(45) },
              { id: "bp-j3", category: "Financial Foundation", title: "Create job costing template (track actual vs quoted)", completed: true, completed_at: daysAgo(40) },
              { id: "bp-j4", category: "Financial Foundation", title: "Open business savings account (tax reserve)", completed: true, completed_at: daysAgo(35) },
            ],
            linked_trainings: ["mc-1-1", "mc-1-2", "mc-1-3", "mc-1-4"],
          },
          {
            id: "phase-j2",
            name: "Phase 2: Pipeline & Sales",
            notes: "Referral system is generating 2-3 enquiries/week. Now needs to improve close rate on bigger extension jobs - consultation framework is the gap.",
            order_index: 1,
            items: [
              { id: "bp-j5", category: "Pipeline & Sales", title: "Build referral system with past clients", completed: true, completed_at: daysAgo(30) },
              { id: "bp-j6", category: "Pipeline & Sales", title: "Create consultation framework for extension enquiries", completed: false },
              { id: "bp-j7", category: "Pipeline & Sales", title: "Set up automated follow-up for lost quotes", completed: true, completed_at: daysAgo(25) },
              { id: "bp-j8", category: "Pipeline & Sales", title: "Target estate agents for referral partnerships", completed: false },
            ],
            linked_trainings: ["mc-2-2", "mc-2-3", "mc-2-4"],
          },
          {
            id: "phase-j3",
            name: "Phase 3: Team Development",
            notes: "Site manager is stepping up well - handled his first autonomous client issue. Now planning for team 2. Need 55k+ consistent months before pulling the trigger.",
            order_index: 2,
            items: [
              { id: "bp-j9", category: "Team & People", title: "Hire site manager", completed: true, completed_at: daysAgo(42) },
              { id: "bp-j10", category: "Team & People", title: "Create decision-making authority framework", completed: true, completed_at: daysAgo(15) },
              { id: "bp-j11", category: "Team & People", title: "Set up weekly team meeting (Monday AM)", completed: true, completed_at: daysAgo(38) },
              { id: "bp-j12", category: "Team & People", title: "Build team 2 recruitment plan", completed: false },
            ],
            linked_trainings: ["mc-3-1", "mc-3-3", "mc-3-4"],
          },
          {
            id: "phase-j4",
            name: "Phase 4: Systems & Quality",
            notes: "Project management and quality checkpoints are in. Final pieces: snag list process and a proper completion pack for handovers.",
            order_index: 3,
            items: [
              { id: "bp-j13", category: "Systems & Operations", title: "Implement project management system", completed: true, completed_at: daysAgo(48) },
              { id: "bp-j14", category: "Systems & Operations", title: "Create stage-gate quality checkpoints per job", completed: true, completed_at: daysAgo(12) },
              { id: "bp-j15", category: "Systems & Operations", title: "Build snag list process with client sign-off", completed: true, completed_at: daysAgo(8) },
              { id: "bp-j16", category: "Standards & Quality", title: "Photo documentation at each stage", completed: true, completed_at: daysAgo(45) },
              { id: "bp-j17", category: "Standards & Quality", title: "Create client communication schedule (weekly updates)", completed: true, completed_at: daysAgo(20) },
              { id: "bp-j18", category: "Standards & Quality", title: "Build completion pack template (photos, warranty, maintenance)", completed: false },
            ],
            linked_trainings: ["mc-4-1", "mc-4-2", "mc-4-3", "mc-6-1", "mc-6-2"],
          },
        ],
      },
    ],
  },

  // GREEN - steady, engaged
  {
    id: "demo-5",
    name: "David Kelly",
    email: "david@kellywoodworks.co.uk",
    phone: "07549 201 445",
    business_name: "Kelly Woodworks",
    business_type: "Joinery & Carpentry",
    goals: "Transition from subcontracting to direct-to-client work. Build a workshop-based business doing kitchens, fitted furniture, and bespoke joinery.",
    start_date: weeksAgo(5),
    status: "green" as TrafficLight,
    current_week: 5,
    last_login: daysAgo(1),
    last_checkin: daysAgo(3),
    checkins: [
      {
        id: "ck-d1",
        client_id: "demo-5",
        week_number: 3,
        mood: "good",
        wins: "Finished my first direct-to-client kitchen. Client loves it. Got permission for before/after photos. Priced it properly for the first time.",
        challenges: "Marketing is the weak point. I'm great at the work but nobody knows I exist unless they already know someone who knows me.",
        questions: "What's the fastest way to get visible locally without spending a fortune on ads?",
        admin_reply: "Great first direct job David. The photos are gold. Fastest local visibility: Google Business Profile (free), before/after posts on Facebook 3x/week, and ask every happy client for a Google review. We'll build this into your weekly routine.",
        replied_at: daysAgo(18),
        created_at: daysAgo(19),
      },
      {
        id: "ck-d2",
        client_id: "demo-5",
        week_number: 4,
        mood: "great",
        wins: "Set up Google Business Profile. Posted 3 before/after sets on Facebook. Got 2 enquiries from Facebook already. Kitchen client left a 5-star Google review.",
        challenges: "Quoting bespoke work is hard - every job is different. Takes me too long to price things up.",
        questions: "Is there a way to standardise pricing for bespoke joinery or am I always going to have to price from scratch?",
        admin_reply: "Two enquiries from organic Facebook in week 1 - that's the power of good content. On bespoke pricing: you can't fully standardise but you CAN build a rate card for common elements (per linear metre of shelving, per kitchen unit, etc). We'll build this next session.",
        replied_at: daysAgo(11),
        created_at: daysAgo(12),
      },
      {
        id: "ck-d3",
        client_id: "demo-5",
        week_number: 5,
        mood: "good",
        wins: "Built the rate card for common elements - quoting is already faster. Won the 2 Facebook enquiries (fitted wardrobes and a bookshelf wall). First month without any subcontract work.",
        challenges: "Workshop space is getting tight with 3 jobs on. Need to think about whether to move to a bigger unit.",
        questions: "When does it make sense to invest in a bigger workshop? I don't want to overcommit on rent.",
        created_at: daysAgo(3),
      },
    ],
    business_plan: [
      {
        id: "plan-d1",
        client_id: "demo-5",
        summary: "Help David transition from subcontracting to 100% direct-to-client work. Build his brand visibility, standardise pricing for bespoke work, and set up systems to handle growing demand from his workshop.",
        status: "active",
        created_at: weeksAgo(5),
        phases: [
          {
            id: "phase-d1",
            name: "Phase 1: Pricing & Revenue",
            notes: "David's been undervaluing his work as a subcontractor. Needs to price direct jobs properly and track the transition from subcontract to direct revenue.",
            order_index: 0,
            items: [
              { id: "bp-d1", category: "Financial Foundation", title: "Price first 5 direct jobs using margin calculator", completed: true, completed_at: daysAgo(22) },
              { id: "bp-d2", category: "Financial Foundation", title: "Build rate card for common joinery elements", completed: true, completed_at: daysAgo(5) },
              { id: "bp-d3", category: "Financial Foundation", title: "Track monthly revenue: subcontract vs direct", completed: true, completed_at: daysAgo(30) },
              { id: "bp-d4", category: "Financial Foundation", title: "Set 3-month target: 100% direct-to-client revenue", completed: false },
            ],
            linked_trainings: ["mc-1-2", "mc-1-4"],
          },
          {
            id: "phase-d2",
            name: "Phase 2: Visibility & Pipeline",
            notes: "David's work sells itself when people see it. Priority is getting his portfolio in front of local buyers - GBP, Facebook, and Google reviews.",
            order_index: 1,
            items: [
              { id: "bp-d5", category: "Pipeline & Sales", title: "Set up Google Business Profile", completed: true, completed_at: daysAgo(12) },
              { id: "bp-d6", category: "Pipeline & Sales", title: "Post 3x/week on Facebook (before/after content)", completed: true, completed_at: daysAgo(10) },
              { id: "bp-d7", category: "Pipeline & Sales", title: "Get 10 Google reviews from past clients", completed: false },
              { id: "bp-d8", category: "Pipeline & Sales", title: "Build a simple portfolio page (website or Instagram)", completed: false },
            ],
            linked_trainings: ["mc-2-1", "mc-2-3", "mc-2-4"],
          },
          {
            id: "phase-d3",
            name: "Phase 3: Systems & Growth",
            notes: "As direct work ramps up, needs scheduling, material systems, and eventually a first hire. Workshop capacity could become a bottleneck.",
            order_index: 2,
            items: [
              { id: "bp-d9", category: "Team & People", title: "Identify first hire need (apprentice vs experienced joiner)", completed: false },
              { id: "bp-d10", category: "Systems & Operations", title: "Create material ordering system (reduce waste)", completed: false },
              { id: "bp-d11", category: "Systems & Operations", title: "Set up job scheduling calendar", completed: true, completed_at: daysAgo(28) },
              { id: "bp-d12", category: "Standards & Quality", title: "Photograph every completed job (portfolio building)", completed: true, completed_at: daysAgo(19) },
              { id: "bp-d13", category: "Standards & Quality", title: "Create client handover process (care instructions, warranty)", completed: false },
            ],
            linked_trainings: ["mc-3-1", "mc-4-1", "mc-5-1"],
          },
        ],
      },
    ],
  },
];

// Sort by priority: red first, then amber, then green
const statusPriority: Record<TrafficLight, number> = { red: 0, amber: 1, green: 2 };

export function getClientsSorted(): DemoClient[] {
  return [...demoClients].sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
}

export function getClientById(id: string): DemoClient | undefined {
  return demoClients.find((c) => c.id === id);
}

export function getAllRecentCheckins() {
  return demoClients
    .flatMap((c) =>
      c.checkins.map((ck) => ({
        ...ck,
        client_name: c.name,
        client_business: c.business_name,
        client_status: c.status,
      }))
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
