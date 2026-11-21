import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Database, GitBranch, Globe2, LockKeyhole, Menu, Newspaper, ShieldCheck } from "lucide-react";
import KnowledgeGraphLandingHero from "@/components/knowledge-graph/landing-hero";
import styles from "@/components/knowledge-graph/neural-home.module.css";
import { DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS, DEFAULT_PUBLIC_EDITION_MAX_AGE_MS, freshenPublicSnapshot, isTimestampWithin } from "@/lib/intelligence/freshness";
import { getPublicIntelligence } from "@/lib/public-intelligence";
import type { PublicArticle } from "@/lib/public-intelligence-types";
import { safeResearchSourceUrl } from "@/lib/intelligence/research-evidence";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Slice | A Mind for the Market",
  description: "Explore connected stock research through neural knowledge graphs, source evidence, personalized research weights, and inspectable model outcomes.",
};

const NAVIGATION = [
  { label: "The network", href: "#connections" },
  { label: "The method", href: "#method" },
  { label: "Source intelligence", href: "#sources" },
  { label: "Platform", href: "/platform" },
];

type HomeIntelligence = {
  articles: PublicArticle[];
  generatedAt: string | null;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
};

async function loadHomeIntelligence(): Promise<HomeIntelligence> {
  try {
    const snapshot = await getPublicIntelligence({
      allowRefresh: false,
      maxAgeMs: DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
    });
    const editionCurrent = isTimestampWithin(
      snapshot.generatedAt,
      DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
    );

    if (!editionCurrent) {
      return {
        articles: [],
        generatedAt: snapshot.generatedAt,
        newestPublishedAt: null,
        oldestPublishedAt: null,
      };
    }

    const freshened = freshenPublicSnapshot(snapshot, {
      maximumAgeMs: DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
      limit: 4,
      maximumPerSource: 2,
    });

    return {
      articles: freshened.snapshot.items,
      generatedAt: snapshot.generatedAt,
      newestPublishedAt: freshened.freshness.newestPublishedAt,
      oldestPublishedAt: freshened.freshness.oldestPublishedAt,
    };
  } catch {
    return {
      articles: [],
      generatedAt: null,
      newestPublishedAt: null,
      oldestPublishedAt: null,
    };
  }
}


function displayDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function EvidencePlaceholder() {
  return <div className={styles.emptyEvidence}><Database size={25}/><div><strong>Your research starts with traceable evidence.</strong><p>Explore the public edition or sign in to connect a stock with your saved sources and research.</p></div></div>;
}

