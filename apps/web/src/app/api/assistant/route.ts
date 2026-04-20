import { NextResponse } from "next/server";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

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

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini request failed: ${response.status} ${errorText}` },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const command = parseCommand(textResult);

    return NextResponse.json({ command });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse assistant command",
      },
      { status: 500 },
    );
  }
}
