"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan" | "blue";
type SecurityView =
  | "overview"
  | "sources"
  | "matrix"
  | "records"
  | "audit"
  | "disclosures"
  | "controls"
  | "settings";

type SecuritySetting = {
  id: string;
  mfaEnabled: boolean;
  requireReauthForSensitiveActions: boolean;
  alertOnNewLogin: boolean;
  advisorModeEnabled: boolean;
  sessionTimeoutMinutes: number;
  lastSecurityReviewAt: string | null;
};

type Disclosure = {
  disclosureKey: string;
  title: string;
  version: string;
  content: string;
  accepted: boolean;
  acceptedAt: string | null;
};

type AuditLog = {
  id: string;
  eventType: string;
  severity: string;
  area: string;
  title: string;
  detail: string | null;
  metadataJson: string;
  createdAt: string;
};

type Overview = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  securitySetting: SecuritySetting;
  disclosures: Disclosure[];
  auditLogs: AuditLog[];
  stats: {
    totalAuditLogs: number;
    criticalLogs: number;
    warningLogs: number;
    acceptedDisclosures: number;
    requiredDisclosures: number;
  };
};

type OfficialSource = {
  id: string;
  label: string;
  regulator: string;
  officialUrl: string;
  ruleLocation: string;
  rulePlacement: string;
  plainEnglish: string;
  platformMeaning: string;
  evidenceRequired: string[];
  appliesTo: string[];
  priority: "Core" | "Conditional" | "Broker-Dealer Conditional" | "Privacy/Cyber" | "Marketing";
};

type ComplianceControl = {
  id: string;
  platformFeature: string;
  learningSummary: string;
  officialSourceIds: string[];
  rulePlacement: string;
  officialRequirement: string;
  howSliceSupportsIt: string;
  userFacingEvidence: string[];
  recordsToKeep: string[];
  proofNeededBeforeProduction: string[];
  unavoidableHumanReview: string;
  status: "Strong Evidence" | "Policy Required" | "Manual Approval Required" | "Production Gap";
  risk: "Low" | "Medium" | "High" | "Critical";
  tone: Tone;
};

type RetentionItem = {
  recordType: string;
  sourceIds: string[];
  whyItMatters: string;
  evidenceCaptured: string[];
  requiredContents: string[];
  retentionExpectation: string;
  archiveGap: string;
  status: "Captured" | "Partial" | "Needs Archive" | "Manual Archive Required";
  tone: Tone;
};

type LearningStep = {
  title: string;
  body: string;
  tone: Tone;
};

