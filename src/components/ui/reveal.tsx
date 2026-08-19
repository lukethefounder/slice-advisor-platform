"use client";

import type { ReactNode } from "react";
import {
  motion,
  useReducedMotion,
} from "framer-motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/**
 * Reveals homepage content as it enters the viewport.
 *
 * The component respects the user's reduced-motion preference. When reduced
 * motion is enabled, content renders immediately without translating or
 * fading.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
}: RevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reducedMotion
          ? false
          : {
              opacity: 0,
              y: 24,
            }
      }
      whileInView={
        reducedMotion
          ? undefined
          : {
              opacity: 1,
              y: 0,
            }
      }
      viewport={{
        once: true,
        margin: "-80px",
      }}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}