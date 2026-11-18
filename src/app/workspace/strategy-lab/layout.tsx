import type {ReactNode} from "react";
import ReadinessDisclosure from "@/components/unified-studio/readiness-disclosure";
import css from "@/components/unified-studio/unified.module.css";
export default function Layout({children}:{children:ReactNode}){return <div className={css.layout}><ReadinessDisclosure/>{children}</div>;}