const OFFICIAL_SOURCES: Record<string, OfficialSource> = {
  booksRecords2042: {
    id: "booksRecords2042",
    label: "Books and records to be maintained by investment advisers",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2",
    ruleLocation: "17 CFR § 275.204-2",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.204-2. This is the adviser books-and-records rule.",
    plainEnglish:
      "Advisers must make and keep true, accurate, current records for advisory business, including many written communications, advertisements, policies, performance support, and compliance records.",
    platformMeaning:
      "Slice must treat reports, AI outputs, client communications, disclosures, approvals, audit events, and review evidence as potentially recordable business evidence.",
    evidenceRequired: [
      "Final version of client-facing reports and communications",
      "Disclosure versions and acceptance evidence",
      "Audit event history",
      "Supporting material for performance or recommendations",
      "Policies, annual review records, and approval records where applicable",
    ],
    appliesTo: [
      "Audit trail",
      "Reports",
      "AI Studio",
      "Email Center",
      "Client Portal Inbox",
      "Disclosures",
      "Records tab",
      "Marketing materials",
    ],
    priority: "Core",
  },
  compliance20647: {
    id: "compliance20647",
    label: "Compliance procedures and practices",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-7",
    ruleLocation: "17 CFR § 275.206(4)-7",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.206(4)-7. This is the adviser compliance program rule.",
    plainEnglish:
      "Registered advisers must adopt and implement written policies and procedures, review them at least annually, and designate a chief compliance officer.",
    platformMeaning:
      "Slice can support policies, review evidence, controls, warnings, and audit records, but the firm still needs written procedures and responsible compliance ownership.",
    evidenceRequired: [
      "Written policies and procedures",
      "Annual review evidence",
      "CCO or responsible reviewer assignment",
      "Review results and remediation evidence",
      "Control testing records",
    ],
    appliesTo: [
      "Compliance review",
      "Security controls",
      "Production checklist",
      "Firm policy mapping",
      "Audit trail",
    ],
    priority: "Core",
  },
  marketing20641: {
    id: "marketing20641",
    label: "Investment adviser marketing",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-1",
    ruleLocation: "17 CFR § 275.206(4)-1",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.206(4)-1. This is the adviser marketing rule.",
    plainEnglish:
      "Adviser advertisements, testimonials, endorsements, third-party ratings, and performance presentations must follow anti-fraud, disclosure, fair-balance, and substantiation standards.",
    platformMeaning:
      "Slice-generated reports, public copy, pitch materials, client acquisition content, testimonials, performance language, or market commentary must be reviewed before external use.",
    evidenceRequired: [
      "Final advertisement or communication",
      "Required disclosures",
      "Substantiation for claims",
      "Performance calculation support",
      "Approval metadata",
      "Audience and distribution evidence",
    ],
    appliesTo: [
      "PDF reports",
      "Investor-facing reports",
      "AI Studio",
      "Marketing copy",
      "Testimonials/endorsements",
      "Performance content",
    ],
    priority: "Marketing",
  },
  codeEthics204A1: {
    id: "codeEthics204A1",
    label: "Investment adviser codes of ethics",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204A-1",
    ruleLocation: "17 CFR § 275.204A-1",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.204A-1. This rule addresses adviser codes of ethics.",
    plainEnglish:
      "Advisers need a code of ethics and records around acknowledgments, access persons, violations, reports, and certain approvals.",
    platformMeaning:
      "Slice should treat user acknowledgments, compliance review records, access-person workflows, and employee actions as evidence that may need retention.",
    evidenceRequired: [
      "Code of ethics acknowledgment",
      "Access-person lists",
      "Violation records",
      "Action taken records",
      "Personal trading/preclearance evidence where applicable",
    ],
    appliesTo: [
      "Disclosures",
      "Team Board",
      "Audit trail",
      "Employee/adviser access",
      "Compliance review",
    ],
    priority: "Conditional",
  },
  custody20642: {
    id: "custody20642",
    label: "Custody of funds or securities of clients by investment advisers",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-2",
    ruleLocation: "17 CFR § 275.206(4)-2",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.206(4)-2. This is the adviser custody rule.",
    plainEnglish:
      "Advisers with custody of client funds or securities are subject to qualified custodian, notice, statement, surprise exam, and other requirements unless an exception applies.",
    platformMeaning:
      "Slice must clearly avoid representing itself as a custodian, broker, trading platform, payment processor, or client-money movement system unless future integrations are separately reviewed.",
    evidenceRequired: [
      "No-custody disclosure",
      "No-trading authority disclosure",
      "Integration approval records",
      "Custodian/vendor records if added later",
      "Client authorization records where applicable",
    ],
    appliesTo: [
      "Payments",
      "Trading",
      "Wallets",
      "Client account data",
      "Custody/trading boundaries",
    ],
    priority: "Conditional",
  },
  payToPlay20645: {
    id: "payToPlay20645",
    label: "Political contributions by certain investment advisers",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-5",
    ruleLocation: "17 CFR § 275.206(4)-5",
    rulePlacement:
      "Title 17 → Chapter II → Part 275 → § 275.206(4)-5. This is the adviser pay-to-play rule.",
    plainEnglish:
      "Certain political contributions and related activity can affect an adviser's ability to receive compensation from government entities.",
    platformMeaning:
      "If Slice later supports public plans, government entities, political contributions, local fundraising, or public-sector advisory opportunities, contribution records and covered-associate controls become important.",
    evidenceRequired: [
      "Covered associate list",
      "Government entity client list",
      "Political contribution records",
      "Solicitor/placement-agent records",
      "Review and approval evidence",
    ],
    appliesTo: [
      "Government clients",
      "Public plans",
      "Political/campaign features",
      "Fundraising workflows",
      "Covered-associate records",
    ],
    priority: "Conditional",
  },
  regSP: {
    id: "regSP",
    label: "Regulation S-P privacy, safeguards, and incident response",
    regulator: "SEC",
    officialUrl: "https://www.sec.gov/rules-regulations/2024/06/s7-05-23",
    ruleLocation:
      "SEC Regulation S-P final amendments, Release Nos. 34-100155, IA-6604, IC-35193",
    rulePlacement:
      "SEC rule page for privacy of consumer financial information and safeguarding customer information.",
    plainEnglish:
      "Covered institutions need written policies and procedures to detect, respond to, and recover from unauthorized access to or use of customer information, including notice where required.",
    platformMeaning:
      "Slice needs privacy controls, access control, incident evidence, breach/incident tracking, vendor oversight, and user/customer notice workflows before production use with customer information.",
    evidenceRequired: [
      "Incident response plan",
      "Incident detection record",
      "Affected customer information categories",
      "Notice decision",
      "Notice date",
      "Remediation evidence",
      "Vendor involvement evidence",
    ],
    appliesTo: [
      "Client profiles",
      "Client portal",
      "Documents",
      "Reports",
      "Audit metadata",
      "Security controls",
      "Notifications",
    ],
    priority: "Privacy/Cyber",
  },
  regSID: {
    id: "regSID",
    label: "Regulation S-ID identity theft red flags",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-248/subpart-C",
    ruleLocation: "17 CFR Part 248, Subpart C",
    rulePlacement:
      "Title 17 → Chapter II → Part 248 → Subpart C. This is Regulation S-ID: Identity Theft Red Flags.",
    plainEnglish:
      "Certain financial institutions and creditors must have programs to identify, detect, and respond to identity theft red flags.",
    platformMeaning:
      "If Slice handles covered account workflows, onboarding, account access, identity changes, or suspicious profile changes, red-flag detection and response evidence should be added.",
    evidenceRequired: [
      "Identity change logs",
      "Suspicious activity flags",
      "New device/login alerts",
      "Profile change review",
      "Red-flag response notes",
      "Escalation evidence",
    ],
    appliesTo: [
      "Account settings",
      "Profile changes",
      "Login alerts",
      "Client portal",
      "Suspicious access review",
    ],
    priority: "Privacy/Cyber",
  },
  finra2210: {
    id: "finra2210",
    label: "Communications with the Public",
    regulator: "FINRA",
    officialUrl: "https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210",
    ruleLocation: "FINRA Rule 2210",
    rulePlacement:
      "FINRA Rulebook → 2200 Communications and Disclosures → Rule 2210 Communications with the Public.",
    plainEnglish:
      "FINRA communications are categorized as correspondence, retail communications, and institutional communications. Retail communications generally require principal approval before use and records must be retained.",
    platformMeaning:
      "If a user is broker-dealer affiliated, Slice-generated emails, client messages, reports, marketing pieces, and public communications need principal review and retention before use.",
    evidenceRequired: [
      "Communication category",
      "Final communication",
      "Approver/principal",
      "Approval date",
      "Date of first/last use",
      "Source of statistics/charts",
      "Audience/distribution evidence",
    ],
    appliesTo: [
      "Email Center",
      "Client Portal Inbox",
      "AI Studio",
      "Reports",
      "Public marketing",
      "Retail communications",
    ],
    priority: "Broker-Dealer Conditional",
  },
  finra3110: {
    id: "finra3110",
    label: "Supervision",
    regulator: "FINRA",
    officialUrl: "https://www.finra.org/rules-guidance/rulebooks/finra-rules/3110",
    ruleLocation: "FINRA Rule 3110",
    rulePlacement:
      "FINRA Rulebook → 3000 Supervision and Responsibilities Relating to Associated Persons → Rule 3110 Supervision.",
    plainEnglish:
      "FINRA member firms need supervisory systems reasonably designed to achieve compliance with applicable securities laws and FINRA rules.",
    platformMeaning:
      "If Slice is used by a FINRA member or associated person, tasking, communications, review queues, alerts, and approval records need supervisory procedures.",
    evidenceRequired: [
      "Supervisory procedure mapping",
      "Reviewer assignment",
      "Escalation records",
      "Communication review logs",
      "Exception reports",
      "Follow-up evidence",
    ],
    appliesTo: [
      "Team Board",
      "Client communications",
      "Compliance review",
      "Notifications",
      "Audit trail",
    ],
    priority: "Broker-Dealer Conditional",
  },
  finra4511: {
    id: "finra4511",
    label: "General Requirements",
    regulator: "FINRA",
    officialUrl: "https://www.finra.org/rules-guidance/rulebooks/finra-rules/4511",
    ruleLocation: "FINRA Rule 4511",
    rulePlacement:
      "FINRA Rulebook → 4500 Books, Records and Reports → Rule 4511 General Requirements.",
    plainEnglish:
      "FINRA members must make and preserve books and records as required under FINRA rules, Exchange Act rules, and applicable laws.",
    platformMeaning:
      "If Slice stores broker-dealer communications or supervisory evidence, those records need to be exportable and preserved in a compliant format and medium.",
    evidenceRequired: [
      "Records inventory",
      "Retention period",
      "Archive medium",
      "Supervisory review evidence",
      "Export history",
      "Record deletion/legal hold controls",
    ],
    appliesTo: [
      "Audit trail",
      "Records archive",
      "Client communications",
      "Reports",
      "Supervisory review",
    ],
    priority: "Broker-Dealer Conditional",
  },
  regBI: {
    id: "regBI",
    label: "Regulation Best Interest",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.15l-1",
    ruleLocation: "17 CFR § 240.15l-1",
    rulePlacement:
      "Title 17 → Chapter II → Part 240 → § 240.15l-1. Regulation Best Interest for broker-dealers.",
    plainEnglish:
      "Broker-dealers and associated persons must act in the best interest of retail customers when making recommendations, subject to disclosure, care, conflict, and compliance obligations.",
    platformMeaning:
      "If Slice is used by broker-dealer personnel for recommendations, the platform must capture recommendation basis, conflicts, disclosures, and supervisory evidence.",
    evidenceRequired: [
      "Recommendation basis",
      "Retail customer profile",
      "Conflicts disclosed/mitigated",
      "Care obligation rationale",
      "Approval or supervisory evidence",
      "Final communication record",
    ],
    appliesTo: [
      "Client recommendations",
      "Reports",
      "Advisor notes",
      "Client emails",
      "Investment scenario outputs",
    ],
    priority: "Broker-Dealer Conditional",
  },
  exchangeAct17a4: {
    id: "exchangeAct17a4",
    label: "Broker-dealer records preservation",
    regulator: "SEC / eCFR",
    officialUrl: "https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4",
    ruleLocation: "17 CFR § 240.17a-4",
    rulePlacement:
      "Title 17 → Chapter II → Part 240 → § 240.17a-4. Records to be preserved by certain exchange members, brokers, and dealers.",
    plainEnglish:
      "Broker-dealer records must be preserved for required periods and in required formats/media.",
    platformMeaning:
      "If Slice serves broker-dealer workflows, records should be exportable to compliant archive systems and not merely stored in ordinary app tables.",
    evidenceRequired: [
      "Archive destination",
      "Retention period",
      "Record category",
      "Immutable copy",
      "Search/retrieval process",
      "Deletion controls",
    ],
    appliesTo: [
      "Communications archive",
      "Audit records",
      "Supervisory records",
      "Report records",
    ],
    priority: "Broker-Dealer Conditional",
  },
};

const LEARNING_STEPS: LearningStep[] = [
  {
    title: "1. Identify the activity",
    body:
      "First determine whether the Slice output is internal workflow, client communication, retail communication, advertisement, performance material, recommendation support, privacy event, or books-and-records evidence.",
    tone: "red",
  },
  {
    title: "2. Match the official rule",
    body:
      "Use the source library and matrix to connect the feature to the exact rule location, such as Rule 204-2 for records, Rule 206(4)-7 for compliance procedures, or FINRA Rule 2210 for broker-dealer communications.",
    tone: "cyan",
  },
  {
    title: "3. Capture the required evidence",
    body:
      "The platform should keep final content, approvals, timestamps, disclosure versions, reviewer identity, supporting data, and audit metadata depending on the workflow.",
    tone: "purple",
  },
  {
    title: "4. Block unsafe use",
    body:
      "Anything client-facing, investor-facing, public, performance-related, or recommendation-related must remain review-gated until an adviser, principal, CCO, or qualified reviewer approves it.",
    tone: "amber",
  },
  {
    title: "5. Archive and retrieve",
    body:
      "A compliant system must preserve records, support export, apply legal hold, prevent silent deletion, and allow regulator-ready retrieval.",
    tone: "green",
  },
];

