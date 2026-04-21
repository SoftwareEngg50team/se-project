"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, CornerDownLeft, Mic, MicOff, Sparkles, UserRound, X, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@se-project/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { Textarea } from "@se-project/ui/components/textarea";
import { Badge } from "@se-project/ui/components/badge";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { PageHeader } from "@/components/shared/page-header";
import { orpc } from "@/utils/orpc";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  navigationPath?: string;
  success?: boolean;
};

type AssistantCommand = {
  action: "create_event" | "add_vendor" | "record_payment" | "create_invoice";
  data: Record<string, unknown>;
};

type ParsedAssistantResponse = {
  action: "CREATE_EVENT" | "ADD_VENDOR" | "RECORD_PAYMENT" | "CREATE_INVOICE" | "UNKNOWN";
  is_complete: boolean;
  payload: Record<string, unknown>;
  missing_fields: string[];
  reply_to_user: string;
  command?: AssistantCommand | null;
  model?: string;
  warning?: string;
};

const promptExamples = [
  "kal Delhi me Rahul ke liye event bana do",
  "vendor add karo catering wala",
  "payment record karo 5000 ka",
  "invoice generate karo 20000 ka",
];

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return "";
}

function parseDateKeyword(value: string): string {
  const now = new Date();
  const normalized = value.trim().toLowerCase();
  const base = new Date(now);

  if (normalized.includes("kal") || normalized.includes("tomorrow")) {
    base.setDate(base.getDate() + 1);
  } else if (normalized.includes("parso")) {
    base.setDate(base.getDate() + 2);
  }

  return base.toISOString();
}

async function parseAssistantCommand(text: string): Promise<ParsedAssistantResponse> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to interpret command");
  }

  return (await response.json()) as ParsedAssistantResponse;
}

