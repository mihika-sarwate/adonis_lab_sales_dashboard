import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Assistant · Sales Performance" }] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What is my achievement?",
  "How much more sales do I need?",
  "Who is below 80% achievement?",
  "Show team ranking.",
];

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { question } });
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed.";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)] md:h-[calc(100dvh-12rem)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-9 rounded-xl brand-gradient grid place-items-center text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Performance Assistant</h1>
          <p className="text-xs text-muted-foreground">Ask about your sales, targets, and team.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto kpi-card p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-secondary hover:bg-accent transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={[
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary",
              ].join(" ")}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-3.5 py-2 text-sm flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          placeholder="Ask anything about your performance…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
