"use client";

import React from "react";
import { useVimNavigation } from "@/hooks/useVimNavigation";
import { LinkHints } from "@/components/ui/LinkHints";
import { VimSearch } from "@/components/ui/VimSearch";

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
    setSearchQuery,
    submitSearch,
    setSearchOpen,
  } = useVimNavigation();

  return (
    <>
      {children}
      <LinkHints active={hintsVisible} hints={hints} buffer={hintBuffer} />
      <VimSearch
        open={searchOpen}
        query={searchQuery}
        onChange={setSearchQuery}
        onSubmit={submitSearch}
        onClose={() => setSearchOpen(false)}
        matchCount={matches.length}
        activeIndex={activeMatch}
      />
    </>
  );
}

