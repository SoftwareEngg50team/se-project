import { NextResponse } from "next/server";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"] as const;

type AssistantAction = "CREATE_EVENT" | "ADD_VENDOR" | "RECORD_PAYMENT" | "CREATE_INVOICE" | "UNKNOWN";

type AssistantPlan = {
  action: AssistantAction;
  is_complete: boolean;
  payload: Record<string, unknown>;
  missing_fields: string[];
  reply_to_user: string;
};

const REQUIRED_FIELDS: Record<Exclude<AssistantAction, "UNKNOWN">, string[]> = {
  CREATE_EVENT: ["name", "location", "clientName", "startDate"],
  ADD_VENDOR: ["name", "serviceCategory"],
  RECORD_PAYMENT: ["amount"],
  CREATE_INVOICE: ["amount"],
};

const ACTION_TO_LEGACY: Partial<Record<AssistantAction, "create_event" | "add_vendor" | "record_payment" | "create_invoice">> = {
  CREATE_EVENT: "create_event",
  ADD_VENDOR: "add_vendor",
  RECORD_PAYMENT: "record_payment",
  CREATE_INVOICE: "create_invoice",
};

function normalizeAction(raw: unknown): AssistantAction {
  if (typeof raw !== "string") return "UNKNOWN";
  const action = raw.trim().toUpperCase();

  if (
    action === "CREATE_EVENT"
    || action === "ADD_VENDOR"
    || action === "RECORD_PAYMENT"
    || action === "CREATE_INVOICE"
    || action === "UNKNOWN"
  ) {
    return action;
  }

  return "UNKNOWN";
}

function parseAmount(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function toIsoDate(baseDate: Date, addDays = 0): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + addDays);
  return date.toISOString();
}

function monthNameToIndex(month: string): number | null {
  const map: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  return map[month.toLowerCase()] ?? null;
}

function parseNaturalDate(text: string, now: Date): string | undefined {
  const normalized = text.toLowerCase();

  if (normalized.includes("aaj") || normalized.includes("today")) return toIsoDate(now, 0);
  if (normalized.includes("kal") || normalized.includes("tomorrow")) return toIsoDate(now, 1);
  if (normalized.includes("parso") || normalized.includes("day after tomorrow")) return toIsoDate(now, 2);

  const datePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)/;
  const dateMatch = normalized.match(datePattern);
  if (dateMatch) {
    const day = Number.parseInt(dateMatch[1], 10);
    const monthIndex = monthNameToIndex(dateMatch[2]);

    if (Number.isInteger(day) && day >= 1 && day <= 31 && monthIndex !== null) {
      const candidate = new Date(now.getFullYear(), monthIndex, day, now.getHours(), now.getMinutes(), 0, 0);
      if (candidate < now) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }
      return candidate.toISOString();
    }
  }

  return undefined;
}

function buildReply(action: AssistantAction, missingFields: string[]): string {
  if (action === "UNKNOWN") {
    return "Mujhe command clear nahi mila. Aap event, vendor, payment ya invoice ke liye thoda aur detail dein.";
  }

  if (missingFields.length > 0) {
    return `Samajh gaya. Is action ko complete karne ke liye ye details chahiye: ${missingFields.join(", ")}. Please share karein.`;
  }

  return "Perfect, command ready hai. Aap confirm karenge to main isey execute kar dunga.";
}

function finalizePlan(action: AssistantAction, payload: Record<string, unknown>): AssistantPlan {
  if (action === "UNKNOWN") {
    return {
      action,
      is_complete: false,
      payload,
      missing_fields: [],
      reply_to_user: buildReply(action, []),
    };
  }

  const required = REQUIRED_FIELDS[action];
  const missingFields = required.filter((key) => {
    const value = payload[key];
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    return false;
  });

  return {
    action,
    is_complete: missingFields.length === 0,
    payload,
    missing_fields: missingFields,
    reply_to_user: buildReply(action, missingFields),
  };
}