function inferExecutionSummary(command: AssistantCommand): string {
  return `${command.action}: ${JSON.stringify(command.data, null, 2)}`;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function convertPlanToCommand(response: ParsedAssistantResponse): AssistantCommand | null {
  if (response.command?.action) return response.command;

  if (response.action === "CREATE_EVENT") {
    return { action: "create_event", data: response.payload };
  }

  if (response.action === "ADD_VENDOR") {
    return { action: "add_vendor", data: response.payload };
  }

  if (response.action === "RECORD_PAYMENT") {
    return { action: "record_payment", data: response.payload };
  }

  if (response.action === "CREATE_INVOICE") {
    return { action: "create_invoice", data: response.payload };
  }

  return null;
}

export function AssistantView() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Use the microphone or type a command in Hindi, English, or Hinglish. I will interpret it, show you the structured action, and only execute after confirmation.",
      intent: "voice_assistant",
      success: true,
    },
  ]);
  const [parsedCommand, setParsedCommand] = useState<AssistantCommand | null>(null);
  const [parsedPlan, setParsedPlan] = useState<ParsedAssistantResponse | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; speechText: string; action: string }>>([]);

  const sendMessage = useMutation(orpc.chat.respond.mutationOptions());
  const createEvent = useMutation(orpc.events.create.mutationOptions());
  const addVendor = useMutation(orpc.vendors.create.mutationOptions());
  const recordPayment = useMutation(orpc.payments.recordPayment.mutationOptions());
  const createInvoice = useMutation(orpc.invoices.create.mutationOptions());

  const speech = useSpeechRecognition({ lang: "hi-IN", continuous: true, interimResults: true });

  const canSend = input.trim().length > 0 && !processing;
  const orderedMessages = useMemo(() => messages, [messages]);

  const appendAssistantMessage = (text: string, options: Partial<Message> = {}) => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        ...options,
      },
    ]);
  };

  const appendUserMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        text,
      },
    ]);
  };

  const normalizeCommandData = (command: AssistantCommand): AssistantCommand => {
    const data = { ...command.data };

    if (command.action === "create_event") {
      if (typeof data.startDate === "string") data.startDate = parseDateKeyword(data.startDate);
      if (typeof data.endDate === "string") data.endDate = parseDateKeyword(data.endDate);
      if (typeof data.totalRevenue === "string") data.totalRevenue = Number.parseInt(data.totalRevenue, 10);
    }

    if (command.action === "record_payment" || command.action === "create_invoice") {
      if (typeof data.amount === "string") data.amount = Number.parseInt(data.amount, 10);
      if (typeof data.paymentDate === "string") data.paymentDate = parseDateKeyword(data.paymentDate);
      if (typeof data.dueDate === "string") data.dueDate = parseDateKeyword(data.dueDate);
    }

    return { action: command.action, data };
  };

  const resolveFallbackEventId = async (): Promise<string> => {
    const result = await orpc.events.list.call({ page: 1, limit: 1 });
    const existing = result.events[0];
    if (existing?.id) return existing.id;

    const now = new Date();
    const created = await createEvent.mutateAsync({
      name: "Auto Event",
      startDate: now,
      endDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      location: "Delhi",
      clientName: "Walk-in Client",
      notes: "Auto-created by assistant for payment/invoice action",
    });
    return created.id;
  };

  const executeCommand = async (command: AssistantCommand) => {
    setProcessing(true);
    try {
      if (command.action === "create_event") {
        const payload = {
          name: String(command.data.name ?? command.data.eventName ?? "Voice Created Event"),
          startDate: new Date(String(command.data.startDate ?? parseDateKeyword("kal"))),
          endDate: new Date(String(command.data.endDate ?? parseDateKeyword("kal"))),
          location: String(command.data.location ?? command.data.city ?? "TBD"),
          clientName: String(command.data.clientName ?? command.data.client ?? "Client"),
          clientPhone: command.data.clientPhone ? String(command.data.clientPhone) : undefined,
          clientEmail: command.data.clientEmail ? String(command.data.clientEmail) : undefined,
          notes: command.data.notes ? String(command.data.notes) : undefined,
          totalRevenue: command.data.totalRevenue ? Number(command.data.totalRevenue) : undefined,
        };
        await createEvent.mutateAsync(payload);
      }

      if (command.action === "add_vendor") {
        const payload = {
          name: String(command.data.name ?? command.data.vendorName ?? "Voice Created Vendor"),
          type: (String(command.data.type ?? "other") as "food" | "transportation" | "repair" | "other"),
          phone: command.data.phone ? String(command.data.phone) : undefined,
          email: command.data.email ? String(command.data.email) : undefined,
        };
        await addVendor.mutateAsync(payload);
      }

      if (command.action === "record_payment") {
        const resolvedEventId = command.data.eventId && typeof command.data.eventId === "string" && isValidUuid(command.data.eventId)
          ? command.data.eventId
          : await resolveFallbackEventId();

        const payload = {
          eventId: String(resolvedEventId),
          amount: Math.max(1, Number(command.data.amount ?? 1000)),
          paymentDate: new Date(String(command.data.paymentDate ?? new Date().toISOString())),
          paymentMethod: command.data.paymentMethod ? String(command.data.paymentMethod) : undefined,
          type: (String(command.data.type ?? "customer_payment") as "customer_advance" | "customer_payment" | "vendor_payment"),
          notes: command.data.notes ? String(command.data.notes) : undefined,
          invoiceId: command.data.invoiceId ? String(command.data.invoiceId) : undefined,
          vendorId: command.data.vendorId ? String(command.data.vendorId) : undefined,
        };
        await recordPayment.mutateAsync(payload);
      }

      if (command.action === "create_invoice") {
        const resolvedEventId = command.data.eventId && typeof command.data.eventId === "string" && isValidUuid(command.data.eventId)
          ? command.data.eventId
          : await resolveFallbackEventId();
        const amount = Math.max(1, Number(command.data.amount ?? 5000));
        const payload = {
          eventId: String(resolvedEventId),
          amount,
          dueDate: new Date(String(command.data.dueDate ?? parseDateKeyword("kal"))),
        };
        await createInvoice.mutateAsync(payload);
      }

      await queryClient.invalidateQueries();
      appendAssistantMessage("Command executed successfully.", {
        intent: command.action,
        success: true,
      });
      setHistory((current) => [
        { id: crypto.randomUUID(), speechText: pendingText || input, action: command.action },
        ...current,
      ]);
      setParsedCommand(null);
      setPendingText("");
    } catch (error) {
      appendAssistantMessage(error instanceof Error ? error.message : "Failed to execute command", {
        intent: command.action,
        success: false,
      });
      toast.error(error instanceof Error ? error.message : "Failed to execute command");
    } finally {
      setProcessing(false);
    }
  };

  const onSubmit = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || processing) return;

    appendUserMessage(text);
    if (!overrideText) {
      setInput("");
    }
    setProcessing(true);

    try {
      const response = await parseAssistantCommand(text);
      setParsedPlan(response);

      const command = convertPlanToCommand(response);
      if (command) {
        const normalized = normalizeCommandData(command);
        setParsedCommand(normalized);
        setPendingText(text);
      } else {
        setParsedCommand(null);
      }

      appendAssistantMessage(response.reply_to_user, {
        intent: response.action,
        success: response.is_complete,
      });

      if (response.warning) {
        appendAssistantMessage(`Note: ${response.warning}`, {
          intent: "warning",
          success: false,
        });
      }
    } catch (error) {
      appendAssistantMessage(error instanceof Error ? error.message : "Failed to interpret your request", {
        intent: "parse_error",
        success: false,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedCommand) return;
    await executeCommand(parsedCommand);
  };

  const handleCancel = () => {
    setParsedCommand(null);
    setParsedPlan(null);
    setPendingText("");
    appendAssistantMessage("Cancelled. You can try another command.", {
      intent: "cancelled",
      success: true,
    });
  };

  const handleVoiceToggle = () => {
    if (speech.isListening) {
      speech.stop();
      const finalText = `${speech.finalTranscript} ${speech.liveTranscript}`.trim();
      if (finalText) {
        setInput(finalText);
        setPendingText(finalText);
      }
      return;
    }

    speech.reset();
    speech.start();
  };

  const useTranscript = () => {
    const finalText = `${speech.finalTranscript} ${speech.liveTranscript}`.trim();
    if (finalText) {
      setInput(finalText);
      setPendingText(finalText);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Operations Assistant"
        description="Speak or type in Hindi, English, or Hinglish. The assistant will interpret, confirm, and then execute real actions."
      >
        <Button type="button" variant="outline" onClick={handleVoiceToggle} disabled={!speech.isSupported && !speech.isListening}>
          {speech.isListening ? <MicOff className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}
          {speech.isListening ? "Stop listening" : "Start microphone"}
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Voice + Command Chat
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
                  onClick={() => void onSubmit(example)}
                >
                  {example}
                </Button>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Live transcript</span>
                <div className="flex items-center gap-2">
                  <Badge variant={speech.isListening ? "default" : "secondary"}>
                    {speech.isListening ? "listening" : "idle"}
                  </Badge>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={useTranscript}>
                    Use transcript
                  </Button>
                </div>
              </div>
              <p className="min-h-[56px] text-sm text-foreground">
                {speech.liveTranscript || speech.finalTranscript || "Speak in Hindi, English, or Hinglish..."}
              </p>
              {speech.error && <p className="mt-2 text-xs text-red-500">{speech.error}</p>}
              {!speech.isSupported && <p className="mt-2 text-xs text-amber-500">Speech recognition is not supported in this browser.</p>}
            </div>

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
              placeholder="Ask the assistant or use the microphone..."
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Ctrl/Cmd + Enter sends text.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setInput("")}>Clear</Button>
                <Button type="button" onClick={() => void onSubmit()} disabled={!canSend}>
                  <CornerDownLeft className="mr-2 size-4" />
                  {processing ? "Processing..." : "Send"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Interpreted Command</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsedPlan || parsedCommand ? (
                <>
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Badge>{parsedPlan?.action ?? parsedCommand?.action ?? "UNKNOWN"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {parsedPlan?.is_complete ? "Awaiting confirmation" : "Needs more details"}
                      </span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-xs leading-6">
{JSON.stringify(parsedPlan?.payload ?? parsedCommand?.data ?? {}, null, 2)}
                    </pre>
                    {parsedPlan && parsedPlan.missing_fields.length > 0 && (
                      <p className="text-xs text-amber-600">Missing: {parsedPlan.missing_fields.join(", ")}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleConfirm} disabled={processing || !parsedCommand} className="flex-1">
                      <CheckCheck className="mr-2 size-4" />
                      {processing ? "Executing..." : "Confirm"}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} className="flex-1">
                      <X className="mr-2 size-4" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No pending command. Speak or type a request to preview the structured action.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Command History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Executed commands will appear here.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.action}</p>
                    <p className="mt-1 text-sm">{item.speechText}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supported Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Create event</p>
              <p>Add vendor</p>
              <p>Record payment</p>
              <p>Create invoice</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
