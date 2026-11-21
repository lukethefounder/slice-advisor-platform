"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, ArrowDown, ArrowUpRight, BookOpen, ChartNoAxesCombined, Cpu, Globe2, LockKeyhole, Network, Newspaper, Pause, Play, Radio } from "lucide-react";
import { useAmbientMotion } from "@/components/future-workspace/use-ambient-motion";
import styles from "./neural-home.module.css";

const NeuralBrainScene = dynamic(() => import("./neural-brain-scene"), {
  ssr: false,
  loading: () => <div className={styles.brainLoading} role="status"><Network size={42}/><span>Mapping the research network</span></div>,
});

const CIRCUITS = [
  { key: "media", label: "Media cortex", detail: "Narrative · catalysts · sources", icon: Newspaper, tone: "cyan" },
  { key: "technical", label: "Technical cortex", detail: "Structure · momentum · risk", icon: ChartNoAxesCombined, tone: "green" },
  { key: "economy", label: "Economic context", detail: "Sectors · policy · cycles", icon: Globe2, tone: "purple" },
  { key: "outcomes", label: "Possible outcomes", detail: "Time horizons · model estimates", icon: Activity, tone: "cyan" },
  { key: "sources", label: "Evidence memory", detail: "Original sources · provenance", icon: BookOpen, tone: "purple" },
] as const;

export default function KnowledgeGraphLandingHero() {
  const { ref, moving, paused, toggle } = useAmbientMotion();
  const motionUnavailable = !moving && !paused;
  return (
    <section ref={ref} className={styles.hero} data-moving={moving} aria-labelledby="knowledge-hero-title">
      <div className={styles.heroGrid} aria-hidden="true"/>
      <div className={styles.heroInner}>
        <div className={styles.heroTopline}>
          <span><Radio size={12} aria-hidden="true"/><i/>CONNECTED INTELLIGENCE / SLICE</span>
          <button type="button" className={styles.motionControl} onClick={toggle} aria-pressed={paused} disabled={motionUnavailable} title={motionUnavailable ? "Motion respects your device and display preferences." : undefined}>
            {paused ? <Play size={13} aria-hidden="true"/> : <Pause size={13} aria-hidden="true"/>}<span>{motionUnavailable ? "Motion reduced" : paused ? "Resume motion" : "Pause motion"}</span>
          </button>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A new perspective on the market.</p>
          <h1 id="knowledge-hero-title">A mind for<br/><em>the market.</em></h1>
          <p className={styles.heroDescription}>Follow the connections that turn scattered information into a clearer view of a stock.</p>
          <p className={styles.heroSecondary}>Media. Technicals. Economics. One evolving research network, with the reasoning and sources within reach.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primary} href="/founder-login" prefetch={false}><LockKeyhole size={15}/>Sign in to Slice<ArrowUpRight size={16}/></Link>
            <a className={styles.textLink} href="#connections">Explore the network<ArrowDown size={15}/></a>
          </div>
          <div className={styles.heroCapability}><Cpu size={17}/><p><strong>Up to 10,000 analytical pathways</strong><span>Your research mix. Shared evidence. Inspectable results.</span></p></div>
        </div>
        <div className={styles.brainStage}>
          <NeuralBrainScene variant="public" animated={moving} controls={false} height={680} className={styles.brainCanvas}/>
          <div className={styles.orbitField} aria-label="Explore Slice's research capabilities">
            {CIRCUITS.map(({ key, label, detail, icon: Icon, tone }) => (
              <a key={key} href="#connections" className={`${styles.featureNode} ${styles[key]}`} data-tone={tone}>
                <span className={styles.featureIcon}><Icon size={17} aria-hidden="true"/></span>
                <span><strong>{label}</strong><small>{detail}</small></span>
                <ArrowUpRight size={12} className={styles.featureArrow}/>
              </a>
            ))}
          </div>
        </div>
        <div className={styles.heroFooter}>
          <span><span className={styles.signalDot}/>A visual illustration of the research architecture</span>
          <a href="#connections">Trace the connections<ArrowDown size={13}/></a>
        </div>
      </div>
    </section>
  );
}
