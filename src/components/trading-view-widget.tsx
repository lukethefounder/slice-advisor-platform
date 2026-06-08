"use client";

import { useEffect, useMemo, useRef } from "react";
import { cx } from "@/components/slice-ui";

type TradingViewWidgetName =
  | "advanced-chart"
  | "ticker-tape"
  | "market-overview"
  | "stock-heatmap"
  | "screener"
  | "technical-analysis"
  | "symbol-overview";

const SCRIPT_SOURCES: Record<TradingViewWidgetName, string> = {
  "advanced-chart":
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "ticker-tape":
    "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js",
  "market-overview":
    "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
  "stock-heatmap":
    "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",
  screener: "https://s3.tradingview.com/external-embedding/embed-widget-screener.js",
  "technical-analysis":
    "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js",
  "symbol-overview":
    "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js",
};

type TradingViewWidgetProps = {
  widget: TradingViewWidgetName;
  config: Record<string, unknown>;
  title: string;
  className?: string;
  height?: number | string;
};

export function TradingViewWidget({
  widget,
  config,
  title,
  className = "",
  height = 420,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    container.innerHTML = "";

    const widgetMount = document.createElement("div");
    widgetMount.className = "tradingview-widget-container__widget h-full w-full";
    container.appendChild(widgetMount);

    const attribution = document.createElement("div");
    attribution.className = "tradingview-widget-copyright sr-only";
    attribution.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">Market data by TradingView</a>';
    container.appendChild(attribution);

    const script = document.createElement("script");
    script.src = SCRIPT_SOURCES[widget];
    script.type = "text/javascript";
    script.async = true;
    script.text = JSON.stringify({
      ...JSON.parse(serializedConfig),
      width: "100%",
      height: "100%",
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [serializedConfig, widget]);

  const resolvedHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      ref={containerRef}
      aria-label={title}
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35",
        className
      )}
      style={{ height: resolvedHeight }}
    />
  );
}