const COMPLIANCE_CONTROLS: ComplianceControl[] = [
  {
    id: "workspace-login-security",
    platformFeature: "Workspace login, account access, and session security",
    learningSummary:
      "This feature protects who can enter the workspace and how long access remains valid.",
    officialSourceIds: ["regSP", "compliance20647", "regSID"],
    rulePlacement:
      "Regulation S-P for customer-information safeguards; Rule 206(4)-7 for written policies/procedures; Regulation S-ID if identity-theft red-flag obligations apply.",
    officialRequirement:
      "Firms must protect customer information, maintain compliance procedures, and where applicable identify and respond to identity-theft red flags.",
    howSliceSupportsIt:
      "Slice requires authenticated access to the compliance center, exposes session timeout, supports MFA readiness, login-alert readiness, and sensitive-action reauthentication.",
    userFacingEvidence: [
      "Security controls display MFA readiness.",
      "Security controls display sensitive-action reauthentication.",
      "Session timeout is configurable.",
      "Compliance review can identify disabled security controls.",
      "Audit trail records security-review events and security-setting updates.",
    ],
    recordsToKeep: [
      "Security setting state",
      "Session policy",
      "Security review event",
      "Login alert event where implemented",
      "Identity/profile change event where implemented",
    ],
    proofNeededBeforeProduction: [
      "Real MFA provider enforcement",
      "Device/session inventory",
      "Rate limiting and lockout policy",
      "Incident-response escalation",
      "Identity-red-flag workflow if applicable",
    ],
    unavoidableHumanReview:
      "Security or compliance owner must approve production access-control policy and test evidence.",
    status: "Strong Evidence",
    risk: "Medium",
    tone: "green",
  },
  {
    id: "ai-studio-output",
    platformFeature: "AI Studio answers, summaries, client language, and advisor memos",
    learningSummary:
      "AI output may become a client communication, recommendation support, advertisement, or firm record depending on use.",
    officialSourceIds: ["booksRecords2042", "marketing20641", "compliance20647", "finra2210", "regBI"],
    rulePlacement:
      "Rule 204-2 for adviser records; Rule 206(4)-1 for marketing; Rule 206(4)-7 for procedures; FINRA 2210/Reg BI if broker-dealer use applies.",
    officialRequirement:
      "Communications, advertisements, performance materials, and recommendation-related records must be accurate, reviewable, retained, and not misleading.",
    howSliceSupportsIt:
      "Slice marks AI content as draft/review-required through disclosures, stores report/message evidence, and separates generation from final approval/delivery.",
    userFacingEvidence: [
      "AI limitation disclosure is required.",
      "Advisor-review disclosure is required.",
      "Reports and generated content are visible as records.",
      "Audit trail can show review/security events.",
      "Compliance matrix classifies AI output as manual-review required for external use.",
    ],
    recordsToKeep: [
      "Prompt/request",
      "AI response",
      "Final approved version",
      "Reviewer",
      "Review timestamp",
      "Supporting sources",
      "Disclosures used",
      "Audience and distribution evidence",
    ],
    proofNeededBeforeProduction: [
      "Approval workflow",
      "Source/substantiation upload",
      "Final-version lock",
      "AI hallucination review checklist",
      "Client-suitability review where applicable",
    ],
    unavoidableHumanReview:
      "A qualified adviser/principal/CCO must approve final external use.",
    status: "Manual Approval Required",
    risk: "Critical",
    tone: "red",
  },
  {
    id: "reports-marketing",
    platformFeature: "PDF reports, investment packets, market commentary, and investor-facing materials",
    learningSummary:
      "Reports can become advertisements, client communications, recommendation support, or required books and records.",
    officialSourceIds: ["booksRecords2042", "marketing20641", "finra2210", "exchangeAct17a4"],
    rulePlacement:
      "Adviser books-and-records rule, SEC Marketing Rule, FINRA communications rule where applicable, and broker-dealer preservation rule where applicable.",
    officialRequirement:
      "Reports must be retained if used externally; marketing/performance claims need substantiation, fair presentation, disclosures, and approval evidence.",
    howSliceSupportsIt:
      "Slice creates report records, shows reports in the compliance mapping, requires disclosures, and treats report use as review-gated.",
    userFacingEvidence: [
      "Report records are visible in platform areas.",
      "Marketing communication disclosure is required.",
      "Records tab explains report retention needs.",
      "Matrix shows performance/marketing support requirements.",
    ],
    recordsToKeep: [
      "Final report",
      "Draft history where required",
      "Data sources",
      "Performance calculations",
      "Reviewer and approval date",
      "Distribution audience",
      "Disclosure package",
    ],
    proofNeededBeforeProduction: [
      "Immutable final report archive",
      "Performance substantiation file storage",
      "Advertisement classification",
      "Approval workflow",
      "Archive export",
    ],
    unavoidableHumanReview:
      "Compliance reviewer must classify report type before it leaves the platform.",
    status: "Manual Approval Required",
    risk: "Critical",
    tone: "red",
  },
  {
    id: "client-communications",
    platformFeature: "Email Center, Client Portal Inbox, and client-facing messaging",
    learningSummary:
      "Client communications are among the most compliance-sensitive areas because they may include advice, recommendations, explanations, or marketing.",
    officialSourceIds: ["booksRecords2042", "finra2210", "finra3110", "finra4511", "regBI"],
    rulePlacement:
      "Rule 204-2 for adviser written communications; FINRA 2210/3110/4511 and Reg BI for broker-dealer or dual-registrant use.",
    officialRequirement:
      "Written communications relating to recommendations/advice and broker-dealer communications must be reviewed and retained according to applicable category and firm procedures.",
    howSliceSupportsIt:
      "Slice positions communication as draft/review-required and maps final-use requirements, approval evidence, and recordkeeping needs.",
    userFacingEvidence: [
      "Advisor-review disclosure is required.",
      "Records tab identifies exact communication records to preserve.",
      "Matrix requires approval and archive before outbound use.",
      "Security controls support sensitive-action reauthentication.",
    ],
    recordsToKeep: [
      "Final communication",
      "Draft, if required by policy",
      "Recipient/audience",
      "Reviewer/approver",
      "Approval date",
      "Date sent",
      "Communication category",
      "Disclosures included",
    ],
    proofNeededBeforeProduction: [
      "Final-send capture",
      "Principal/adviser approval workflow",
      "Recipient archive",
      "Supervision notes",
      "Communication category tagging",
    ],
    unavoidableHumanReview:
      "Adviser or registered principal must review applicable communications before use.",
    status: "Policy Required",
    risk: "High",
    tone: "amber",
  },
  {
    id: "client-profile-data",
    platformFeature: "Client profiles, account notes, personal data, and document context",
    learningSummary:
      "Client data triggers privacy, confidentiality, access-control, incident-response, and retention obligations.",
    officialSourceIds: ["regSP", "regSID", "compliance20647", "booksRecords2042"],
    rulePlacement:
      "Regulation S-P and Regulation S-ID for customer information and identity theft red flags; Rule 206(4)-7 for compliance procedures; Rule 204-2 for records.",
    officialRequirement:
      "Customer information must be protected and incident response procedures must be reasonably designed for unauthorized access/use.",
    howSliceSupportsIt:
      "Slice provides privacy disclosures, authenticated access, audit records, security settings, and record mapping for customer-information workflows.",
    userFacingEvidence: [
      "Privacy disclosure is required.",
      "Security settings support login alerting and reauthentication.",
      "Audit trail captures security/compliance events.",
      "Records tab identifies privacy incident evidence requirements.",
    ],
    recordsToKeep: [
      "Client profile access/change history",
      "Privacy disclosure acceptance",
      "Incident response evidence",
      "Affected customer records",
      "Notice decision",
      "Remediation notes",
    ],
    proofNeededBeforeProduction: [
      "Formal incident-response module",
      "Data classification",
      "Role-based access controls",
      "Vendor review",
      "Encryption/key management review",
    ],
    unavoidableHumanReview:
      "Privacy/security officer must approve the customer-information protection program.",
    status: "Policy Required",
    risk: "High",
    tone: "amber",
  },
  {
    id: "audit-trail",
    platformFeature: "Audit trail and compliance evidence log",
    learningSummary:
      "The audit trail is the backbone of evidence: it proves what happened, when, by whom, and why it mattered.",
    officialSourceIds: ["booksRecords2042", "compliance20647", "finra4511", "exchangeAct17a4"],
    rulePlacement:
      "Adviser books-and-records and compliance review requirements; FINRA/broker-dealer records where applicable.",
    officialRequirement:
      "Required records must be preserved, retrievable, and sufficient to evidence supervisory/compliance activity.",
    howSliceSupportsIt:
      "Slice shows event type, severity, area, timestamp, detail, and metadata for security/compliance events.",
    userFacingEvidence: [
      "Audit Explorer filters by severity and area.",
      "Audit cards show event type and created date.",
      "Metadata/Evidence JSON is available for review.",
      "Security reviews and disclosure acceptances create events.",
    ],
    recordsToKeep: [
      "Event type",
      "Severity",
      "Area",
      "Detail",
      "Timestamp",
      "Reviewer/user",
      "Metadata",
      "IP/user agent where available",
    ],
    proofNeededBeforeProduction: [
      "Tamper-evident archive",
      "Export",
      "Legal hold",
      "Retention schedule",
      "Admin access review",
    ],
    unavoidableHumanReview:
      "Compliance owner must review critical/warning events and document remediation.",
    status: "Strong Evidence",
    risk: "Medium",
    tone: "green",
  },
  {
    id: "alternative-investments",
    platformFeature: "Alternative investments, private deals, crypto, penny stocks, and illiquid assets",
    learningSummary:
      "High-risk or illiquid assets require heightened risk disclosure, suitability review, due diligence, conflict review, and documentation.",
    officialSourceIds: ["booksRecords2042", "compliance20647", "marketing20641"],
    rulePlacement:
      "Books-and-records, compliance policies/procedures, and marketing/anti-fraud standards depending on use.",
    officialRequirement:
      "Recommendations, risk statements, performance claims, and client communications around high-risk assets must be accurate, supported, reviewed, and retained.",
    howSliceSupportsIt:
      "Slice requires alternative-risk disclosure and labels alternative investment workflows as review-required.",
    userFacingEvidence: [
      "Alternative investment risk disclosure is required.",
      "Matrix flags these workflows as high-risk.",
      "Records tab identifies due diligence and suitability evidence needs.",
    ],
    recordsToKeep: [
      "Thesis",
      "Risk disclosure",
      "Due diligence",
      "Valuation assumptions",
      "Liquidity analysis",
      "Client suitability rationale",
      "Conflict review",
    ],
    proofNeededBeforeProduction: [
      "Accreditation tracking where applicable",
      "Offering document archive",
      "Risk questionnaire",
      "Concentration limits",
      "Conflict disclosure",
    ],
    unavoidableHumanReview:
      "Advisor and compliance reviewer must approve suitability/risk analysis before client use.",
    status: "Manual Approval Required",
    risk: "Critical",
    tone: "red",
  },
  {
    id: "custody-trading-boundary",
    platformFeature: "No custody, no trading authority, and no client-money movement by default",
    learningSummary:
      "The safest compliance posture is to clearly separate Slice from custody, trading, brokerage, transfer agency, or payment authority unless separately approved.",
    officialSourceIds: ["custody20642", "booksRecords2042", "compliance20647"],
    rulePlacement:
      "Custody Rule 206(4)-2, books-and-records, and compliance procedures requirements.",
    officialRequirement:
      "Advisers with custody are subject to qualified custodian, notice, account statement, and verification requirements unless an exception applies.",
    howSliceSupportsIt:
      "Slice includes no-custody/no-trading disclosures and requires sensitive action review posture.",
    userFacingEvidence: [
      "No custody/trading disclosure is required.",
      "No client-money movement is represented by default.",
      "Matrix warns that future custody/trading integrations require separate review.",
    ],
    recordsToKeep: [
      "Boundary disclosure",
      "Integration review",
      "Vendor/custodian agreements if added",
      "Client authorization if applicable",
      "Entitlement controls",
    ],
    proofNeededBeforeProduction: [
      "Custody/trading legal analysis",
      "Qualified custodian review",
      "Entitlement controls",
      "Client notice/account statement workflow if applicable",
    ],
    unavoidableHumanReview:
      "Counsel/compliance must approve any custody, trading, payment, or discretionary authority integration.",
    status: "Strong Evidence",
    risk: "High",
    tone: "green",
  },
  {
    id: "team-supervision",
    platformFeature: "Team Board, delegation, tasks, review queues, and supervision",
    learningSummary:
      "Team workflows can support supervision only if tasks, reviews, approvals, and escalations are recorded and retained.",
    officialSourceIds: ["compliance20647", "finra3110", "booksRecords2042"],
    rulePlacement:
      "Adviser compliance procedures and FINRA supervision where applicable.",
    officialRequirement:
      "Firms need procedures reasonably designed for compliance and, for FINRA members, supervisory systems reasonably designed for securities-law and FINRA-rule compliance.",
    howSliceSupportsIt:
      "Slice supports task assignment, review posture, audit evidence, and compliance control mapping.",
    userFacingEvidence: [
      "Team tasks can document who owns a review.",
      "Compliance review can identify required controls.",
      "Records tab identifies supervisory evidence needs.",
    ],
    recordsToKeep: [
      "Task owner",
      "Review due date",
      "Review outcome",
      "Escalation",
      "Approval/sign-off",
      "Supervisory notes",
    ],
    proofNeededBeforeProduction: [
      "Formal approval queue",
      "Supervisory sign-off",
      "Exception reporting",
      "Remediation tracking",
    ],
    unavoidableHumanReview:
      "A designated supervisor or compliance reviewer must approve and close supervisory exceptions.",
    status: "Policy Required",
    risk: "Medium",
    tone: "amber",
  },
  {
    id: "political-contributions",
    platformFeature: "Political/campaign/public-entity related workflows if later enabled",
    learningSummary:
      "If Slice supports public plans, government entities, political fundraising, or adviser contribution tracking, pay-to-play controls become important.",
    officialSourceIds: ["payToPlay20645", "booksRecords2042", "compliance20647"],
    rulePlacement:
      "Adviser pay-to-play rule and related books-and-records/compliance procedures obligations.",
    officialRequirement:
      "Certain political contributions, solicitors, covered associates, and government-entity relationships must be tracked and controlled.",
    howSliceSupportsIt:
      "Slice currently treats this as a conditional production feature and flags it as requiring policy controls before use.",
    userFacingEvidence: [
      "Matrix identifies pay-to-play conditional applicability.",
      "Records tab identifies covered-associate and government-entity records.",
    ],
    recordsToKeep: [
      "Covered associate list",
      "Government entity list",
      "Contribution records",
      "Solicitor/placement-agent records",
      "Review/approval evidence",
    ],
    proofNeededBeforeProduction: [
      "Contribution preclearance",
      "Government entity tracking",
      "Covered associate register",
      "Two-year timeout rules review",
    ],
    unavoidableHumanReview:
      "Compliance/legal review is mandatory before enabling public-entity or political contribution workflows.",
    status: "Production Gap",
    risk: "High",
    tone: "red",
  },
];

