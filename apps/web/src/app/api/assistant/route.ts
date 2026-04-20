import { NextResponse } from "next/server";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"] as const;

type AssistantAction = "create_event" | "add_vendor" | "record_payment" | "create_invoice";

type AssistantCommand = {
  action: AssistantAction;
  data: Record<string, unknown>;
};

function parseAmount(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseDateToken(text: string): string | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("aaj") || normalized.includes("today")) return "today";
  if (normalized.includes("kal") || normalized.includes("tomorrow")) return "tomorrow";
  if (normalized.includes("parso") || normalized.includes("day after tomorrow")) return "day_after_tomorrow";
  return undefined;
}

function parseRuleBasedCommand(input: string): AssistantCommand | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("invoice") || normalized.includes("bill")) {
    const amount = parseAmount(normalized);
    return {
      action: "create_invoice",
      data: {
        amount,
        dueDate: parseDateToken(normalized),
      },
    };
  }

  if (normalized.includes("payment") || normalized.includes("paid") || normalized.includes("record payment")) {
    const amount = parseAmount(normalized);
    return {
      action: "record_payment",
      data: {
        amount,
        paymentDate: parseDateToken(normalized),
      },
    };
  }

  if (normalized.includes("vendor") || normalized.includes("supplier")) {
    const nameMatch = input.match(/(?:vendor|supplier)\s+(?:named\s+)?([a-zA-Z0-9\s&.-]+)/i);
    return {
      action: "add_vendor",
      data: {
        name: nameMatch?.[1]?.trim() || "Voice Created Vendor",
      },
    };
  }

  if (normalized.includes("event") || normalized.includes("function") || normalized.includes("program")) {
    const locationMatch = input.match(/(?:in|at)\s+([a-zA-Z\s.-]+)/i);
    return {
      action: "create_event",
      data: {
        name: "Voice Created Event",
        startDate: parseDateToken(normalized),
        endDate: parseDateToken(normalized),
        location: locationMatch?.[1]?.trim(),
      },
    };
  }

  return null;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function parseCommand(text: string): AssistantCommand {
  const normalized = extractJson(text);
  const parsed = JSON.parse(normalized) as AssistantCommand;

  if (!parsed || typeof parsed !== "object" || !parsed.action || typeof parsed.action !== "string") {
    throw new Error("Invalid assistant command payload");
  }

  return {
    action: parsed.action,
    data: parsed.data && typeof parsed.data === "object" ? parsed.data : {},
  };
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; model: string }> {
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  let lastError = "";

  for (const model of GEMINI_MODEL_FALLBACKS) {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = `${model} -> ${response.status} ${errorText}`;

      // Continue on 404 or permission-style errors to try fallback models.
      if (response.status === 404 || response.status === 400 || response.status === 403) {
        continue;
      }

      throw new Error(`Gemini request failed: ${lastError}`);
    }

    const result = (await response.json()) as GeminiGenerateResponse;
    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!textResult) {
      lastError = `${model} -> empty text response`;
      continue;
    }

    return { text: textResult, model };
  }

  throw new Error(`Gemini request failed for all fallback models: ${lastError || "No response"}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const prompt = [
      "Convert the following user input into structured JSON command for an event management system. User may speak Hindi, English, or mix. Extract intent and parameters.",
      "Return only valid JSON with shape: {\"action\":\"create_event\"|\"add_vendor\"|\"record_payment\"|\"create_invoice\",\"data\":{...}}.",
      "For dates, convert words like aaj, kal, parso into ISO date strings using the current date context if possible. If a value is missing, omit it.",
      `User input: ${text}`,
    ].join("\n\n");

    let command: AssistantCommand | null = null;
    let model: string | null = null;
    let warning: string | undefined;

    try {
      const geminiResult = await callGemini(prompt, apiKey);
      command = parseCommand(geminiResult.text);
      model = geminiResult.model;
    } catch (geminiError) {
      command = parseRuleBasedCommand(text);
      model = "rule_based_fallback";
      warning = geminiError instanceof Error ? geminiError.message : "Gemini unavailable, used fallback";
    }

    if (!command) {
      return NextResponse.json(
        { error: "Unable to understand command. Please provide a clearer instruction." },
        { status: 400 },
      );
    }

    return NextResponse.json({ command, model, warning });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse assistant command",
      },
      { status: 500 },
    );
  }
}
