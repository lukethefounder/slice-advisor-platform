"use client";
import { Fragment, memo, type ReactNode } from "react";
import { safeExternalHref, safeInternalHref } from "@/lib/studio/core";
import css from "./studio.module.css";
function inline(value: string): ReactNode[] {
    const parts = value.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g);
    return parts.map((p, i) => { if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={i}>{p.slice(2, -2)}</strong>; if (p.startsWith("`") && p.endsWith("`"))
        return <code key={i}>{p.slice(1, -1)}</code>; const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p); if (link && (safeExternalHref(link[2]) || safeInternalHref(link[2])))
        return <a key={i} href={link[2]} target={link[2].startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">{link[1]}</a>; return <Fragment key={i}>{p}</Fragment>; });
}
/** Safe React text renderer. Model HTML is never evaluated. No raw-HTML plug-in. */
function MessageContent({ value }: {
    value: string;
}) {
    const lines = value.split(/\r?\n/), blocks: ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        if (!lines[i].trim()) {
            i++;
            continue;
        }
        if (lines[i].startsWith("```")) {
            const language = lines[i++].slice(3).trim();
            const code: string[] = [];
            while (i < lines.length && !lines[i].startsWith("```"))
                code.push(lines[i++]);
            if (i < lines.length)
                i++;
            blocks.push(<div className={css.codeBlock} key={i}>{language && <small>{language.slice(0, 40)}</small>}<pre><code>{code.join("\n")}</code></pre></div>);
            continue;
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(lines[i]);
        if (heading) {
            blocks.push(<h3 key={i}>{inline(heading[2])}</h3>);
            i++;
            continue;
        }
        if (/^\s*([-*]|\d+[.)])\s/.test(lines[i])) {
            const ordered = /^\s*\d+[.)]/.test(lines[i]), items: ReactNode[] = [];
            while (i < lines.length && /^\s*([-*]|\d+[.)])\s/.test(lines[i])) {
                items.push(<li key={i}>{inline(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ""))}</li>);
            }
            blocks.push(ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>);
            continue;
        }
        if (lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
            const cells = (v: string) => v.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split("|").map(x => x.trim()).slice(0, 12);
            const head = cells(lines[i]);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].includes("|"))
                rows.push(cells(lines[i++]));
            blocks.push(<div className={css.tableWrap} key={i}><table><thead><tr>{head.map((h, n) => <th key={n}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((row, n) => <tr key={n}>{row.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);
            continue;
        }
        const paragraph: string[] = [lines[i++]];
        while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*([-*]|\d+[.)])\s)/.test(lines[i]))
            paragraph.push(lines[i++]);
        blocks.push(<p key={i}>{inline(paragraph.join("\n"))}</p>);
    }
    return <div className={css.messageText}>{blocks}</div>;
}
export default memo(MessageContent);