const RETENTION_ITEMS: RetentionItem[] = [
  {
    recordType: "Disclosure acceptance evidence",
    sourceIds: ["booksRecords2042", "marketing20641", "regSP"],
    whyItMatters:
      "Shows that users accepted platform limitations, AI limitations, market-intelligence limitations, privacy terms, no-custody boundaries, and advisor-review requirements.",
    evidenceCaptured: [
      "Disclosure key",
      "Disclosure version",
      "Disclosure title",
      "Content snapshot",
      "Accepted user",
      "Accepted email",
      "Accepted timestamp",
      "Audit event",
    ],
    requiredContents: [
      "Exact disclosure text accepted",
      "Version",
      "User identity",
      "Date/time",
      "Disclosure category",
      "Audit reference",
    ],
    retentionExpectation:
      "Retain as compliance evidence and platform-use disclosure history. Exact retention period must follow the firm’s written books-and-records policy.",
    archiveGap:
      "Needs immutable export, legal hold, and regulator-ready retrieval before production reliance.",
    status: "Captured",
    tone: "green",
  },
  {
    recordType: "Audit trail and sensitive action records",
    sourceIds: ["booksRecords2042", "compliance20647", "regSP", "finra4511"],
    whyItMatters:
      "Shows who did what, when, why it mattered, and whether the event requires compliance review.",
    evidenceCaptured: [
      "Event type",
      "Severity",
      "Area",
      "Title",
      "Detail",
      "Metadata",
      "Timestamp",
      "IP address where available",
      "User agent where available",
    ],
    requiredContents: [
      "Actor",
      "Event",
      "Timestamp",
      "Severity",
      "Workflow area",
      "Evidence metadata",
      "Review status",
      "Remediation if needed",
    ],
    retentionExpectation:
      "Retain according to adviser/broker-dealer recordkeeping policy, cybersecurity evidence policy, and legal hold requirements.",
    archiveGap:
      "Needs tamper-evident archive, export, legal hold, retention schedule, and deletion controls.",
    status: "Partial",
    tone: "amber",
  },
  {
    recordType: "Security and compliance review records",
    sourceIds: ["compliance20647", "regSP"],
    whyItMatters:
      "Shows recurring control review, warnings, deficiencies, and remediation status.",
    evidenceCaptured: [
      "Last review timestamp",
      "Warning list",
      "Disclosure completion status",
      "Security setting state",
      "Audit event",
    ],
    requiredContents: [
      "Reviewer",
      "Date",
      "Controls reviewed",
      "Findings",
      "Owner",
      "Remediation due date",
      "Final sign-off",
    ],
    retentionExpectation:
      "Annual review evidence should be retained under compliance program policies and procedures.",
    archiveGap:
      "Needs CCO/principal sign-off workflow, remediation tracking, annual review package export.",
    status: "Partial",
    tone: "amber",
  },
  {
    recordType: "Client-facing communications",
    sourceIds: ["booksRecords2042", "finra2210", "finra3110", "finra4511", "exchangeAct17a4"],
    whyItMatters:
      "Client communications may contain advice, proposed advice, recommendations, marketing, or retail communications.",
    evidenceCaptured: [
      "Draft text where available",
      "Status",
      "Tone",
      "Compliance notes",
      "Client/audience metadata where available",
    ],
    requiredContents: [
      "Final sent version",
      "Recipient/audience",
      "Approver/principal",
      "Approval timestamp",
      "Delivery date",
      "Communication category",
      "Disclosure package",
    ],
    retentionExpectation:
      "Retain final communications and related approvals according to adviser or broker-dealer recordkeeping requirements.",
    archiveGap:
      "Needs final delivery capture, approval workflow, and immutable archive/export.",
    status: "Needs Archive",
    tone: "red",
  },
  {
    recordType: "Reports, performance content, and market commentary",
    sourceIds: ["booksRecords2042", "marketing20641", "finra2210"],
    whyItMatters:
      "Reports and commentary can become client communication, advertisement, recommendation support, or performance material.",
    evidenceCaptured: [
      "Report title",
      "Summary",
      "Sections",
      "Status",
      "Created date",
      "Download/view token",
    ],
    requiredContents: [
      "Final version",
      "Supporting source material",
      "Calculation support",
      "Approver",
      "Audience",
      "Distribution evidence",
      "Performance substantiation if applicable",
    ],
    retentionExpectation:
      "Retain final report and supporting records where externally used or required by firm policy.",
    archiveGap:
      "Needs final-version lock, substantiation upload, approval metadata, and archive export.",
    status: "Partial",
    tone: "amber",
  },
  {
    recordType: "Privacy and incident response records",
    sourceIds: ["regSP", "regSID", "compliance20647"],
    whyItMatters:
      "Customer-information events and identity red flags need detection, response, remediation, and notice evidence.",
    evidenceCaptured: [
      "Security events",
      "Audit metadata",
      "User/session context",
      "Review logs",
    ],
    requiredContents: [
      "Incident date",
      "Detection date",
      "Affected data",
      "Affected individuals",
      "Notice decision",
      "Notice date",
      "Remediation",
      "Vendor involvement",
    ],
    retentionExpectation:
      "Retain according to written Regulation S-P and cybersecurity incident response procedures.",
    archiveGap:
      "Needs formal incident module, notice workflow, affected-user register, and escalation evidence.",
    status: "Needs Archive",
    tone: "red",
  },
  {
    recordType: "Political contribution and public-entity records",
    sourceIds: ["payToPlay20645", "booksRecords2042"],
    whyItMatters:
      "If public-entity workflows or political contribution features are enabled, pay-to-play restrictions and records may apply.",
    evidenceCaptured: [
      "Conditional feature flag only",
      "Compliance matrix warning",
    ],
    requiredContents: [
      "Covered associate list",
      "Government entity list",
      "Contribution records",
      "Solicitor records",
      "Review and approval evidence",
    ],
    retentionExpectation:
      "Retain according to pay-to-play and books-and-records obligations where applicable.",
    archiveGap:
      "Needs dedicated contribution preclearance and covered-associate module before live use.",
    status: "Manual Archive Required",
    tone: "red",
  },
];

