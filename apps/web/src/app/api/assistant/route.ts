import { NextResponse } from "next/server";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"] as const;

type AssistantAction = "create_event" | "add_vendor" | "record_payment" | "create_invoice";

type AssistantCommand = {
  action: AssistantAction;
  data: Record<string, unknown>;
};

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

    const { text: textResult, model } = await callGemini(prompt, apiKey);
    const command = parseCommand(textResult);

    return NextResponse.json({ command, model });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse assistant command",
      },
      { status: 500 },
    );
  }
}