async function PublicEvidenceFeed() {
  const intelligence = await loadHomeIntelligence();
  if (!intelligence.articles.length) return <EvidencePlaceholder/>;
  return <>
    <div className={styles.articleGrid}>
      {intelligence.articles.map(article => {
        const source = safeResearchSourceUrl(article.link);
        return <article key={article.id} className={styles.article}>
          <span>{article.sourceName || "Original source"}</span>
          <h3>{article.title}</h3>
          <p>{article.summary || "Open the original report to inspect the source."}</p>
          <div className={styles.articleFoot}>
            <time dateTime={article.publishedAt || undefined}>Published {displayDate(article.publishedAt)}</time>
            {source && <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Read original source: ${article.title} (opens in a new tab)`}>Read source<ArrowUpRight size={13} aria-hidden="true"/></a>}
          </div>
        </article>;
      })}
    </div>
    <p className={styles.edition}>Saved public edition · {displayDate(intelligence.generatedAt)} · Displayed articles have valid publication times within the current freshness window.</p>
  </>;
}

export default function HomePage() {
  return <div className={styles.root}>
    <header className={styles.siteHeader}>
      <div className={styles.headerInner}>
        <Link href="/" prefetch={false} className={styles.brand} aria-label="Slice home"><span className={styles.brandMark} aria-hidden="true">S</span><span><strong>Slice</strong><small>Connected intelligence</small></span></Link>
        <nav className={styles.navigation} aria-label="Public navigation">
          {NAVIGATION.map(item => <Link key={item.href} href={item.href} prefetch={false}>{item.label}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <Link href="/client-login" prefetch={false} className={styles.headerClient}>Client access</Link>
          <Link href="/founder-login" prefetch={false} className={styles.signIn}>Sign in<ArrowUpRight size={14}/></Link>
          <details className={styles.mobileMenu}>
            <summary aria-label="Navigation menu"><Menu size={18} aria-hidden="true"/></summary>
            <nav aria-label="Mobile public navigation">
              {NAVIGATION.map(item => <Link key={item.href} href={item.href} prefetch={false}>{item.label}</Link>)}
              <Link href="/client-login" prefetch={false}>Client access</Link>
              <Link href="/founder-login" prefetch={false}>Founder & advisor sign in</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>

    <main>
      <KnowledgeGraphLandingHero/>
      <section id="connections" className={styles.connections} aria-labelledby="connections-title">
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}>An interconnected view</p><h2 id="connections-title">One stock.<br/>A whole world of relationships.</h2></div>
            <p>Trace a company through its news, price structure, industry, and economic environment. See where the evidence agrees, where it conflicts, and what it could mean.</p>
          </div>
          <div className={styles.connectionGrid}>
            {[
              { number:"01", title:"Read the narrative.", detail:"Connect company news, catalysts, and original reporting. Follow each finding back to its source and publication time.", label:"MEDIA / EVENTS / SOURCE EVIDENCE", icon:Newspaper },
              { number:"02", title:"Understand the structure.", detail:"Bring price behavior, momentum, fundamentals, and risk into the same research network. Inspect the inputs behind the score.", label:"TECHNICALS / COMPANY / RISK", icon:ChartNoAxesCombined },
              { number:"03", title:"See the wider system.", detail:"Relate a stock to its sector and economic conditions. Keep changing assumptions and conflicting signals visible.", label:"ECONOMY / SECTORS / CONTEXT", icon:Globe2 },
            ].map(item => <article className={styles.connection} key={item.number}><span className={styles.connectionNumber}>{item.number}</span><item.icon size={28}/><h3>{item.title}</h3><p>{item.detail}</p><small>{item.label}</small></article>)}
          </div>
        </div>
      </section>

      <section id="method" className={styles.section + " " + styles.methodGrid} aria-labelledby="method-title">
        <div className={styles.methodCopy}>
          <p className={styles.eyebrow}>Reasoning you can inspect</p>
          <h2 id="method-title">The connections matter.<br/>So does the evidence.</h2>
          <p>Set your balance of media, technical, and economy research. Inspect source influence, disagreement, and score sensitivity before exploring possible outcomes across eight time horizons.</p>
          <Link href="/knowledge-graph" prefetch={false} className={styles.textLink}>Explore knowledge graphs<ArrowUpRight size={14}/></Link>
        </div>
        <div className={styles.methodSteps}>
          {[
            ["01", "Start with the daily brief", "Bring the highlighted stock into your workspace and follow its saved research."],
            ["02", "Explore the neural graph", "Select a node, trace its relationships, and open the original supporting sources."],
            ["03", "Inspect the model", "Review the research score, evidence quality, uncertainty, and horizon-specific probability estimates."],
          ].map(([number,title,description]) => <div key={number} className={styles.methodStep}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}
        </div>
      </section>

      <section id="sources" className={styles.evidenceSection} aria-labelledby="sources-title">
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}>From the source</p><h2 id="sources-title">Intelligence has a paper trail.</h2></div>
            <Link href="/daily-intelligence" prefetch={false} className={styles.textLink}>Public intelligence<ArrowUpRight size={14}/></Link>
          </div>
          <Suspense fallback={<EvidencePlaceholder/>}><PublicEvidenceFeed/></Suspense>
        </div>
      </section>

      <section className={styles.section + " " + styles.closing} aria-labelledby="access-title">
        <div><p className={styles.eyebrow}><ShieldCheck size={13} style={{display:"inline",verticalAlign:"middle",marginRight:8}}/>Your private research environment</p><h2 id="access-title">Connect the evidence.<br/>Bring your own perspective.</h2><p>Sign in to open your firm&apos;s workspace, saved briefs, and research graphs.</p></div>
        <Link href="/founder-login" prefetch={false} className={styles.primary}><LockKeyhole size={15}/>Sign in to your workspace<ArrowUpRight size={16}/></Link>
      </section>
    </main>

    <footer className={styles.footer}>
      <p><GitBranch size={12} style={{display:"inline",verticalAlign:"middle",marginRight:8}}/>Slice / Connected intelligence. Graph motion illustrates relationships; forecasts are model estimates. Research pathways can share evidence.</p>
      <nav aria-label="Footer navigation"><Link href="/security" prefetch={false}>Security</Link><Link href="/capabilities" prefetch={false}>Capabilities</Link><Link href="/founder-login" prefetch={false}>Sign in</Link></nav>
    </footer>
  </div>;
}