const VIEW_TABS: Array<{
  key: SecurityView;
  label: string;
  helper: string;
  tone: Tone;
}> = [
  { key: "overview", label: "Overview", helper: "How to read this", tone: "red" },
  { key: "sources", label: "Official Sources", helper: "Rule library", tone: "cyan" },
  { key: "matrix", label: "Compliance Matrix", helper: "Feature proof", tone: "purple" },
  { key: "records", label: "Records", helper: "Retention", tone: "blue" },
  { key: "audit", label: "Audit Trail", helper: "Evidence", tone: "amber" },
  { key: "disclosures", label: "Disclosures", helper: "Acceptance", tone: "green" },
  { key: "controls", label: "Production Controls", helper: "Gaps", tone: "red" },
  { key: "settings", label: "Security Controls", helper: "Session", tone: "slate" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function severityTone(severity: string): Tone {
  if (severity === "Critical") return "red";
  if (severity === "Warning") return "amber";
  if (severity === "Info") return "green";
  return "slate";
}

function toneFor(value: string | number | boolean | null | undefined): Tone {
  const text = String(value ?? "").toLowerCase();

  if (
    text.includes("critical") ||
    text.includes("failed") ||
    text.includes("missing") ||
    text.includes("blocked") ||
    text.includes("warning") ||
    text.includes("false") ||
    text.includes("manual") ||
    text.includes("gap")
  ) {
    return "red";
  }

  if (
    text.includes("accepted") ||
    text.includes("complete") ||
    text.includes("healthy") ||
    text.includes("enabled") ||
    text.includes("true") ||
    text.includes("info") ||
    text.includes("strong") ||
    text.includes("captured")
  ) {
    return "green";
  }

  if (
    text.includes("pending") ||
    text.includes("review") ||
    text.includes("required") ||
    text.includes("open") ||
    text.includes("policy") ||
    text.includes("partial")
  ) {
    return "amber";
  }

  if (text.includes("audit") || text.includes("disclosure")) return "purple";
  if (text.includes("setting") || text.includes("session")) return "cyan";

  return "slate";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function safeJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value || "{}"), null, 2);
  } catch {
    return value || "{}";
  }
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "green";
  if (score >= 68) return "cyan";
  if (score >= 45) return "amber";
  return "red";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-red-500/15 bg-zinc-950/82 shadow-xl shadow-red-950/25 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/22",
    green: "from-emerald-500/16",
    amber: "from-amber-500/18",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    blue: "from-blue-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "red" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    blue: "bg-blue-500/10 text-blue-300 ring-blue-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Compliance Center
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
    blue: "from-blue-700 to-blue-300",
  };

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <div className="relative min-h-[116px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          tone === "red"
            ? "from-red-500/18"
            : tone === "green"
              ? "from-emerald-500/18"
              : tone === "amber"
                ? "from-amber-500/18"
                : tone === "purple"
                  ? "from-purple-500/18"
                  : tone === "cyan"
                    ? "from-cyan-500/18"
                    : tone === "blue"
                      ? "from-blue-500/18"
                      : "from-slate-400/10",
        )}
      />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function OfficialLinkButton({ source }: { source: OfficialSource }) {
  return (
    <a
      href={source.officialUrl}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100 transition hover:bg-red-500/20"
    >
      Open official source ↗
    </a>
  );
}

