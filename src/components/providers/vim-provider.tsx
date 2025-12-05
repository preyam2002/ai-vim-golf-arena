"use client";

import React from "react";
import { useVimNavigation } from "@/hooks/useVimNavigation";
import { LinkHints, MatchHints } from "@/components/ui/LinkHints";
import { VimSearch } from "@/components/ui/VimSearch";
import { VimTerminalBar } from "@/components/ui/VimTerminalBar";

type Props = {
  children: React.ReactNode;
};

export function VimProvider({ children }: Props) {
  const {
    hintsVisible,
    hints,
    hintBuffer,
    searchOpen,
    searchQuery,
    matches,
    activeMatch,
    matchHints,
    matchHintBuffer,
    matchHintsVisible,
    setSearchQuery,
    submitSearch,
    setSearchOpen,
  } = useVimNavigation();

  return (
    <>
      {children}
      <LinkHints active={hintsVisible} hints={hints} buffer={hintBuffer} />
      <MatchHints
        active={matchHintsVisible}
        hints={matchHints}
        buffer={matchHintBuffer}
      />
      <VimSearch
        open={searchOpen}
        query={searchQuery}
        onChange={setSearchQuery}
        onSubmit={submitSearch}
        onClose={() => setSearchOpen(false)}
        matchCount={matches.length}
        activeIndex={activeMatch}
      />
      <VimTerminalBar />
    </>
  );
}

