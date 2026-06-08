"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type DraggableTarget = {
  key: string;
  label: string;
  selector: string;
  defaultX: (width: number, height: number) => number;
  defaultY: (width: number, height: number) => number;
};

const TARGETS: DraggableTarget[] = [
  {
    key: "client-email-center",
    label: "Drag Client Email Center",
    selector: '[data-slice-floating="client-email-center"]',
    defaultX: () => 20,
    defaultY: (_width, height) => Math.max(20, window.innerHeight - height - 20),
  },
  {
    key: "ai-studio",
    label: "Drag AI Studio",
    selector: '[data-slice-floating="ai-studio"]',
    defaultX: (width) => Math.max(20, window.innerWidth - width - 20),
    defaultY: (_width, height) => Math.max(20, window.innerHeight - height - 20),
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStoredPosition(key: string) {
  try {
    const raw = window.localStorage.getItem(`slice-floating-position:${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    const x = safeNumber(parsed.x);
    const y = safeNumber(parsed.y);

    if (x === null || y === null) return null;

    return { x, y };
  } catch {
    return null;
  }
}

function saveStoredPosition(key: string, x: number, y: number) {
  try {
    window.localStorage.setItem(
      `slice-floating-position:${key}`,
      JSON.stringify({
        x: Math.round(x),
        y: Math.round(y),
      })
    );
  } catch {
    // Ignore storage failures so dragging still works in private browsing modes.
  }
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      'a, button, input, textarea, select, option, label, [role="button"], [contenteditable="true"]'
    )
  );
}

function findTargetByText(fallbackText: string) {
  const fixedElements = Array.from(
    document.querySelectorAll<HTMLElement>("body *")
  ).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.position === "fixed" && element.textContent?.includes(fallbackText);
  });

  return (
    fixedElements.sort((a, b) => {
      const aArea = a.offsetWidth * a.offsetHeight;
      const bArea = b.offsetWidth * b.offsetHeight;
      return bArea - aArea;
    })[0] ?? null
  );
}

function getTargetElement(target: DraggableTarget) {
  const explicit = document.querySelector<HTMLElement>(target.selector);
  if (explicit) return explicit;

  if (target.key === "client-email-center") {
    return findTargetByText("Client Email Center");
  }

  return findTargetByText("Studio") ?? findTargetByText("Slice AI");
}

function ensureHandle(element: HTMLElement, label: string) {
  const existing = element.querySelector<HTMLElement>(
    '[data-slice-drag-handle="true"]'
  );

  if (existing) return existing;

  const handle = document.createElement("div");
  handle.dataset.sliceDragHandle = "true";
  handle.textContent = label;
  handle.setAttribute("aria-label", label);
  handle.setAttribute("role", "button");
  handle.tabIndex = 0;
  handle.className = [
    "slice-floating-drag-handle",
    "select-none",
    "border-b",
    "border-white/10",
    "bg-white/[0.06]",
    "px-4",
    "py-2",
    "text-[10px]",
    "font-black",
    "uppercase",
    "tracking-[0.18em]",
    "text-slate-300",
    "cursor-move",
  ].join(" ");

  const firstChild = element.firstElementChild;

  if (firstChild) {
    element.insertBefore(handle, firstChild);
  } else {
    element.appendChild(handle);
  }

  return handle;
}

function applyFloatingPosition(
  element: HTMLElement,
  target: DraggableTarget,
  requested?: { x: number; y: number } | null
) {
  const rect = element.getBoundingClientRect();
  const width = rect.width || element.offsetWidth || 360;
  const height = rect.height || element.offsetHeight || 180;
  const stored = requested ?? readStoredPosition(target.key);

  const x = stored?.x ?? target.defaultX(width, height);
  const y = stored?.y ?? target.defaultY(width, height);
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);

  element.style.position = "fixed";
  element.style.left = `${clamp(x, 12, maxX)}px`;
  element.style.top = `${clamp(y, 12, maxY)}px`;
  element.style.right = "auto";
  element.style.bottom = "auto";
  element.style.zIndex = target.key === "ai-studio" ? "9999" : "9998";
  element.style.touchAction = "none";
}

function makeDraggable(target: DraggableTarget) {
  const element = getTargetElement(target);

  if (!element || element.dataset.sliceDraggableReady === "true") return;

  element.dataset.sliceDraggableReady = "true";
  element.dataset.sliceFloating = target.key;

  applyFloatingPosition(element, target);

  const handle = ensureHandle(element, target.label);

  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let dragging = false;

  const startDrag = (event: PointerEvent) => {
    if (isInteractiveElement(event.target) && event.target !== handle) return;

    dragging = true;
    startX = event.clientX;
    startY = event.clientY;

    const rect = element.getBoundingClientRect();
    originX = rect.left;
    originY = rect.top;

    element.setPointerCapture?.(event.pointerId);
    element.style.transition = "none";
    event.preventDefault();
  };

  const drag = (event: PointerEvent) => {
    if (!dragging) return;

    const rect = element.getBoundingClientRect();
    const nextX = originX + event.clientX - startX;
    const nextY = originY + event.clientY - startY;
    const maxX = Math.max(12, window.innerWidth - rect.width - 12);
    const maxY = Math.max(12, window.innerHeight - rect.height - 12);
    const x = clamp(nextX, 12, maxX);
    const y = clamp(nextY, 12, maxY);

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;

    dragging = false;

    const rect = element.getBoundingClientRect();
    saveStoredPosition(target.key, rect.left, rect.top);

    element.releasePointerCapture?.(event.pointerId);
  };

  handle.addEventListener("pointerdown", startDrag);
  element.addEventListener("pointermove", drag);
  element.addEventListener("pointerup", endDrag);
  element.addEventListener("pointercancel", endDrag);

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset";
  reset.className =
    "ml-3 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black text-white hover:bg-white/10";
  reset.addEventListener("click", (event) => {
    event.stopPropagation();
    window.localStorage.removeItem(`slice-floating-position:${target.key}`);
    applyFloatingPosition(element, target, null);
  });

  handle.appendChild(reset);
}

export default function WorkspaceDraggableOverlays() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/workspace") return;

    const apply = () => {
      TARGETS.forEach(makeDraggable);
    };

    apply();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(apply);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const onResize = () => {
      for (const target of TARGETS) {
        const element = getTargetElement(target);
        if (element) {
          applyFloatingPosition(element, target, readStoredPosition(target.key));
        }
      }
    };

    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [pathname]);

  return null;
}