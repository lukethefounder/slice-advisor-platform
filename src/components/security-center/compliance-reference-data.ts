/** Reference material retained from the existing compliance center. It is not a live control assessment. */

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan" | "blue";

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

export const OFFICIAL_SOURCES: Record<string, OfficialSource> = {
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

export const LEARNING_STEPS: LearningStep[] = [
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

export const COMPLIANCE_CONTROLS: ComplianceControl[] = [
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

export const RETENTION_ITEMS: RetentionItem[] = [
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
