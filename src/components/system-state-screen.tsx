"use client";

import Link from "next/link";
import { PublicBrandMark } from "@/components/public-site/public-shell";
import styles from "./system-state-screen.module.css";

export type SystemStateScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  reference?: string | null;
  announce?: boolean;
};

function PrimaryAction({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className = `${styles.action} ${styles.primary}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

export function SystemStateScreen({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimary,
  secondaryLabel,
  secondaryHref,
  reference,
  announce = false,
}: SystemStateScreenProps) {
  return (
    <main className={styles.page}>
      <section
        role={announce ? "alert" : undefined}
        aria-live={announce ? "assertive" : undefined}
        className={styles.panel}
      >
        <PublicBrandMark subtitle="Advisor Intelligence Platform" />
        <div className={styles.eyebrow}>
          {eyebrow}
        </div>
        <h1 className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>
          {description}
        </p>

        {reference ? (
          <p className={styles.reference}>
            Reference: {reference}
          </p>
        ) : null}

        <div className={styles.actions}>
          {primaryLabel ? (
            <PrimaryAction
              label={primaryLabel}
              href={primaryHref}
              onClick={onPrimary}
            />
          ) : null}

          {secondaryLabel && secondaryHref ? (
            <Link
              href={secondaryHref}
              className={`${styles.action} ${styles.secondary}`}
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
