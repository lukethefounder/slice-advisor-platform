"use client";
import { memo, useState } from "react";
import type { MarketSeries } from "@/lib/market-evidence/contracts";
import { observationLabel, priceText, type ChartModel } from "@/lib/market-evidence/chart-model";
import css from "./chart-pro.module.css";
const ObservationRows = memo(function ObservationRows({ model }: { model: ChartModel }) {
  return <tbody>{[...model.points].reverse().map(point => <tr key={point.at}><th scope="row">{observationLabel(point.at,true)}</th><td>{priceText(point.open)}</td><td>{priceText(point.high)}</td><td>{priceText(point.low)}</td><td>{priceText(point.close)}</td><td>{priceText(point.volume,0)}</td></tr>)}</tbody>;
});
export default memo(function ChartAudit({ model, series }: { model: ChartModel; series: MarketSeries }) {
  const [open,setOpen] = useState(false);
  return <details className={css.dataTable} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Inspect and audit {model.points.length} visible observations</summary>
    {open && <div><table><caption>{series.symbol} · {series.endpoint} · {series.basis}</caption><thead><tr><th scope="col">Observation</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume</th></tr></thead><ObservationRows model={model}/></table></div>}
  </details>;
});