function parseRuleBasedPlan(input: string, now: Date): AssistantPlan {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return finalizePlan("UNKNOWN", {});

  if (normalized.includes("invoice") || normalized.includes("bill")) {
    return finalizePlan("CREATE_INVOICE", {
      amount: parseAmount(normalized),
      dueDate: parseNaturalDate(normalized, now),
    });
  }

  if (normalized.includes("payment") || normalized.includes("paid") || normalized.includes("record payment")) {
    const paymentType = normalized.includes("vendor")
      ? "vendor_payment"
      : "customer_payment";

    return finalizePlan("RECORD_PAYMENT", {
      amount: parseAmount(normalized),
      type: paymentType,
      paymentDate: parseNaturalDate(normalized, now) ?? toIsoDate(now, 0),
    });
  }

  if (normalized.includes("vendor") || normalized.includes("supplier")) {
    const nameMatch = input.match(/(?:vendor|supplier)\s+(?:named\s+)?([a-zA-Z0-9\s&.-]+)/i);
    const category = normalized.includes("cater")
      ? "catering"
      : normalized.includes("light")
        ? "lighting"
        : normalized.includes("sound")
          ? "sound"
          : "general";

    return finalizePlan("ADD_VENDOR", {
      name: nameMatch?.[1]?.trim(),
      serviceCategory: category,
    });
  }

  if (normalized.includes("event") || normalized.includes("function") || normalized.includes("program")) {
    const locationBeforeMe = input.match(/([a-zA-Z\s.-]+?)\s+(?:mein|me)\b/i);
    const locationAfterIn = input.match(/(?:in|at)\s+([a-zA-Z\s.-]+?)(?:\s+(?:for|ke\s+liye|client)\b|$)/i);
    const clientMatch = input.match(/(?:for|client|ke liye)\s+([a-zA-Z\s.-]+)/i);
    const parsedDate = parseNaturalDate(normalized, now);
    const location = locationBeforeMe?.[1]?.trim() || locationAfterIn?.[1]?.trim();

    return finalizePlan("CREATE_EVENT", {
      name: "Voice Created Event",
      location,
      clientName: clientMatch?.[1]?.trim(),
      startDate: parsedDate,
      endDate: parsedDate,
    });
  }

  return finalizePlan("UNKNOWN", {});
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

function parsePlanFromModel(text: string, now: Date): AssistantPlan {
  const normalized = extractJson(text);
  const parsed = JSON.parse(normalized) as Partial<AssistantPlan> & {
    payload?: Record<string, unknown>;
    missing_fields?: unknown;
    reply_to_user?: unknown;
  };

  const action = normalizeAction(parsed.action);
  const payload = parsed.payload && typeof parsed.payload === "object" ? { ...parsed.payload } : {};

  for (const dateField of ["startDate", "endDate", "dueDate", "paymentDate"]) {
    const value = payload[dateField];
    if (typeof value === "string") {
      const parsedDate = parseNaturalDate(value, now);
      if (parsedDate) payload[dateField] = parsedDate;
    }
  }

  const basePlan = finalizePlan(action, payload);
  const modelMissing = Array.isArray(parsed.missing_fields)
    ? parsed.missing_fields.filter((entry): entry is string => typeof entry === "string")
    : [];
  const mergedMissing = Array.from(new Set([...basePlan.missing_fields, ...modelMissing]));

  return {
    action: basePlan.action,
    is_complete: mergedMissing.length === 0,
    payload: basePlan.payload,
    missing_fields: mergedMissing,
    reply_to_user:
      typeof parsed.reply_to_user === "string" && parsed.reply_to_user.trim().length > 0
        ? parsed.reply_to_user
        : buildReply(basePlan.action, mergedMissing),
  };
}

function toLegacyCommand(plan: AssistantPlan): { action: "create_event" | "add_vendor" | "record_payment" | "create_invoice"; data: Record<string, unknown> } | null {
  const legacyAction = ACTION_TO_LEGACY[plan.action];
  if (!legacyAction) return null;

  return {
    action: legacyAction,
    data: plan.payload,
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
    const currentDate = new Date();
    const currentDateIso = currentDate.toISOString();

    if (!apiKey) {
      const fallbackPlan = parseRuleBasedPlan(text, currentDate);
      return NextResponse.json({
        ...fallbackPlan,
        model: "rule_based_fallback",
        warning: "GEMINI_API_KEY is not configured",
        command: toLegacyCommand(fallbackPlan),
      });
    }

    const systemPrompt = `
You are the AI Operations Assistant for "EventFlow", a sound & light rental operations platform.
Your job is to analyze user input (which may be in English, Hindi, or Hinglish) and convert it into a structured JSON command to execute in the system.

CURRENT DATE/TIME: ${currentDateIso}

SUPPORTED ACTIONS & REQUIRED FIELDS:
1. "CREATE_EVENT" - Requires: name, location, clientName, startDate.
2. "ADD_VENDOR" - Requires: name, serviceCategory (e.g., catering, lighting).
3. "RECORD_PAYMENT" - Requires: amount. Optional: type (customer_payment/vendor_payment), notes.
4. "CREATE_INVOICE" - Requires: amount.

INSTRUCTIONS:
- Analyze the user's input.
- Identify the intended action from the supported list.
- Extract all relevant parameters. For dates (like "kal", "parso", or "4 May"), calculate the exact ISO string based on the CURRENT DATE.
- If a REQUIRED field for an action is missing, leave it out of the payload and list it in "missing_fields".
- Generate a natural, polite Hinglish response in "reply_to_user" confirming the action or asking for missing information.
- YOU MUST RETURN ONLY RAW VALID JSON. No markdown formatting, no code blocks, no backticks.

JSON SCHEMA EXPECTED:
{
  "action": "CREATE_EVENT" | "ADD_VENDOR" | "RECORD_PAYMENT" | "CREATE_INVOICE" | "UNKNOWN",
  "is_complete": boolean,
  "payload": {},
  "missing_fields": [],
  "reply_to_user": ""
}

USER INPUT: ${text}
`.trim();

    let plan: AssistantPlan;
    let model: string;
    let warning: string | undefined;

    try {
      const geminiResult = await callGemini(systemPrompt, apiKey);
      plan = parsePlanFromModel(geminiResult.text, currentDate);
      model = geminiResult.model;
    } catch (geminiError) {
      plan = parseRuleBasedPlan(text, currentDate);
      model = "rule_based_fallback";
      warning = geminiError instanceof Error ? geminiError.message : "Gemini unavailable, used fallback";
    }

    return NextResponse.json({
      ...plan,
      model,
      warning,
      command: toLegacyCommand(plan),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse assistant command",
      },
      { status: 500 },
    );
  }
}
