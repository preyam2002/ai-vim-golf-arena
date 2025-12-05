"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildCountPrefix, consumeCount, cycleIndex } from "@/lib/vim-page-utils";

type Hint = {
  key: string;
  x: number;
  y: number;
  target: HTMLElement;
};

const CLICKABLE_SELECTOR =
  'a[href], button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], [data-vim-clickable="true"]';

const LANDMARK_SELECTOR =
  "main, section, article, nav, aside, header, footer, [data-vim-section]";

const HINT_ALPHABET = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const editable =
    tag === "input" ||
    tag === "textarea" ||
    target.isContentEditable ||
    tag === "select";
  return editable || Boolean(target.getAttribute("data-vim-allow"));
}

function isClickable(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  return Boolean(el.matches(CLICKABLE_SELECTOR));
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getFocusable(): HTMLElement[] {
  const selector =
    'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [data-vim-focusable="true"]';
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && isVisible(el)
  );
}

function generateHintKeys(count: number): string[] {
  const keys: string[] = [];
  const alphabet = HINT_ALPHABET;
  let length = 1;
  while (keys.length < count) {
    const combos = Math.pow(alphabet.length, length);
    for (let i = 0; i < combos && keys.length < count; i += 1) {
      let n = i;
      let key = "";
      for (let j = 0; j < length; j += 1) {
        key = alphabet[n % alphabet.length] + key;
        n = Math.floor(n / alphabet.length);
      }
      keys.push(key);
    }
    length += 1;
  }
  return keys;
}

function getLandmarks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(LANDMARK_SELECTOR)).filter(
    (el) => isVisible(el)
  );
}

