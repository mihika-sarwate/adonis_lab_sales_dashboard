import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Assistant · Pharmaceutical Sales Portal" }] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What is my achievement?",
  "How much sales do I need to reach target?",
  "Show employees below 80% achievement.",
  "Show team ranking.",
  "Which state is performing best?",
  "What is company achievement?",
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

  async function send(questionText: string) {
    const question = questionText.trim();
    if (!question || busy) return;
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const response = await ask({ data: { question } });
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load an answer.";
      setMessages((current) => [...current, { role: "assistant", content: `Warning: ${message}` }]);
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
          <p className="text-xs text-muted-foreground">
            Ask about your sales, targets, hierarchy, or rankings.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto kpi-card p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-secondary hover:bg-accent transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={[
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary",
              ].join(" ")}
            >
              {message.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-3.5 py-2 text-sm flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Input
          placeholder="Ask anything about performance..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
