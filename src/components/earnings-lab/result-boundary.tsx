import type { StudioView } from "@/lib/future-workspace/studio-route";
import css from "./earnings.module.css";
const descriptions:Record<string,{title:string;text:string}>={
 guided:{title:"PAST / Guided historical testing",text:"The existing versioned engine runs against verified saved data. Simulated fills are not broker transactions."},
 growth:{title:"WHAT IF / Assumption-driven price illustration",text:"User assumptions set the center; historical volatility sets a hypothetical model range. This is not realized performance or a calibrated forecast."},
 build:{title:"PAST / Historical simulation",text:"Rules evaluated using completed historical data. Modeled fills are not actual broker transactions."},
 results:{title:"PAST / Saved test results",text:"Historical and registered-paper figures retain separate labels, periods, and source identities. No future result is filled in."},
 monitor:{title:"FORWARD / Registered paper tracking",text:"Only accepted observations after registration produce paper results. Future dates are unobserved—not zero-return days."},
 live:{title:"NOW / Market observations",text:"Current quotes are evidence alongside the scenario. They do not settle daily performance or execute orders."},
 earnings:{title:"WHAT IF / Conditional earnings",text:"Future EPS is an explicit assumption. Historical analogs describe a sample; they do not establish a calibrated forecast."},
 sensitivity:{title:"PAST / Cost-stressed replay",text:"Same saved strategy and data under alternative cost assumptions—not a future price forecast."},
 evidence:{title:"NOW / Contextual evidence",text:"Recent news and disclosed activity are not retroactively inserted into older backtests."},
 report:{title:"SNAPSHOT / Reviewable evidence",text:"A saved report preserves its recorded evidence times and hypothetical/observed classifications."},
 audit:{title:"AUDIT / Recorded strategy history",text:"Review frozen definitions and accepted checkpoints without changing their calculation versions."}
};
export function ResultBoundary({view}:{view:StudioView}){const d=descriptions[view]??descriptions.build;return <aside className={css.notice} aria-label="Result classification"><strong>{d.title}</strong><div>{d.text}</div></aside>;}
