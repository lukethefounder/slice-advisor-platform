export type PersonalBotQuestion = {
  id: string;
  category: "Personality" | "Communication" | "Investment Risk" | "Workflow";
  prompt: string;
  helper: string;
  type: "scale" | "choice";
  options?: string[];
};

export const PERSONAL_BOT_QUESTIONS: PersonalBotQuestion[] = [
  {
    id: "decision_speed",
    category: "Personality",
    prompt: "How quickly do you like to make decisions?",
    helper: "This helps your bot know whether to move fast or slow down with more context.",
    type: "choice",
    options: ["Very fast", "Fast after key facts", "Balanced", "Careful", "Very slow and methodical"],
  },
  {
    id: "detail_level",
    category: "Communication",
    prompt: "How much detail do you want in answers?",
    helper: "This controls how concise or detailed your bot should be.",
    type: "choice",
    options: ["One-line answer", "Short summary", "Balanced detail", "Detailed breakdown", "Deep research style"],
  },
  {
    id: "communication_tone",
    category: "Communication",
    prompt: "What tone should your bot use?",
    helper: "This becomes the default personality of your bot.",
    type: "choice",
    options: ["Direct", "Calm", "Witty", "Professional", "Encouraging", "Brutally honest"],
  },
  {
    id: "risk_tolerance",
    category: "Investment Risk",
    prompt: "What is your investment risk tolerance?",
    helper: "This helps the bot frame investment and opportunity comments.",
    type: "choice",
    options: ["Very conservative", "Conservative", "Balanced", "Growth-oriented", "Aggressive"],
  },
  {
    id: "volatility_comfort",
    category: "Investment Risk",
    prompt: "How comfortable are you with volatility?",
    helper: "1 means very uncomfortable. 5 means very comfortable.",
    type: "scale",
  },
  {
    id: "capital_preservation",
    category: "Investment Risk",
    prompt: "How important is capital preservation?",
    helper: "1 means low priority. 5 means extremely important.",
    type: "scale",
  },
  {
    id: "growth_priority",
    category: "Investment Risk",
    prompt: "How important is long-term growth?",
    helper: "1 means low priority. 5 means extremely important.",
    type: "scale",
  },
  {
    id: "income_priority",
    category: "Investment Risk",
    prompt: "How important is income or cash flow?",
    helper: "This influences dividend, bond, and cash-flow framing.",
    type: "scale",
  },
  {
    id: "time_horizon",
    category: "Investment Risk",
    prompt: "What time horizon should your bot assume most often?",
    helper: "This helps align risk, volatility, and opportunity timing.",
    type: "choice",
    options: ["Under 1 year", "1-3 years", "3-5 years", "5-10 years", "10+ years"],
  },
  {
    id: "liquidity_needs",
    category: "Investment Risk",
    prompt: "How important is near-term liquidity?",
    helper: "This helps the bot avoid recommendations that conflict with cash needs.",
    type: "choice",
    options: ["Very important", "Important", "Moderate", "Low", "Not important"],
  },
  {
    id: "alternatives_interest",
    category: "Investment Risk",
    prompt: "How interested are you in alternative investments?",
    helper: "This includes private deals, venture, real estate, and niche opportunities.",
    type: "scale",
  },
  {
    id: "crypto_comfort",
    category: "Investment Risk",
    prompt: "How comfortable are you with crypto opportunities?",
    helper: "1 means avoid. 5 means actively interested.",
    type: "scale",
  },
  {
    id: "penny_stock_comfort",
    category: "Investment Risk",
    prompt: "How comfortable are you with penny stocks or speculative equities?",
    helper: "This keeps high-risk ideas separated from core advisor work.",
    type: "scale",
  },
  {
    id: "compliance_caution",
    category: "Workflow",
    prompt: "How cautious should your bot be around compliance-sensitive actions?",
    helper: "Higher caution means more approval gates and recordkeeping reminders.",
    type: "choice",
    options: ["Normal caution", "Extra cautious", "Very strict", "Always require review"],
  },
  {
    id: "automation_comfort",
    category: "Workflow",
    prompt: "How much autonomy should your bot have?",
    helper: "This controls whether it suggests, drafts, creates tasks, or routes workflows.",
    type: "choice",
    options: ["Suggest only", "Draft only", "Create tasks with approval", "Create workflow packages", "High autonomy with review"],
  },
  {
    id: "task_style",
    category: "Workflow",
    prompt: "How should your bot handle tasks?",
    helper: "This controls how aggressively it creates and organizes work.",
    type: "choice",
    options: ["Minimal tasks", "Only important tasks", "Balanced", "Detailed task breakdown", "Aggressive task tracking"],
  },
  {
    id: "notification_style",
    category: "Workflow",
    prompt: "How should your bot notify you?",
    helper: "This helps your bot decide when to interrupt you.",
    type: "choice",
    options: ["Only critical alerts", "High priority only", "Balanced", "Frequent updates", "Everything important"],
  },
  {
    id: "meeting_prep_depth",
    category: "Workflow",
    prompt: "How detailed should meeting prep be?",
    helper: "This affects prep packets, client notes, and advisor checklists.",
    type: "choice",
    options: ["Very brief", "Key bullets", "Balanced", "Detailed", "Full prep packet"],
  },
  {
    id: "research_style",
    category: "Communication",
    prompt: "How should your bot explain investment research?",
    helper: "This influences whether answers are plain-English or more technical.",
    type: "choice",
    options: ["Plain English", "Advisor summary", "Balanced", "Technical", "Institutional research style"],
  },
  {
    id: "challenge_level",
    category: "Personality",
    prompt: "How much should your bot challenge your assumptions?",
    helper: "This controls whether it simply assists or acts as a skeptical advisor.",
    type: "choice",
    options: ["Rarely challenge me", "Light challenge", "Balanced challenge", "Challenge me often", "Be brutally honest"],
  },
];

export function defaultBotAnswers() {
  return PERSONAL_BOT_QUESTIONS.reduce<Record<string, string>>((answers, question) => {
    answers[question.id] = question.type === "scale" ? "3" : question.options?.[2] ?? "";
    return answers;
  }, {});
}