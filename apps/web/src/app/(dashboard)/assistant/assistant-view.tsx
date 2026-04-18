"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, CornerDownLeft, Sparkles, UserRound } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { Textarea } from "@se-project/ui/components/textarea";
import { Badge } from "@se-project/ui/components/badge";
import { PageHeader } from "@/components/shared/page-header";
import { orpc } from "@/utils/orpc";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  navigationPath?: string;
  success?: boolean;
};

const promptExamples = [
  "help",
  "show dashboard summary",
  "create event name=Launch Party, start=2026-05-14T18:00, end=2026-05-14T22:00, location=Sky Hall, client=Acme",
  "add vendor name=Star Catering, type=food, phone=9876543210",
  "add equipment name=Wireless Mic, category=Microphones, purchaseCost=450000",
  "record payment invoice=INV-12345, amount=150000, type=customer_payment, method=upi",
];

export function AssistantView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "I can answer general project queries and execute manual operations through commands. Type 'help' for command format.",
      intent: "help",
      success: true,
    },
  ]);

  const sendMessage = useMutation(orpc.chat.respond.mutationOptions());

  const canSend = input.trim().length > 0 && !sendMessage.isPending;

  const orderedMessages = useMemo(() => messages, [messages]);

  const onSubmit = async () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");

    try {
      const response = await sendMessage.mutateAsync({ message: text });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.reply,
          intent: response.intent,
          navigationPath: response.navigationPath,
          success: response.success,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "Failed to process your request",
          intent: "unknown",
          success: false,
        },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Operations Assistant"
        description="Use natural language and commands to complete operations quickly."
      />

      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Command-Aware Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {promptExamples.map((example) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal text-left text-xs"
                onClick={() => setInput(example)}
              >
                {example}
              </Button>
            ))}
          </div>

          <div className="max-h-[460px] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/30 p-3">
            {orderedMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                    {message.role === "user" ? (
                      <>
                        <UserRound className="size-3.5" />
                        You
                      </>
                    ) : (
                      <>
                        <Bot className="size-3.5" />
                        Assistant
                      </>
                    )}
                    {message.intent ? <Badge variant="secondary">{message.intent}</Badge> : null}
                    {message.success === false ? <Badge variant="destructive">failed</Badge> : null}
                  </div>

                  <p>{message.text}</p>

                  {message.navigationPath ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        render={<a href={message.navigationPath} />}
                      >
                        Open related page
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              rows={4}
              placeholder="Ask a question or type a command..."
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tip: Press Ctrl/Cmd + Enter to send.
              </p>
              <Button type="button" onClick={() => void onSubmit()} disabled={!canSend}>
                <CornerDownLeft className="mr-2 size-4" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
