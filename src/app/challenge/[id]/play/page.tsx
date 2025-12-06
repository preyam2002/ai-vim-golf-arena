"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  RotateCcw,
  Flag,
  Trophy,
  CheckCircle2,
  XCircle,
  Timer,
  History,
} from "lucide-react";
import { DiffViewer } from "@/components/arena/diff-viewer";
import type { Challenge } from "@/lib/types";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimulatorEditor } from "@/components/arena/simulator-editor";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LocalScore {
  date: string;
  keystrokes: number;
  timeMs: number;
}

export default function ChallengePlayPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customChallenge, setCustomChallenge] = useState<Challenge | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<string>("");
  const [editorKey, setEditorKey] = useState(0); // Key to force reset editor
  const [activeTab, setActiveTab] = useState<
    "target" | "diff" | "history" | "leaderboard"
  >("target");
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "correct" | "incorrect" | "forfeited"
  >("idle");
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [keystrokeHistory, setKeystrokeHistory] = useState<string[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Forfeit Dialog state
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [showKeystrokesDialog, setShowKeystrokesDialog] = useState(false);

  // Diff View Mode
  // Local Leaderboard
  const [localScores, setLocalScores] = useState<LocalScore[]>([]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollLeft = historyRef.current.scrollWidth;
    }
  }, [keystrokeHistory]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isTimerRunning && startTime) {
      intervalId = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isTimerRunning, startTime]);

  useEffect(() => {
    if (id === "custom") {
      const dataParam = searchParams.get("data");
      if (dataParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(dataParam));
          setCustomChallenge({
            id: "custom",
            title: parsed.title || "Custom Challenge",
            description: "User-created custom challenge",
            startText: parsed.startText,
            targetText: parsed.targetText,
            bestHumanScore: 0,
          });
        } catch {
          setError("Failed to parse custom challenge data");
        }
      }
    }
  }, [id, searchParams]);

  // Load local scores
  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`vim-golf-scores-${id}`);
      if (saved) {
        try {
          const parsed: LocalScore[] = JSON.parse(saved);
          const sorted = [...parsed].sort((a, b) => {
            if (a.keystrokes !== b.keystrokes) {
              return a.keystrokes - b.keystrokes;
            }
            return a.timeMs - b.timeMs;
          });
          setLocalScores(sorted);
        } catch (e) {
          console.error("Failed to load local scores", e);
        }
      }
    }
  }, [id]);

  const { data, isLoading } = useSWR<{ challenge: Challenge }>(
    id !== "custom" ? `/api/challenge?id=${id}` : null,
    fetcher
  );

  const challenge = id === "custom" ? customChallenge : data?.challenge;

  useEffect(() => {
    if (
      id === "random" &&
      !isLoading &&
      challenge?.id &&
      challenge.id !== "random"
    ) {
      router.replace(`/challenge/${challenge.id}/play`);
    }
  }, [id, isLoading, challenge?.id, router]);

  const handleReset = () => {
    setEditorKey((prev) => prev + 1);
    setSubmissionStatus("idle");
    setActiveTab("target");
    setKeystrokeCount(0);
    setKeystrokeHistory([]);
    setStartTime(null);
    setElapsedTime(0);
    setIsTimerRunning(false);
    toast.info("Editor reset to start text");
  };

  const handleSubmit = () => {
    setActiveTab("diff");
    if ((window as any).vimSubmit) {
      (window as any).vimSubmit();
    }
  };

  const handleKeystroke = (count: number, key: string) => {
    if (!isTimerRunning && submissionStatus === "idle") {
      setStartTime(Date.now());
      setIsTimerRunning(true);
    }
    setKeystrokeCount(count);
    setKeystrokeHistory((prev) => [...prev, key]);
  };

  const saveScore = (timeMs: number, keystrokes: number) => {
    const newScore: LocalScore = {
      date: new Date().toISOString(),
      timeMs,
      keystrokes,
    };
    const updatedScores = [...localScores, newScore]
      .sort((a, b) => {
        if (a.keystrokes !== b.keystrokes) return a.keystrokes - b.keystrokes;
        return a.timeMs - b.timeMs;
      })
      .slice(0, 10); // Keep top 10

    setLocalScores(updatedScores);
    localStorage.setItem(
      `vim-golf-scores-${id}`,
      JSON.stringify(updatedScores)
    );
  };

  const handleFinish = (text: string) => {
    if (!challenge) return;

    setIsTimerRunning(false);

    const normalizedSubmission = text.trim();
    const normalizedTarget = challenge.targetText.trim();

    if (normalizedSubmission === normalizedTarget) {
      setSubmissionStatus("correct");
      setActiveTab("leaderboard");
      saveScore(elapsedTime, keystrokeCount);
      toast.success("Challenge Completed!", {
        description: "You matched the target text perfectly.",
        icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      });
    } else {
      setLastSubmission(normalizedSubmission);
      setSubmissionStatus("incorrect");
      setActiveTab("diff");
      toast.error("Incorrect Submission", {
        description: "Your text doesn't match the target. Check the diff.",
      });
    }
  };

  const handleForfeit = () => {
    setSubmissionStatus("forfeited");
    setIsTimerRunning(false);
    setShowForfeitDialog(false);
    setActiveTab("target");
    toast.info("Challenge Forfeited", {
      description: "The target text is shown below.",
    });
  };

  const handleClearScores = () => {
    setLocalScores([]);
    localStorage.removeItem(`vim-golf-scores-${id}`);
    toast.success("Local leaderboard cleared");
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds}`;
  };

  if (id !== "custom" && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Loading challenge...</span>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Challenge not found
          </h1>
          <Link
            href={`/challenge/${id}`}
            className="mt-4 inline-block text-primary hover:underline"
          >
            Back to challenge
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/challenge/${id}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold leading-tight">
                  {challenge.title}
                </h1>
                {submissionStatus === "correct" && (
                  <Badge
                    variant="default"
                    className="bg-sky-500/15 text-sky-200 hover:bg-sky-500/25 border-sky-500/25"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Completed
                  </Badge>
                )}
                {submissionStatus === "incorrect" && (
                  <Badge
                    variant="destructive"
                    className="bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border-rose-500/20"
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Incorrect
                  </Badge>
                )}
                {submissionStatus === "forfeited" && (
                  <Badge
                    variant="secondary"
                    className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25 border-yellow-500/20"
                  >
                    <Flag className="mr-1 h-3 w-3" />
                    Forfeited
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {challenge.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-4 flex items-center gap-3">
              {/* Timer */}
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-all duration-300 ${
                  isTimerRunning
                    ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/10"
                    : "bg-muted/50 border-border"
                }`}
              >
                <Timer
                  className={`h-4 w-4 ${
                    isTimerRunning
                      ? "text-primary animate-pulse"
                      : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`font-mono font-bold tabular-nums ${
                    isTimerRunning ? "text-primary" : "text-foreground"
                  }`}
                >
                  {formatTime(elapsedTime)}
                </span>
              </div>
              {/* Keystroke Counter */}
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-all duration-300 ${
                  keystrokeCount > 0
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-muted/50 border-border"
                }`}
              >
                <svg
                  className={`h-4 w-4 ${
                    keystrokeCount > 0
                      ? "text-emerald-500"
                      : "text-muted-foreground"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                  />
                </svg>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    keystrokeCount > 0 ? "text-emerald-500" : "text-foreground"
                  }`}
                >
                  {keystrokeCount}
                </span>
                <span className="text-xs text-muted-foreground">keys</span>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmit}
              className="gap-2"
              title="Submit with :w"
              disabled={submissionStatus === "forfeited"}
            >
              Submit (:w)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setShowKeystrokesDialog(true)}
            >
              <History className="h-4 w-4" />
              All Keystrokes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>

            <Dialog
              open={showForfeitDialog}
              onOpenChange={setShowForfeitDialog}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={
                    submissionStatus === "correct" ||
                    submissionStatus === "forfeited"
                  }
                >
                  <Flag className="h-4 w-4" />
                  Forfeit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Forfeit Challenge?</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to forfeit? This will mark the
                    challenge as failed and reveal the target text.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={handleForfeit}>
                    Yes, Forfeit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={showKeystrokesDialog}
              onOpenChange={setShowKeystrokesDialog}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Full Keystroke History</DialogTitle>
                  <DialogDescription>
                    View every key you have pressed in this session.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total: {keystrokeHistory.length} keys</span>
                  {keystrokeHistory.length > 0 && (
                    <span>
                      Latest: {keystrokeHistory[keystrokeHistory.length - 1]}
                    </span>
                  )}
                </div>
                <ScrollArea className="mt-3 max-h-[50vh] rounded border border-border bg-muted/30 p-3">
                  {keystrokeHistory.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      No keystrokes yet.
                    </div>
                  ) : (
                    <ol className="space-y-1 text-sm font-mono">
                      {keystrokeHistory.map((key, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="w-10 text-right text-muted-foreground">
                            {i + 1}.
                          </span>
                          <kbd className="rounded bg-background px-2 py-0.5 text-xs border border-border">
                            {key === " " ? "␣" : key}
                          </kbd>
                        </li>
                      ))}
                    </ol>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Target/Diff/History/Leaderboard Pane */}
          <ResizablePanel
            defaultSize={40}
            minSize={20}
            className="bg-muted/10 min-w-0 flex flex-col"
          >
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex h-9 items-center justify-between border-b border-border bg-muted/50 px-4 shrink-0 gap-3">
                <TabsList className="h-8">
                  <TabsTrigger value="target" className="text-xs">
                    Target
                  </TabsTrigger>
                  <TabsTrigger
                    value="diff"
                    className="text-xs"
                    disabled={submissionStatus === "idle"}
                  >
                    Diff
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="leaderboard" className="text-xs">
                    Leaderboard
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden min-h-0 relative">
                <TabsContent
                  value="target"
                  className="h-full m-0 p-4 overflow-auto data-[state=active]:block hidden"
                >
                  <pre className="font-mono text-sm whitespace-pre-wrap wrap-break-word">
                    {challenge.targetText}
                  </pre>
                </TabsContent>
                <TabsContent
                  value="diff"
                  className="h-full m-0 p-4 overflow-auto data-[state=active]:block hidden"
                >
                  {submissionStatus !== "idle" && (
                    <DiffViewer
                      expected={challenge.targetText}
                      actual={lastSubmission}
                      className="border-0 bg-transparent p-0"
                      viewMode="split"
                    />
                  )}
                </TabsContent>
                <TabsContent
                  value="history"
                  className="h-full m-0 p-0 overflow-hidden data-[state=active]:flex hidden flex-col"
                >
                  <div className="p-4 border-b border-border bg-muted/20">
                    <div className="text-sm font-medium text-muted-foreground">
                      Keystroke History
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total: {keystrokeCount} keys
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {keystrokeHistory.map((key, i) => (
                        <kbd
                          key={i}
                          className="rounded bg-background px-2 py-1 text-xs font-mono border border-border text-center"
                        >
                          {key === " " ? "␣" : key}
                        </kbd>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent
                  value="leaderboard"
                  className="h-full m-0 p-4 overflow-auto data-[state=active]:block hidden"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          Local Leaderboard
                        </h3>
                        <Badge variant="outline">Top 10</Badge>
                      </div>
                      {localScores.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleClearScores}
                          className="text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {localScores.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No completed runs yet.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Keys</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {localScores.map((score, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(score.date).toLocaleDateString()}{" "}
                                {new Date(score.date).toLocaleTimeString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {score.keystrokes}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatTime(score.timeMs)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle className="w-2 bg-border/50 hover:bg-primary/50 transition-colors" />

          {/* Editor Pane */}
          <ResizablePanel defaultSize={60} minSize={30} className="min-w-0">
            <div className="flex h-full flex-col min-w-0">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 shrink-0">
                <span className="font-medium text-foreground text-sm uppercase tracking-wider">
                  Vim Editor
                </span>
                <div
                  ref={historyRef}
                  className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade justify-end"
                  style={{
                    maskImage:
                      "linear-gradient(to right, transparent, black 12%, black)",
                  }}
                >
                  {keystrokeHistory.slice(-10).map((key, i) => (
                    <kbd
                      key={i}
                      className="rounded bg-background px-1.5 py-0.5 text-xs font-mono border border-border whitespace-nowrap"
                    >
                      {key === " " ? "Space" : key}
                    </kbd>
                  ))}
                </div>
              </div>
              <div className="flex-1 relative bg-black min-h-0 min-w-0">
                <SimulatorEditor
                  key={editorKey}
                  startText={challenge.startText}
                  onFinish={handleFinish}
                  onKeystroke={handleKeystroke}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