function SourceCard({ source }: { source: OfficialSource }) {
  return (
    <Panel tone="red" className="bg-black/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="red">{source.regulator}</Pill>
            <Pill tone="slate">{source.ruleLocation}</Pill>
            <Pill tone={toneFor(source.priority)}>{source.priority}</Pill>
          </div>
          <h3 className="mt-3 text-lg font-black text-white">{source.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{source.rulePlacement}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{source.plainEnglish}</p>
        </div>
        <OfficialLinkButton source={source} />
      </div>
    </Panel>
  );
}

function SettingToggle({
  label,
  helper,
  checked,
  tone,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  tone: Tone;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full rounded-[1.35rem] border p-4 text-left transition hover:bg-white/[0.08]",
        checked ? "border-emerald-500/25 bg-emerald-500/10" : "border-white/10 bg-white/[0.045]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">{label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{helper}</p>
        </div>
        <Pill tone={checked ? tone : "slate"}>{checked ? "Enabled" : "Off"}</Pill>
      </div>
    </button>
  );
}

export default function SecurityPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("43200");
  const [activeView, setActiveView] = useState<SecurityView>("overview");
  const [auditFilter, setAuditFilter] = useState("All");

  const acceptedPercent = useMemo(() => {
    if (!overview) return 0;
    if (overview.stats.requiredDisclosures === 0) return 100;

    return Math.round(
      (overview.stats.acceptedDisclosures / overview.stats.requiredDisclosures) * 100,
    );
  }, [overview]);

  const securityScore = useMemo(() => {
    if (!overview) return 0;

    const setting = overview.securitySetting;
    let score = 18;

    if (setting.mfaEnabled) score += 10;
    if (setting.requireReauthForSensitiveActions) score += 14;
    if (setting.alertOnNewLogin) score += 8;
    if (setting.advisorModeEnabled) score += 10;
    if (setting.sessionTimeoutMinutes <= 720) score += 8;
    if (acceptedPercent === 100) score += 14;
    if (overview.stats.criticalLogs === 0) score += 8;
    if (overview.stats.warningLogs === 0) score += 4;
    if (COMPLIANCE_CONTROLS.filter((item) => item.status === "Strong Evidence").length >= 3) score += 8;
    if (Object.keys(OFFICIAL_SOURCES).length >= 10) score += 8;

    return Math.max(0, Math.min(100, score));
  }, [overview, acceptedPercent]);

  const filteredAuditLogs = useMemo(() => {
    if (!overview) return [];

    if (auditFilter === "All") return overview.auditLogs;
    return overview.auditLogs.filter((log) => log.severity === auditFilter || log.area === auditFilter);
  }, [overview, auditFilter]);

  const auditAreas = useMemo(() => {
    if (!overview) return [];
    return Array.from(new Set(overview.auditLogs.map((log) => log.area))).filter(Boolean);
  }, [overview]);

  const matrixStats = useMemo(() => {
    const strong = COMPLIANCE_CONTROLS.filter((item) => item.status === "Strong Evidence").length;
    const policy = COMPLIANCE_CONTROLS.filter((item) => item.status === "Policy Required").length;
    const manual = COMPLIANCE_CONTROLS.filter((item) => item.status === "Manual Approval Required").length;
    const gaps = COMPLIANCE_CONTROLS.filter((item) => item.status === "Production Gap").length;

    return {
      strong,
      policy,
      manual,
      gaps,
      total: COMPLIANCE_CONTROLS.length,
    };
  }, []);

  async function loadData() {
    const response = await fetch("/api/security/overview", {
      cache: "no-store",
    });

    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (!response.ok) return;

    const data = (await response.json()) as Overview;
    setOverview(data);
    setSessionTimeout(String(data.securitySetting.sessionTimeoutMinutes));
  }

  async function updateSettings(patch: Partial<SecuritySetting>) {
    setMessage("");

    const response = await fetch("/api/security/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-slice-sensitive-action": "security-settings-update",
      },
      body: JSON.stringify(patch),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not update security settings.");
      return;
    }

    setMessage("Security settings updated and audit logged.");
    await loadData();
  }

  async function acceptDisclosure(disclosureKey: string) {
    setMessage("");

    const response = await fetch("/api/security/disclosures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slice-sensitive-action": "security-disclosure-accept",
      },
      body: JSON.stringify({ disclosureKey }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not accept disclosure.");
      return;
    }

    setMessage("Disclosure accepted, versioned, snapshotted, and audit logged.");
    await loadData();
  }

  async function acceptAll() {
    setMessage("");

    const response = await fetch("/api/security/disclosures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slice-sensitive-action": "security-disclosures-accept-all",
      },
      body: JSON.stringify({ acceptAll: true }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not accept disclosures.");
      return;
    }

    setMessage("All disclosures accepted, versioned, snapshotted, and audit logged.");
    await loadData();
  }

  async function runSecurityReview() {
    setMessage("");

    const response = await fetch("/api/security/review", {
      method: "POST",
      headers: {
        "x-slice-sensitive-action": "security-review",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Security review failed.");
      return;
    }

    setMessage(
      data.warnings?.length
        ? `Compliance review completed with warnings: ${data.warnings.join(" ")}`
        : "Compliance review completed successfully.",
    );

    await loadData();
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.60),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.28),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">Sign in to open the compliance center.</h1>
          <p className="mt-4 max-w-2xl text-slate-400">Register or log in through the functional portal first.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/portal"
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-6 py-4 font-black text-white shadow-lg shadow-red-950/40"
            >
              Go to Login Portal
            </a>
            <a href="/workspace" className="rounded-2xl bg-white px-6 py-4 font-black text-slate-950">
              Workspace
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.60),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.28),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-slate-400">Loading compliance center...</div>
        </div>
      </main>
    );
  }

  const setting = overview.securitySetting;
  const pendingDisclosures = overview.disclosures.filter((item) => !item.accepted);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.64),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(220,38,38,0.30),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(127,29,29,0.34),_transparent_38%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#220606)] p-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-20%] h-[40rem] w-[40rem] rounded-full bg-red-700/30 blur-3xl" />
        <div className="absolute right-[-14%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-red-500/18 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[30%] h-[34rem] w-[34rem] rounded-full bg-orange-700/12 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-red-500/20 bg-zinc-950/84 p-6 shadow-2xl shadow-red-950/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.34),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(185,28,28,0.18),transparent_30%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Compliance-critical</Pill>
                <Pill tone="cyan">Official rule links</Pill>
                <Pill tone="purple">Audit evidence</Pill>
                <Pill tone="green">Advisor review gates</Pill>
                <Pill tone="amber">Not legal certification</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Compliance command center for advisor-grade operations.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                This page maps each Slice platform element to official regulatory standards, direct rule locations,
                required records, disclosure evidence, audit trail expectations, security controls, and the remaining
                reviewer actions needed before production adviser, broker-dealer, or investor-facing use.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <Metric label="Compliance Score" value={`${securityScore}%`} helper="Calculated posture" tone={scoreTone(securityScore)} />
            <Metric label="Disclosures" value={`${acceptedPercent}%`} helper={`${overview.stats.acceptedDisclosures}/${overview.stats.requiredDisclosures} accepted`} tone={acceptedPercent === 100 ? "green" : "amber"} />
            <Metric label="Audit Logs" value={overview.stats.totalAuditLogs} helper="Recent records" tone="purple" />
            <Metric label="Warnings" value={overview.stats.warningLogs} helper="Review items" tone={overview.stats.warningLogs ? "amber" : "green"} />
            <Metric label="Critical" value={overview.stats.criticalLogs} helper="High-risk events" tone={overview.stats.criticalLogs ? "red" : "green"} />
            <Metric label="Strong Evidence" value={`${matrixStats.strong}/${matrixStats.total}`} helper="Feature controls" tone="cyan" />
            <Metric label="Policy Required" value={matrixStats.policy} helper="Still required" tone={matrixStats.policy ? "amber" : "green"} />
            <Metric label="Manual Review" value={matrixStats.manual} helper="Cannot automate away" tone={matrixStats.manual ? "red" : "green"} />
          </div>

          {message ? (
            <div className="relative mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}
        </header>

        <Card className="p-2">
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key)}
                className={cn(
                  "rounded-[1.25rem] px-3 py-2.5 text-left ring-1 transition hover:-translate-y-0.5",
                  activeView === tab.key
                    ? "bg-gradient-to-br from-white via-red-100 to-red-200 text-slate-950 shadow-xl shadow-red-950/25 ring-white/40"
                    : "bg-white/[0.045] text-white ring-white/10 hover:bg-red-500/10 hover:ring-red-400/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{tab.label}</div>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      tab.tone === "red"
                        ? "bg-red-400"
                        : tab.tone === "cyan"
                          ? "bg-cyan-400"
                          : tab.tone === "purple"
                            ? "bg-purple-400"
                            : tab.tone === "green"
                              ? "bg-emerald-400"
                              : tab.tone === "blue"
                                ? "bg-blue-400"
                                : tab.tone === "amber"
                                  ? "bg-amber-400"
                                  : "bg-slate-400",
                    )}
                  />
                </div>
                <div className="mt-1 text-[10px] font-bold text-slate-500">{tab.helper}</div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "overview" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                Learning layout
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Read compliance in the correct order
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">
                Start with the source library, then the feature matrix, then records, then audit evidence, then disclosures.
                The system is organized this way so a reviewer can understand the official rule, the affected feature,
                the evidence kept, and the remaining gap.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {LEARNING_STEPS.map((step) => (
                  <Panel key={step.title} tone={step.tone} className="bg-black/35">
                    <div className="text-sm font-black text-white">{step.title}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{step.body}</p>
                  </Panel>
                ))}
              </div>

              <div className="mt-6">
                <ProgressBar value={securityScore} tone={scoreTone(securityScore)} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["MFA readiness", setting.mfaEnabled, "Enable MFA readiness before external users rely on production access."],
                  ["Sensitive reauth", setting.requireReauthForSensitiveActions, "Require confirmation before high-impact actions."],
                  ["Login alerts", setting.alertOnNewLogin, "Notify user when a new login is detected."],
                  ["Advisor mode", setting.advisorModeEnabled, "Keeps client-facing workflows framed around review and suitability."],
                  ["Disclosures complete", acceptedPercent === 100, "Required platform disclosures should be accepted before live use."],
                  ["Critical event clean", overview.stats.criticalLogs === 0, "Critical events should be investigated immediately."],
                ].map(([label, enabled, helper]) => (
                  <Panel key={String(label)} tone={enabled ? "green" : "red"} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{label}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
                      </div>
                      <Pill tone={enabled ? "green" : "red"}>{enabled ? "Pass" : "Review"}</Pill>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>

            <div className="grid gap-5">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
                  Immediate actions
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">What to fix first</h2>

                <div className="mt-5 grid gap-3">
                  {!setting.mfaEnabled ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Enable MFA readiness</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Local flag is currently off.</p>
                    </Panel>
                  ) : null}

                  {!setting.requireReauthForSensitiveActions ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Require sensitive-action reauth</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">High-impact actions should require confirmation.</p>
                    </Panel>
                  ) : null}

                  {pendingDisclosures.length ? (
                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-sm font-black text-white">{pendingDisclosures.length} disclosure(s) pending</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Accept or review disclosures before production demonstrations.</p>
                    </Panel>
                  ) : null}

                  {overview.stats.criticalLogs ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Critical audit events detected</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Review critical events in the audit tab.</p>
                    </Panel>
                  ) : null}

                  <button
                    onClick={runSecurityReview}
                    className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
                  >
                    Run Compliance Review
                  </button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                  Official source quick links
                </div>
                <div className="mt-4 grid gap-3">
                  {Object.values(OFFICIAL_SOURCES).slice(0, 6).map((source) => (
                    <a
                      key={source.id}
                      href={source.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                    >
                      {source.ruleLocation} ↗
                      <span className="mt-1 block text-[10px] font-semibold text-red-200/70">{source.label}</span>
                    </a>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeView === "sources" ? (
          <section className="grid gap-5">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                Official source library
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Direct rule locations used by this compliance center
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">
                Every feature-level control below points to one or more official sources. This page intentionally links
                to official SEC/eCFR/FINRA rule locations rather than internal platform code.
              </p>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              {Object.values(OFFICIAL_SOURCES).map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "matrix" ? (
          <section className="grid gap-5">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                Feature-to-rule matrix
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Every major Slice feature mapped to rules, evidence, records, and gaps
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">
                The goal is not to claim automatic compliance. The goal is to prove which control supports which rule,
                what evidence exists, and what must still be reviewed before production use.
              </p>
            </Card>

            <div className="grid gap-5">
              {COMPLIANCE_CONTROLS.map((control) => (
                <Card key={control.id} className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={control.tone}>{control.status}</Pill>
                        <Pill tone={toneFor(control.risk)}>{control.risk} risk</Pill>
                        <Pill tone="purple">{control.platformFeature}</Pill>
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-white">{control.platformFeature}</h3>
                      <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">{control.learningSummary}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Rule placement</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{control.rulePlacement}</p>
                    </Panel>

                    <Panel tone="cyan" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Official requirement</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{control.officialRequirement}</p>
                    </Panel>

                    <Panel tone="green" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">How Slice supports it</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{control.howSliceSupportsIt}</p>
                    </Panel>

                    <Panel tone="red" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Unavoidable human review</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{control.unavoidableHumanReview}</p>
                    </Panel>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_450px]">
                    <Panel tone="purple" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">Evidence inside the platform</div>
                      <div className="mt-3 grid gap-2">
                        {control.userFacingEvidence.map((item) => (
                          <div key={item} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs font-bold leading-5 text-slate-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel tone="red" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Official source links</div>
                      <div className="mt-3 grid gap-2">
                        {control.officialSourceIds.map((sourceId) => {
                          const source = OFFICIAL_SOURCES[sourceId];

                          return (
                            <a
                              key={source.id}
                              href={source.officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-black leading-5 text-red-100 hover:bg-red-500/20"
                            >
                              {source.ruleLocation}
                              <span className="mt-1 block text-[10px] font-semibold text-red-200/70">{source.regulator}</span>
                            </a>
                          );
                        })}
                      </div>
                    </Panel>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <Panel tone="blue" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Records to keep</div>
                      <div className="mt-3 grid gap-2">
                        {control.recordsToKeep.map((record) => (
                          <div key={record} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs font-bold text-slate-300">
                            {record}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Proof needed before production</div>
                      <div className="mt-3 grid gap-2">
                        {control.proofNeededBeforeProduction.map((proof) => (
                          <div key={proof} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs font-bold text-slate-300">
                            {proof}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel tone="red" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Compliance conclusion</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        {control.status === "Strong Evidence"
                          ? "Platform evidence is strong, but firm policy and periodic review still apply."
                          : control.status === "Policy Required"
                            ? "The UI supports the workflow, but written procedures and owner sign-off are required."
                            : control.status === "Manual Approval Required"
                              ? "This cannot be safely automated. Human review is required before external use."
                              : "This should not be enabled in production until the gap is closed."}
                      </p>
                    </Panel>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "records" ? (
          <section className="grid gap-5">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
                Records and retention
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                What must be kept, why it must be kept, and which official rule supports it
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">
                Slice creates structured evidence for disclosures, audit events, reports, messages, commands, drafts, and reviews.
                For production compliance, the firm still needs export, immutable archive, WORM where required, legal hold,
                retention schedules, supervisory approval workflows, and regulator-ready retrieval.
              </p>
            </Card>

            <div className="grid gap-5">
              {RETENTION_ITEMS.map((item) => (
                <Card key={item.recordType} className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={item.tone}>{item.status}</Pill>
                    <Pill tone="blue">{item.recordType}</Pill>
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-white">{item.recordType}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{item.whyItMatters}</p>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <Panel tone="purple" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">Evidence captured in platform</div>
                      <div className="mt-3 grid gap-2">
                        {item.evidenceCaptured.map((evidence) => (
                          <div key={evidence} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs font-bold text-slate-300">
                            {evidence}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel tone="green" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Required contents</div>
                      <div className="mt-3 grid gap-2">
                        {item.requiredContents.map((content) => (
                          <div key={content} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs font-bold text-slate-300">
                            {content}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Retention expectation</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{item.retentionExpectation}</p>
                    </Panel>

                    <Panel tone="red" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Archive gap</div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{item.archiveGap}</p>
                    </Panel>
                  </div>

                  <div className="mt-5">
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Official source links</div>
                      <div className="mt-3 grid gap-2 xl:grid-cols-2">
                        {item.sourceIds.map((sourceId) => {
                          const source = OFFICIAL_SOURCES[sourceId];
                          return <SourceCard key={source.id} source={source} />;
                        })}
                      </div>
                    </Panel>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "audit" ? (
          <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                Audit explorer
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Compliance audit trail</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review sensitive actions, platform events, disclosures, security review history, event metadata, and evidence payloads.
              </p>

              <div className="mt-5 grid gap-3">
                <select
                  value={auditFilter}
                  onChange={(event) => setAuditFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option>All</option>
                  <option>Critical</option>
                  <option>Warning</option>
                  <option>Info</option>
                  {auditAreas.map((area) => (
                    <option key={area}>{area}</option>
                  ))}
                </select>

                <Metric label="Visible" value={filteredAuditLogs.length} helper="Filtered records" tone="purple" />
                <Metric label="Critical" value={overview.stats.criticalLogs} tone={overview.stats.criticalLogs ? "red" : "green"} />
                <Metric label="Warnings" value={overview.stats.warningLogs} tone={overview.stats.warningLogs ? "amber" : "green"} />
              </div>

              <Panel tone="red" className="mt-5 bg-black/35">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Audit standard</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Audit logs should be exportable, immutable where required, searchable, reviewable, and tied to retention policy.
                </p>
              </Panel>
            </Card>

            <Card className="p-5">
              <div className="grid max-h-[980px] gap-4 overflow-y-auto pr-2">
                {filteredAuditLogs.map((log) => (
                  <Panel key={log.id} tone={severityTone(log.severity)} className="bg-black/35">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={severityTone(log.severity)}>{log.severity}</Pill>
                          <Pill tone="purple">{log.area}</Pill>
                          <Pill tone="slate">{relativeTime(log.createdAt)}</Pill>
                          <Pill tone="cyan">{log.eventType}</Pill>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-white">{log.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{log.detail || "No detail recorded."}</p>
                        <div className="mt-2 text-xs font-bold text-slate-600">{formatDateTime(log.createdAt)}</div>
                      </div>
                    </div>

                    <details className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Metadata / Evidence JSON
                      </summary>
                      <pre className="mt-3 max-h-[360px] overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                        {safeJson(log.metadataJson)}
                      </pre>
                    </details>
                  </Panel>
                ))}

                {!filteredAuditLogs.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No audit records match this filter.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "disclosures" ? (
          <section className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
                Disclosure status
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">{acceptedPercent}% accepted</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Required disclosures are versioned, accepted by user, stored with content snapshots, and audit logged.
              </p>

              <div className="mt-5">
                <ProgressBar value={acceptedPercent} tone={acceptedPercent === 100 ? "green" : "amber"} />
              </div>

              <div className="mt-5 grid gap-3">
                <Metric label="Accepted" value={overview.stats.acceptedDisclosures} tone="green" />
                <Metric label="Required" value={overview.stats.requiredDisclosures} tone="amber" />
                <Metric label="Pending" value={pendingDisclosures.length} tone={pendingDisclosures.length ? "red" : "green"} />
              </div>

              {pendingDisclosures.length ? (
                <button onClick={acceptAll} className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                  Accept All Pending
                </button>
              ) : null}
            </Card>

            <Card className="p-5">
              <div className="grid gap-4">
                {overview.disclosures.map((disclosure) => (
                  <Panel key={disclosure.disclosureKey} tone={disclosure.accepted ? "green" : "amber"} className="bg-black/35">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={disclosure.accepted ? "green" : "amber"}>
                            {disclosure.accepted ? "Accepted" : "Required"}
                          </Pill>
                          <Pill tone="slate">v{disclosure.version}</Pill>
                          <Pill tone="purple">{disclosure.disclosureKey}</Pill>
                          {disclosure.acceptedAt ? <Pill tone="green">{relativeTime(disclosure.acceptedAt)}</Pill> : null}
                        </div>

                        <h3 className="mt-3 text-xl font-black text-white">{disclosure.title}</h3>
                        <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-slate-400">
                          {disclosure.content}
                        </p>
                      </div>

                      {!disclosure.accepted ? (
                        <button
                          onClick={() => acceptDisclosure(disclosure.disclosureKey)}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                        >
                          Accept
                        </button>
                      ) : null}
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "controls" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Production control checklist
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                What must exist before the platform can be relied on for compliance
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                This checklist prevents the platform from pretending UI controls alone equal regulatory compliance.
                The system must safely keep records, link records to official obligations, and preserve evidence in a regulator-ready form.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Written policies and CCO ownership", "Firm must maintain written procedures and designate responsible compliance ownership.", "green"],
                  ["Immutable archive / WORM", "Audit logs and client-facing communications need export and immutable retention where required.", "cyan"],
                  ["Principal/advisor approval workflow", "Client-facing reports, ads, testimonials, endorsements, and emails need approval metadata.", "purple"],
                  ["Incident response program", "Privacy/cyber events need detection, response, recovery, and notice workflow.", "amber"],
                  ["Marketing substantiation", "Performance, claims, testimonials, and third-party ratings need supporting files and disclosures.", "red"],
                  ["Vendor and AI oversight", "AI providers, data vendors, email vendors, and hosting must be reviewed and documented.", "cyan"],
                  ["Data classification", "Client PII, account data, notes, and communications need classification and access controls.", "green"],
                  ["Retention schedule", "Records must be mapped to retention periods and export formats.", "amber"],
                  ["Testing and evidence", "Security reviews, access tests, backups, and audit exports need recurring evidence.", "purple"],
                  ["Source substantiation", "Claims, statistics, and market analysis need source support and calculation backup.", "blue"],
                  ["Final-use lock", "Drafts need final approved versions locked before distribution.", "red"],
                  ["Legal hold", "Records subject to dispute, inquiry, exam, or investigation must be preserved.", "amber"],
                ].map(([title, body, tone]) => (
                  <Panel key={title} tone={tone as Tone} className="bg-black/35">
                    <div className="text-sm font-black text-white">{title}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                Before advisor rollout
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Do not skip these</h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Enable MFA readiness and sensitive-action reauthentication.",
                  "Accept all required disclosures.",
                  "Run Compliance Review and resolve warnings.",
                  "Review critical and warning audit events.",
                  "Confirm email delivery remains approval-gated.",
                  "Confirm AI-generated client communication is reviewed by an advisor before sending.",
                  "Add immutable archive/export for reports, communications, disclosures, approvals, and audit logs.",
                  "Add principal/CCO approval metadata before broker-dealer or dual-registrant communications.",
                  "Add incident-response workflow for Regulation S-P privacy events.",
                  "Add Regulation S-ID red-flag workflow if covered-account/identity-risk workflows apply.",
                  "Add custody/trading/payment legal review before integrating client money or securities movement.",
                  "Have securities counsel or compliance consultant review the final production workflow.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                Security controls
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">Controls that support compliance readiness</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                These controls support the platform’s compliance posture but do not replace firm written policies,
                incident-response procedures, supervisory procedures, or CCO review.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SettingToggle
                  label="MFA readiness"
                  helper="Marks the account as requiring multi-factor authentication in production readiness checks."
                  checked={setting.mfaEnabled}
                  tone="green"
                  onChange={(value) => updateSettings({ mfaEnabled: value })}
                />
                <SettingToggle
                  label="Require reauthentication"
                  helper="Requires extra confirmation for sensitive actions such as approvals, delivery, and platform changes."
                  checked={setting.requireReauthForSensitiveActions}
                  tone="green"
                  onChange={(value) => updateSettings({ requireReauthForSensitiveActions: value })}
                />
                <SettingToggle
                  label="New login alerts"
                  helper="Keeps login-awareness enabled for new device or new session events."
                  checked={setting.alertOnNewLogin}
                  tone="cyan"
                  onChange={(value) => updateSettings({ alertOnNewLogin: value })}
                />
                <SettingToggle
                  label="Advisor mode"
                  helper="Frames workflows around suitability, evidence, and client-facing communication controls."
                  checked={setting.advisorModeEnabled}
                  tone="purple"
                  onChange={(value) => updateSettings({ advisorModeEnabled: value })}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                Session policy
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Session timeout</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Shorter sessions are safer for shared office environments. Longer sessions are more convenient during build/demo work.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  type="number"
                  min={15}
                  max={43200}
                  value={sessionTimeout}
                  onChange={(event) => setSessionTimeout(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none ring-red-500 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => updateSettings({ sessionTimeoutMinutes: Number(sessionTimeout) })}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                >
                  Save Timeout
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {[30, 120, 720, 43200].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      setSessionTimeout(String(minutes));
                      void updateSettings({ sessionTimeoutMinutes: minutes });
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-sm font-bold text-slate-300 hover:bg-white/[0.08]"
                  >
                    {minutes < 60 ? `${minutes} minutes` : minutes < 1440 ? `${minutes / 60} hours` : "30 days"}
                  </button>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}