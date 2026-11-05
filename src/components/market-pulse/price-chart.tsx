"use client";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, LockKeyhole, Minus, Plus, RotateCcw, SlidersHorizontal, Unlock } from "lucide-react";
import type { MarketSeries } from "@/lib/market-evidence/contracts";
import { DEFAULT_CHART, chartPreset, type ChartSettings } from "@/lib/market-evidence/chart-settings";
import { buildChartModel, chartCsv, chartRows, nearestObservation, observationLabel, panWindow, priceText, zoomWindow, type ViewWindow } from "@/lib/market-evidence/chart-model";
import css from "./chart-pro.module.css";
import ChartInsights from "@/components/instant-workspace/chart-insights";

type Props = {
  series: MarketSeries;
  comparison?: MarketSeries | null;
  motion: boolean;
  options?: ChartSettings;
  symbols?: string[];
  onOptionsChange?: (next: ChartSettings) => void;
};
function PriceChart(props: Props) {
  const options = props.options ?? DEFAULT_CHART;
  return <ChartSession key={`${props.series.symbol}:${props.series.range}:${options.session}`} {...props} options={options} />;
}
export default memo(PriceChart);
function ChartSession({ series, comparison, motion, options = DEFAULT_CHART, symbols = [], onOptionsChange }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, ""), root = useRef<HTMLDivElement>(null);
  const pendingFrame = useRef<number | null>(null), pointerFraction = useRef(0), fullscreenButton = useRef<HTMLButtonElement>(null);
  const [viewport, setViewport] = useState<Partial<ViewWindow>>({}), [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false), [message, setMessage] = useState(""), [expanded, setExpanded] = useState(false), [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const built = useMemo(() => { try { return { model: buildChartModel(series, options, viewport, comparison), error: "" }; } catch (e) { return { model: null, error: e instanceof Error ? e.message : "Chart data could not be validated." }; } }, [series, comparison, options, viewport]);
  const model = built.model;
  const maxVolume = useMemo(() => Math.max(1, ...(model?.points.map(p => p.volume ?? 0) ?? [])), [model]);
  const overview = useMemo(() => {
    try {
      const rows = chartRows(series, options.session); if (rows.length < 2) return "";
      const low = Math.min(...rows.map(b => b.close)), high = Math.max(...rows.map(b => b.close)), spread = Math.max(high - low, high * .001);
      return rows.map((b, i) => `${!i || b.gapBefore ? "M" : "L"}${(i / (rows.length-1) * 960).toFixed(1)},${(42 - (b.close-low)/spread*34).toFixed(1)}`).join(" ");
    } catch { return ""; }
  }, [series, options.session]);
  useEffect(() => {
    setFullscreenAvailable(Boolean(document.fullscreenEnabled));
    const change = () => setExpanded(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", change);
    return () => { document.removeEventListener("fullscreenchange", change); if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current); };
  }, []);
  function change(next: Partial<ChartSettings>) { onOptionsChange?.({ ...options, ...next }); }
  function inspect(event: ReactPointerEvent<SVGSVGElement>) {
    if (!model || pinned) return;
    const box = event.currentTarget.getBoundingClientRect(); if (!box.width) return;
    pointerFraction.current = (event.clientX - box.left) / box.width;
    if (pendingFrame.current !== null) return;
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const point = model.points[nearestObservation(model.points, pointerFraction.current, model.width)];
      if (point) setSelectedAt(point.at);
    });
  }
  function clearHover() { if (pendingFrame.current !== null) { cancelAnimationFrame(pendingFrame.current); pendingFrame.current = null; } if (!pinned) setSelectedAt(null); }
  function chooseWindow(next: Partial<ViewWindow>) { clearHover(); setSelectedAt(null); setPinned(false); setViewport(next); }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement === root.current) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch { setMessage("The browser did not allow full-screen mode. Choose Tall in Chart controls instead."); }
  }
  function download() {
    if (!model) return;
    const url = URL.createObjectURL(new Blob([chartCsv(series,model)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `Slice-${series.symbol.replace(/[^A-Z0-9.-]/g,"")}-${series.range}-${model.first.at.slice(0,10)}-${model.last.at.slice(0,10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Exported ${model.points.length} visible observations with original timestamps and raw values.`);
  }
  const selected = model?.points.find(p => p.at === selectedAt) ?? model?.points.at(-1);
  const scaleLabel = model?.scale === "percent" ? "Change (%)" : model?.scale === "log" ? "Log source units" : series.endpoint==="INDEX_DATA"?"Index points":"Raw price";
  const formatTick = (v: number) => model?.scale === "percent" ? `${v > 0 ? "+" : ""}${priceText(v,2)}%` : priceText(v);
  const available = Boolean(onOptionsChange), comparing = Boolean(model?.comparisonCount);
  return <div ref={root} className={css.chart} data-accent={options.accent} data-height={options.height} data-motion={motion ? "on" : "off"} data-mode={options.mode} data-testid="chart-pro">
    <div className={css.toolbar}>
      <div className={css.styleGroup} role="group" aria-label="Chart style">{([ ["area","Area"], ["line","Line"], ["candles","Candles"] ] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={options.mode===value} disabled={!available} onClick={() => change({mode:value})}>{label}</button>)}</div>
      <label className={css.inlineLabel}>Scale<select aria-label="Price scale" disabled={!available || comparing} value={comparing ? "percent" : options.scale} onChange={e => change({scale:e.target.value as ChartSettings["scale"]})}><option value="price">Price</option><option value="percent">Percent</option><option value="log">Logarithmic</option></select></label>
      <div className={css.tools}><button type="button" aria-label="Zoom in" title="Zoom in to loaded observations" disabled={!model || model.points.length<=5} onClick={() => model && chooseWindow(zoomWindow(model.rows.length,model.window,.5))}><Plus size={15}/></button><button type="button" aria-label="Zoom out" disabled={!model || model.points.length>=model.rows.length} onClick={() => model && chooseWindow(zoomWindow(model.rows.length,model.window,2))}><Minus size={15}/></button><button type="button" aria-label="Reset zoom" disabled={!model} onClick={() => chooseWindow({})}><RotateCcw size={14}/></button><button type="button" aria-label="Export visible observations as CSV" disabled={!model} onClick={download}><Download size={15}/></button><button ref={fullscreenButton} type="button" aria-label={expanded ? "Exit full-screen chart" : "Open full-screen chart"} disabled={!fullscreenAvailable} onClick={() => void toggleFullscreen()}><Expand size={15}/></button></div>
    </div>
    <details className={css.controls}>
      <summary><SlidersHorizontal size={14}/>Chart controls<span>Overlays, comparison & appearance</span></summary>
      <div className={css.controlGrid}>
        <label>Quick layout<select aria-label="Chart preset" value="" disabled={!available} onChange={e => { if(e.target.value) onOptionsChange?.(chartPreset(e.target.value as "overview"|"technical"|"minimal",options)); }}><option value="">Choose a preset…</option><option value="overview">Overview</option><option value="technical">Technical</option><option value="minimal">Minimal</option></select></label>
        <label>Compare with<select aria-label="Comparison symbol" value={options.compareSymbol ?? ""} disabled={!available} onChange={e => change({compareSymbol:e.target.value || null})}><option value="">No comparison</option>{symbols.filter(s => s!==series.symbol).map(s => <option key={s} value={s}>{s}</option>)}</select><small>Loads one extra series; exact timestamps only.</small></label>
        <label>Chart height<select aria-label="Chart height" value={options.height} disabled={!available} onChange={e => change({height:e.target.value as ChartSettings["height"]})}><option value="compact">Compact</option><option value="standard">Standard</option><option value="tall">Tall</option></select></label>
        <label>Accent<select aria-label="Chart accent" value={options.accent} disabled={!available} onChange={e => change({accent:e.target.value as ChartSettings["accent"]})}><option value="emerald">Emerald</option><option value="cyan">Cyan</option><option value="violet">Violet</option></select></label>
        <label>Intraday session<select aria-label="Intraday session" value={options.session} disabled={!available || series.range!=="1D"} onChange={e => change({session:e.target.value as ChartSettings["session"]})}><option value="all">All returned hours</option><option value="regular">09:30–16:00 New York</option></select><small>Daily bars are unchanged by this filter.</small></label>
        <label>Visual reference price<input aria-label="Visual reference price" inputMode="decimal" type="number" min="0.000001" max="1000000000" step="any" value={options.referencePrice ?? ""} disabled={!available} onChange={e => { const n=Number(e.target.value); if(!e.target.value)change({referencePrice:null});else if(Number.isFinite(n)&&n>0&&n<=1e9)change({referencePrice:n}); }}/><small>A visual guide only—not a saved alert or order.</small></label>
      </div>
      <fieldset className={css.checks}><legend>Calculated overlays</legend>{([["sma20","SMA 20"],["sma50","SMA 50"],["ema20","EMA 20"],["bands20","20-bar ±2 SD bands"]] as const).map(([key,label]) => <label key={key}><input type="checkbox" disabled={!available} checked={options[key]} onChange={e => change({[key]:e.target.checked})}/>{label}</label>)}</fieldset>
      <fieldset className={css.checks}><legend>Display</legend>{([["showVolume","Volume"],["showGrid","Grid"],["showCrosshair","Crosshair"]] as const).map(([key,label]) => <label key={key}><input type="checkbox" disabled={!available} checked={options[key]} onChange={e => change({[key]:e.target.checked})}/>{label}</label>)}</fieldset>
      <p className={css.helper}>Indicators use only the loaded history before each bar. Zoom does not recalculate their starting point. Intraday gaps reset indicator warmup. Bands describe dispersion, not forecast probabilities.</p>
    </details>
    {!model || !selected ? <div className={css.empty} role="status"><strong>{built.error || "Not enough observations in this view."}</strong><p>{options.session==="regular"&&series.range==="1D" ? "Choose All returned hours if the latest returned session has no regular-session bars." : "At least two valid observations are required. Missing data is never invented."}</p>{options.session==="regular"&&<button type="button" onClick={() => change({session:"all"})}>Show all returned hours</button>}</div> : <>
      <div className={css.readout} aria-live="off"><div className={css.readoutMain}><small>{pinned ? "PINNED OBSERVATION" : selectedAt ? "INSPECTING OBSERVATION" : "LAST PLOTTED CLOSE"}</small><strong>{priceText(selected.close)}</strong><span>{observationLabel(selected.at,true)}</span></div><dl className={css.ohlc}>{([ ["Open",selected.open],["High",selected.high],["Low",selected.low],["Close",selected.close] ] as const).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{priceText(value)}</dd></div>)}</dl><button type="button" className={css.pin} aria-pressed={pinned} aria-label={pinned ? "Unpin observation" : "Pin observation"} onClick={() => {setPinned(!pinned);setSelectedAt(pinned?null:selected.at);}}>{pinned?<LockKeyhole size={14}/>:<Unlock size={14}/>}</button></div>
      {options.compareSymbol && <p className={comparing?css.helper:css.notice} role="status">{comparing ? `${series.symbol} and ${options.compareSymbol} rebased to 0% at ${observationLabel(model.comparisonBaseAt!,true)}. ${model.comparisonCount} exact shared timestamps; unmatched values are not filled.` : `Comparison with ${options.compareSymbol} is unavailable or has fewer than two matching timestamps. The primary series remains independently visible.`}</p>}
      <div className={css.legend}><span><i style={{background:"var(--chart-line)"}}/>{series.symbol} · {scaleLabel}</span>{comparing&&<span><i style={{background:"var(--chart-compare)"}}/>{options.compareSymbol}</span>}{([["sma20","SMA 20","var(--chart-sma)"],["sma50","SMA 50","var(--chart-sma50)"],["ema20","EMA 20","var(--chart-ema)"]] as const).map(([key,label,color]) => options[key]&&<span key={key}><i style={{background:color}}/>{label} {selected[key]===null?"· warming up":priceText(selected[key])}</span>)}{options.bands20&&<span><i style={{background:"var(--chart-band)"}}/>20-bar ±2 SD {selected.bandHigh===null?"· warming up":""}</span>}</div>
      <div className={css.plotWithAxis}>
        <svg className={css.plot} viewBox={`0 0 ${model.width} ${model.height}`} preserveAspectRatio="none" role="img" aria-label={`${series.symbol}: observed ${options.mode} chart. Original source observations only. Use the inspection slider below for exact values.`} onPointerMove={inspect} onPointerLeave={clearHover} onPointerDown={inspect}>
          <defs><linearGradient id={`${id}-gradient`} x1="0" x2="0.9" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-line)" stopOpacity=".28"/><stop offset="58%" stopColor="#20b8d5" stopOpacity=".11"/><stop offset="100%" stopColor="#8e62e8" stopOpacity=".02"/></linearGradient><clipPath id={`${id}-clip`}><rect x="0" y="0" width={model.width} height={model.height}/></clipPath></defs>
          {options.showGrid&&model.ticks.map((t,i)=><line key={i} x1="0" x2={model.width} y1={t.y} y2={t.y} className={css.grid}/>)}
          <g clipPath={`url(#${id}-clip)`}>
            {options.mode==="area"&&<path d={model.areaPath} fill={`url(#${id}-gradient)`}/>}
            {options.mode!=="candles"?<path d={model.closePath} fill="none" className={css.priceLine} vectorEffect="non-scaling-stroke"/>:<g data-testid="candlesticks">{model.points.map(p=>{const width=Math.max(1.5,Math.min(14,(model.width-26)/model.points.length*.63)),up=p.close>=p.open;return <g key={p.at} className={up?css.candleUp:css.candleDown}><line x1={p.x} x2={p.x} y1={p.highY} y2={p.lowY} vectorEffect="non-scaling-stroke"/><rect x={p.x-width/2} y={Math.min(p.openY,p.closeY)} width={width} height={Math.max(.7,Math.abs(p.openY-p.closeY))}/></g>;})}</g>}
            {options.bands20&&<g className={css.band}>{["bandLow","bandHigh"].map(key=><path key={key} d={model.overlayPaths[key as "bandLow"|"bandHigh"]} fill="none" vectorEffect="non-scaling-stroke"/>)}</g>}
            {([["sma20","var(--chart-sma)"],["sma50","var(--chart-sma50)"],["ema20","var(--chart-ema)"]] as const).map(([key,color])=>options[key]&&<path key={key} d={model.overlayPaths[key]} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>)}
            {comparing&&<path d={model.comparisonPath} fill="none" className={css.compareLine} vectorEffect="non-scaling-stroke"/>}
            {options.referencePrice!==null&&<line x1="0" x2={model.width} y1={model.y(options.referencePrice)} y2={model.y(options.referencePrice)} className={css.reference} vectorEffect="non-scaling-stroke"/>}
            {options.showCrosshair&&<g className={css.crosshair}><line x1={selected.x} x2={selected.x} y1="0" y2={model.height}/><line x1="0" x2={model.width} y1={selected.closeY} y2={selected.closeY}/></g>}
            {motion && !selectedAt && !pinned && <circle cx={model.points[model.points.length - 1].x} cy={model.points[model.points.length - 1].closeY} r="9" className={css.observationHalo} aria-hidden="true"/>}
            <circle cx={selected.x} cy={selected.closeY} r="4.5" className={css.priceDot}/>
          </g>
        </svg>
        <div className={css.yAxis} aria-hidden="true">{model.ticks.map((t,i)=><span key={i} style={{top:`${t.y/model.height*100}%`}}>{formatTick(t.value)}</span>)}</div>
      </div>
      <div className={css.xAxis}><span>{observationLabel(model.first.at)}</span><span>{model.points.length} / {model.rows.length} observations</span><span>{observationLabel(model.last.at)}</span></div>
      {options.showVolume&&model.points.some(p=>p.volume!==null)&&<div className={css.volume}><div><span>VOLUME · SAME SOURCE BARS</span><b>{priceText(selected.volume,0)} at selection</b></div><svg viewBox="0 0 960 60" preserveAspectRatio="none" role="img" aria-label="Volume of each displayed source observation">{model.points.filter(p=>p.volume!==null).map(p=><rect key={p.at} x={p.x-Math.min(16,920/model.points.length)/2} y={60-(p.volume??0)/maxVolume*58} width={Math.max(1,Math.min(16,920/model.points.length))} height={(p.volume??0)/maxVolume*58} fill={p.close>=p.open?"var(--chart-line)":"var(--chart-negative)"} opacity={p.at===selected.at?.toString()?1:.35}/>)}</svg></div>}
      <div className={css.inspectRow}><label htmlFor={`${id}-inspect`}>Inspect</label><input id={`${id}-inspect`} type="range" min="0" max={model.points.length-1} value={Math.max(0,model.points.indexOf(selected))} onChange={e=>{setPinned(true);setSelectedAt(model.points[Number(e.target.value)].at);}} aria-label="Inspect historical observation" aria-valuetext={`${observationLabel(selected.at,true)}; close ${selected.close}; volume ${selected.volume}`}/><button type="button" onClick={()=>{setSelectedAt(null);setPinned(false);}}>Latest</button></div>
      <div className={css.navigator}><div className={css.navigatorTop}><span>OBSERVATION NAVIGATOR</span><div><button type="button" aria-label="Pan earlier" disabled={model.window.start===0} onClick={()=>chooseWindow(panWindow(model.rows.length,model.window,-1))}><ChevronLeft size={14}/></button><button type="button" aria-label="Pan later" disabled={model.window.end===model.rows.length-1} onClick={()=>chooseWindow(panWindow(model.rows.length,model.window,1))}><ChevronRight size={14}/></button></div></div><div className={css.miniPlot}><svg viewBox="0 0 960 48" preserveAspectRatio="none" aria-hidden="true"><path d={overview} fill="none" stroke="var(--chart-line)" strokeWidth="1.4"/></svg><div className={css.windowShade} style={{left:`${model.window.start/(model.rows.length-1)*100}%`,right:`${(1-model.window.end/(model.rows.length-1))*100}%`}}/></div><div className={css.windowSliders}><label>Start<input aria-label="Visible window start" type="range" min="0" max={model.window.end-1} value={model.window.start} onChange={e=>chooseWindow({...model.window,start:Number(e.target.value)})}/></label><label>End<input aria-label="Visible window end" type="range" min={model.window.start+1} max={model.rows.length-1} value={model.window.end} onChange={e=>chooseWindow({...model.window,end:Number(e.target.value)})}/></label></div></div>
      <div className={css.metrics}><div><small>VISIBLE RAW CHANGE</small><b className={model.changePct<0?css.negative:css.positive}>{model.changePct>0?"+":""}{priceText(model.changePct,2)}%</b></div><div><small>VISIBLE LOW / HIGH</small><b>{priceText(model.low)} / {priceText(model.high)}</b></div><div><small>VISIBLE VOLUME</small><b>{priceText(model.totalVolume,0)}</b></div></div>
      {model.gapCount>0&&<p className={css.notice}>{model.gapCount} intraday gap{model.gapCount===1?"":"s"} in this window. Lines break and indicators restart after missing intervals; no prices were interpolated.</p>}
      {options.referencePrice!==null&&<p className={css.helper}>Reference: {priceText(options.referencePrice)} in raw price units. Display guide only; no alert has been created.</p>}
      <details className={css.dataTable}><summary>Inspect and audit {model.points.length} visible observations</summary><div><table><caption>{series.symbol} · {series.endpoint} · {series.basis}</caption><thead><tr><th scope="col">Observation</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume</th></tr></thead><tbody>{[...model.points].reverse().map(p=><tr key={p.at}><th scope="row">{observationLabel(p.at,true)}</th><td>{priceText(p.open)}</td><td>{priceText(p.high)}</td><td>{priceText(p.low)}</td><td>{priceText(p.close)}</td><td>{priceText(p.volume,0)}</td></tr>)}</tbody></table></div></details>
    </>}
    <p className={css.sourceNote}>{series.note} X-axis spacing represents consecutive returned observations, not equal elapsed wall-clock time. Prices are shown in source units.</p>
    <p role="status" className={css.status}>{message}</p>
    <ChartInsights series={series} session={options.session} />
  </div>;
}
