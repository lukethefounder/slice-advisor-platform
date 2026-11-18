import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, GitBranch, Network, ScanSearch } from "lucide-react";

import KnowledgeGraphSpotlight from "@/components/intelligence/knowledge-graph-spotlight";
import styles from "./knowledge-entry.module.css";

export default function KnowledgeGraphLandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="knowledge-hero-title">
      <div className={styles.heroInner}>
        <div className={styles.topline}>
          <span><Network size={14} aria-hidden="true" /> THE SLICE KNOWLEDGE GRAPH</span>
          <span className={styles.edition}>Connected evidence. Considered decisions.</span>
        </div>

        <div className={styles.heroHeading}>
          <div>
            <p className={styles.eyebrow}>A wider view of what comes next.</p>
            <h1 id="knowledge-hero-title">Every signal.<br /><em>Part of a bigger picture.</em></h1>
          </div>
          <div className={styles.heroCopy}>
            <p>Follow the relationships between a stock, its industry, the economy, and the sources behind the story.</p>
            <p className={styles.secondaryCopy}>Shape your research around media, technicals, and economics. Inspect the evidence behind model estimates of possible outcomes.</p>
            <div className={styles.actions}>
              <Link href="/workspace/intelligence" prefetch={false} className={styles.primary}>Open the knowledge graph <ArrowUpRight size={17} aria-hidden="true" /></Link>
              <Link href="/founder-login" prefetch={false} className={styles.secondary}>Founder access <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>

        <div className={styles.graphFrame}>
          <div className={styles.graphHeader}>
            <span><span className={styles.graphDot} /> EXPLORE THE RESEARCH NETWORK</span>
            <span>Illustrative relationships · no live forecast</span>
          </div>
          <KnowledgeGraphSpotlight variant="public" />
        </div>

        <div className={styles.principles}>
          <div><GitBranch size={20} aria-hidden="true" /><p><strong>Trace the reasoning.</strong><span>Follow a finding back to its source and research context.</span></p></div>
          <div><Network size={20} aria-hidden="true" /><p><strong>Set your research balance.</strong><span>Allocate up to 10,000 analytical pathways across three research lenses.</span></p></div>
          <div><ScanSearch size={20} aria-hidden="true" /><p><strong>Inspect possible outcomes.</strong><span>Read probability estimates with their horizon, evidence, and limitations.</span></p></div>
        </div>
        <p className={styles.heroFootnote}><ArrowDownRight size={13} aria-hidden="true" /> Research pathways can share evidence. More pathways do not, by themselves, mean more independent sources or greater predictive accuracy.</p>
      </div>
    </section>
  );
}