function scrollIntoViewCentered(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function getScrollableRoot(): HTMLElement | Window {
  if (document.scrollingElement) return document.scrollingElement;
  return window;
}

export function useVimNavigation() {
  const [hintsVisible, setHintsVisible] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [hintBuffer, setHintBuffer] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeMatch, setActiveMatch] = useState(-1);
  const [sneakArmed, setSneakArmed] = useState(false);
  const [sneakBuffer, setSneakBuffer] = useState("");
  const [matchHints, setMatchHints] = useState<Hint[]>([]);
  const [matchHintBuffer, setMatchHintBuffer] = useState("");
  const [matchHintsVisible, setMatchHintsVisible] = useState(false);
  const pathname = usePathname();

  const prefixRef = useRef("");
  const gPendingRef = useRef(false);
  const gTimerRef = useRef<number | null>(null);
  const highlightsRef = useRef<HTMLElement[]>([]);
  const hintsRef = useRef<Hint[]>([]);
  const sneakTimerRef = useRef<number | null>(null);
  const matchHintsRef = useRef<Hint[]>([]);

  const clearHighlights = useCallback(() => {
    highlightsRef.current.forEach((mark) => {
      const parent = mark.parentElement;
      const text = mark.textContent || "";
      if (parent) {
        parent.replaceChild(document.createTextNode(text), mark);
        parent.normalize();
      }
    });
    highlightsRef.current = [];
    setMatches([]);
    setActiveMatch(-1);
  }, []);

  const highlightQuery = useCallback(
    (query: string) => {
      clearHighlights();
      const trimmed = query.trim();
      if (!trimmed) return;
      const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      const found: HTMLElement[] = [];
      const limit = 120;

      const shouldSkip = (node: Node | null) => {
        if (!node || !(node instanceof HTMLElement)) return false;
        return Boolean(node.closest("[data-vim-ignore='true']"));
      };

      let node = walker.nextNode();
      while (node) {
        if (!shouldSkip(node.parentElement)) {
          textNodes.push(node as Text);
        }
        node = walker.nextNode();
      }

      for (const textNode of textNodes) {
        if (found.length >= limit) break;
        const parent = textNode.parentElement;
        if (!parent) continue;
        const text = textNode.nodeValue || "";
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        let replaced = false;
        const frag = document.createDocumentFragment();

        while ((match = regex.exec(text)) && found.length < limit) {
          const before = text.slice(lastIndex, match.index);
          if (before) frag.appendChild(document.createTextNode(before));
          const mark = document.createElement("mark");
          mark.className = "vim-search-highlight";
          mark.textContent = match[0];
          frag.appendChild(mark);
          found.push(mark);
          replaced = true;
          lastIndex = match.index + match[0].length;
        }

        if (replaced) {
          const after = text.slice(lastIndex);
          if (after) frag.appendChild(document.createTextNode(after));
          parent.replaceChild(frag, textNode);
        }
      }

      highlightsRef.current = found;
      setMatches(found);
      if (found.length > 0) {
        setActiveMatch(0);
        scrollIntoViewCentered(found[0]);
      } else {
        setActiveMatch(-1);
      }
    },
    [clearHighlights]
  );

  const closeHints = useCallback(() => {
    setHintsVisible(false);
    setHintBuffer("");
    hintsRef.current = [];
  }, []);

  const openHints = useCallback(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(CLICKABLE_SELECTOR)
    ).filter((el) => isVisible(el));
    if (candidates.length === 0) return;
    const keys = generateHintKeys(candidates.length);
    const nextHints: Hint[] = candidates.slice(0, keys.length).map((el, idx) => {
      const rect = el.getBoundingClientRect();
      return {
        key: keys[idx],
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        target: el,
      };
    });
    hintsRef.current = nextHints;
    setHints(nextHints);
    setHintsVisible(true);
    setHintBuffer("");
  }, []);

  const followHint = useCallback((hint: Hint) => {
    const target = hint.target;
    if (target instanceof HTMLAnchorElement && target.href) {
      target.click();
    } else {
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    }
  }, []);

  const resetGPending = useCallback(() => {
    gPendingRef.current = false;
    if (gTimerRef.current) {
      window.clearTimeout(gTimerRef.current);
      gTimerRef.current = null;
    }
  }, []);

  const handleSearchNavigation = useCallback(
    (delta: number) => {
      if (matches.length === 0) return;
      const next = cycleIndex(activeMatch === -1 ? 0 : activeMatch, delta, matches.length);
      setActiveMatch(next);
      const el = matches[next];
      if (el) scrollIntoViewCentered(el);
    },
    [activeMatch, matches]
  );

  const scrollByAmount = useCallback((x: number, y: number) => {
    const root = getScrollableRoot();
    if (root === window) {
      window.scrollBy({ left: x, top: y, behavior: "smooth" });
    } else {
      (root as HTMLElement).scrollBy({ left: x, top: y, behavior: "smooth" });
    }
  }, []);

  const scrollToPosition = useCallback((y: number) => {
    const root = getScrollableRoot();
    const behavior: ScrollBehavior = "smooth";
    if (root === window) {
      window.scrollTo({ top: y, behavior });
    } else {
      (root as HTMLElement).scrollTo({ top: y, behavior });
    }
  }, []);

  const handleLandmarkJump = useCallback((direction: 1 | -1, count: number) => {
    const landmarks = getLandmarks();
    if (!landmarks.length) return;
    const current = window.scrollY;
    const positions = landmarks.map((el) => ({
      el,
      top: el.getBoundingClientRect().top + window.scrollY,
    }));
    const filtered =
      direction === 1
        ? positions.filter((p) => p.top > current + 4)
        : positions.filter((p) => p.top < current - 4).reverse();
    if (!filtered.length) return;
    const targetIdx = Math.min(filtered.length - 1, count - 1);
    const target = filtered[targetIdx].el;
    if (target.tabIndex === -1) {
      // keep existing tabIndex for non-focusable elements
    } else if (target.tabIndex < 0) {
      target.tabIndex = -1;
    }
    target.focus({ preventScroll: true });
    scrollIntoViewCentered(target);
  }, []);

  const focusByDelta = useCallback((delta: number, count: number) => {
    const focusables = getFocusable();
    if (!focusables.length) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? focusables.indexOf(active) : -1;
    const next = Math.min(
      focusables.length - 1,
      Math.max(0, (idx === -1 ? 0 : idx) + delta * count)
    );
    const target = focusables[next];
    target.focus({ preventScroll: false });
    scrollIntoViewCentered(target);
  }, []);

  const flashRange = useCallback((range: Range) => {
    const mark = document.createElement("mark");
    mark.className = "vim-sneak-highlight";
    range.surroundContents(mark);
    window.setTimeout(() => {
      const parent = mark.parentElement;
      const text = mark.textContent || "";
      if (parent) {
        parent.replaceChild(document.createTextNode(text), mark);
        parent.normalize();
      }
    }, 900);
  }, []);

  const applySneak = useCallback(
    (pattern: string, count: number) => {
      if (!pattern || pattern.length < 2) return;
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const ranges: Range[] = [];
      const limit = 60;

      const shouldSkip = (node: Node | null) => {
        if (!node || !(node instanceof HTMLElement)) return false;
        return Boolean(node.closest("[data-vim-ignore='true']"));
      };

      let node = walker.nextNode();
      while (node && ranges.length < limit) {
        if (shouldSkip(node.parentElement)) {
          node = walker.nextNode();
          continue;
        }
        const text = node.nodeValue || "";
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) && ranges.length < limit) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + pattern.length);
          ranges.push(range);
        }
        node = walker.nextNode();
      }

      if (!ranges.length) return;
      const idx = Math.min(ranges.length - 1, count - 1);
      const targetRange = ranges[idx];
      const rect = targetRange.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      window.scrollTo({
        top: top - window.innerHeight * 0.3,
        left: left,
        behavior: "smooth",
      });
      flashRange(targetRange);
    },
    [flashRange]
  );

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey) return;

      if (isTypingTarget(event.target)) return;

      if (sneakArmed) {
        if (event.key === "Escape") {
          setSneakArmed(false);
          setSneakBuffer("");
          return;
        }
        if (event.key.length === 1) {
          const next = (sneakBuffer + event.key).slice(0, 2);
          setSneakBuffer(next);
          if (next.length === 2) {
            event.preventDefault();
            const count = consumeCount(prefixRef.current);
            prefixRef.current = "";
            applySneak(next, count);
            setSneakArmed(false);
            setSneakBuffer("");
          }
        }
        return;
      }

      // hint mode takes precedence
      if (hintsVisible) {
        if (event.key === "Escape") {
          closeHints();
          return;
        }
        if (/^[a-z0-9]$/i.test(event.key)) {
          const nextBuffer = (hintBuffer + event.key.toLowerCase()).slice(0, 3);
          setHintBuffer(nextBuffer);
          const possible = hintsRef.current.filter((h) =>
            h.key.startsWith(nextBuffer)
          );
          if (possible.length === 1 && possible[0].key === nextBuffer) {
            event.preventDefault();
            followHint(possible[0]);
            closeHints();
          } else if (possible.length === 0) {
            setHintBuffer("");
          }
          return;
        }
      }

      if (event.key === "Escape") {
        resetGPending();
        closeHints();
        setSearchOpen(false);
        clearHighlights();
        setSneakArmed(false);
        setSneakBuffer("");
        prefixRef.current = "";
        return;
      }

      if (event.key === "Enter" && !searchOpen && !hintsVisible) {
        const active = document.activeElement as HTMLElement | null;
        const center = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight / 2
        ) as HTMLElement | null;
        const target = isClickable(active) ? active : center && isClickable(center) ? center : null;
        if (target) {
          event.preventDefault();
          target.click();
          return;
        }
      }

      // search overlay request
      if (event.key === "/" && !searchOpen) {
        event.preventDefault();
        closeHints();
        setSearchOpen(true);
        setSearchQuery("");
        resetGPending();
        return;
      }

      // search navigation
      if (!isTypingTarget(event.target) && matches.length > 0) {
        if (event.key === "n") {
          event.preventDefault();
          handleSearchNavigation(1);
          resetGPending();
          return;
        }
        if (event.key === "N") {
          event.preventDefault();
          handleSearchNavigation(-1);
          resetGPending();
          return;
        }
      }

      if (searchOpen) return;

      // page navigation with counts
      if (event.ctrlKey && event.key === "f") {
        event.preventDefault();
        const count = consumeCount(prefixRef.current);
        prefixRef.current = "";
        scrollByAmount(0, window.innerHeight * count);
        resetGPending();
        return;
      }
      if (event.ctrlKey && event.key === "b") {
        event.preventDefault();
        const count = consumeCount(prefixRef.current);
        prefixRef.current = "";
        scrollByAmount(0, -window.innerHeight * count);
        resetGPending();
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        prefixRef.current = buildCountPrefix(prefixRef.current, event.key);
        return;
      }

      const count = consumeCount(prefixRef.current);
      prefixRef.current = "";

      switch (event.key) {
        case "j":
          event.preventDefault();
          focusByDelta(1, count);
          break;
        case "k":
          event.preventDefault();
          focusByDelta(-1, count);
          break;
        case "h":
          event.preventDefault();
          focusByDelta(-1, count);
          break;
        case "l":
          event.preventDefault();
          focusByDelta(1, count);
          break;
        case "d":
          event.preventDefault();
          scrollByAmount(0, (window.innerHeight / 2) * count);
          break;
        case "u":
          event.preventDefault();
          scrollByAmount(0, (-window.innerHeight / 2) * count);
          break;
        case "g":
          if (gPendingRef.current) {
            event.preventDefault();
            scrollToPosition(0);
            resetGPending();
          } else {
            gPendingRef.current = true;
            gTimerRef.current = window.setTimeout(resetGPending, 600);
          }
          break;
        case "G":
          event.preventDefault();
          scrollToPosition(Number.MAX_SAFE_INTEGER);
          resetGPending();
          break;
        case "w":
          event.preventDefault();
          handleLandmarkJump(1, count);
          resetGPending();
          break;
        case "b":
          event.preventDefault();
          handleLandmarkJump(-1, count);
          resetGPending();
          break;
        case "s":
          event.preventDefault();
          setSneakArmed(true);
          setSneakBuffer("");
          resetGPending();
          break;
        case "f":
          event.preventDefault();
          openHints();
          resetGPending();
          break;
        default:
          resetGPending();
      }
    },
    [
      clearHighlights,
      closeHints,
      followHint,
      handleLandmarkJump,
      handleSearchNavigation,
      hintBuffer,
      hintsVisible,
      matches.length,
      openHints,
      resetGPending,
      scrollByAmount,
      scrollToPosition,
      searchOpen,
      sneakArmed,
      sneakBuffer,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event: KeyboardEvent) => handleKeydown(event);
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [handleKeydown]);

  useEffect(() => {
    clearHighlights();
    closeHints();
    prefixRef.current = "";
  }, [pathname, clearHighlights, closeHints]);

  useEffect(
    () => () => {
      clearHighlights();
    },
    [clearHighlights]
  );

  const submitSearch = useCallback(
    (value?: string) => {
      const q = value ?? searchQuery;
      highlightQuery(q);
      setSearchOpen(false);
    },
    [highlightQuery, searchQuery]
  );

  const value = useMemo(
    () => ({
      hintsVisible,
      hints,
      hintBuffer,
      searchOpen,
      searchQuery,
      matches,
      activeMatch,
      setSearchQuery,
      submitSearch,
      setSearchOpen,
    }),
    [
      activeMatch,
      hintBuffer,
      hints,
      hintsVisible,
      matches,
      searchOpen,
      searchQuery,
      submitSearch,
    ]
  );

  return value;
}

