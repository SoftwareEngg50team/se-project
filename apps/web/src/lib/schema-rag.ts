type SchemaChunk = {
  id: string;
  title: string;
  text: string;
  keywords: string[];
};

export type SchemaRetrievalResult = {
  context: string;
  confidence: number;
  topChunks: Array<{ id: string; title: string; score: number }>;
};

const SCHEMA_CHUNKS: SchemaChunk[] = [
  {
    id: "enums_core",
    title: "Core enums",
    text: "Enums include equipment_status(available, assigned, in_transit, at_event, under_repair), event_status(upcoming, in_progress, completed, cancelled), expense_category(salary, food, transportation, equipment_repair, miscellaneous), invoice_status(draft, sent, partial, paid, overdue), payment_type(customer_advance, customer_payment, vendor_payment), vendor_type(food, transportation, repair, other), return_status(pending, returned, missing, damaged), notification_type(assignment, cancellation, weekly_digest, payment_reminder).",
    keywords: ["enum", "status", "invoice", "payment", "vendor", "equipment", "notification"],
  },
  {
    id: "event_table",
    title: "Event table",
    text: "Table event has id, name, start_date, end_date, location, status, client_name, client_phone, client_email, notes, total_revenue, created_by, created_at, updated_at.",
    keywords: ["event", "client", "location", "start", "end", "revenue"],
  },
  {
    id: "vendor_table",
    title: "Vendor table",
    text: "Table vendor has id, name, phone, email, type(vendor_type), created_at, created_by.",
    keywords: ["vendor", "supplier", "catering", "repair", "transport"],
  },
  {
    id: "invoice_table",
    title: "Invoice table",
    text: "Table invoice has id, event_id, invoice_number(unique), amount, status(invoice_status), issued_at, due_date, created_by.",
    keywords: ["invoice", "bill", "due", "issued", "overdue", "amount"],
  },
  {
    id: "invoice_line_item_table",
    title: "Invoice line items",
    text: "Table invoice_line_item has id, invoice_id, description, quantity, unit_price, service_date, sort_order.",
    keywords: ["line item", "item", "quantity", "unit price", "service"],
  },
  {
    id: "payment_table",
    title: "Payment table",
    text: "Table payment has id, invoice_id(nullable), vendor_id(nullable), event_id, amount, payment_date, payment_method, type(payment_type), notes, recorded_by.",
    keywords: ["payment", "advance", "vendor_payment", "customer_payment", "amount", "method"],
  },
  {
    id: "expense_table",
    title: "Expense table",
    text: "Table expense has id, event_id, category(expense_category), amount, description, vendor_id(nullable), created_by, created_at.",
    keywords: ["expense", "cost", "salary", "food", "transportation", "repair"],
  },
  {
    id: "equipment_category_table",
    title: "Equipment categories",
    text: "Table equipment_category has id, name(unique), description.",
    keywords: ["equipment", "category", "inventory"],
  },
  {
    id: "equipment_item_table",
    title: "Equipment items",
    text: "Table equipment_item has id, name, category_id, status(equipment_status), purchase_date, purchase_cost, notes, created_at, updated_at, created_by.",
    keywords: ["equipment", "item", "status", "purchase", "repair", "available"],
  },
  {
    id: "equipment_assignment_table",
    title: "Equipment assignments",
    text: "Table equipment_assignment has id, event_id, equipment_id, assigned_at, returned_at, return_status, damage_notes, assigned_by.",
    keywords: ["assignment", "assign", "return", "damage", "equipment", "event"],
  },
  {
    id: "staff_assignment_table",
    title: "Staff assignments",
    text: "Table staff_assignment has id, event_id, user_id, assigned_by, assigned_at, notification_sent.",
    keywords: ["staff", "assignment", "team", "event", "notification"],
  },
  {
    id: "attendance_table",
    title: "Attendance",
    text: "Table attendance has id, event_id, user_id, date, present, hours_worked, marked_by.",
    keywords: ["attendance", "hours", "present", "staff", "event"],
  },
  {
    id: "notification_table",
    title: "Notifications",
    text: "Table notification has id, user_id, event_id(nullable), type(notification_type), message, sent_at, read.",
    keywords: ["notification", "digest", "reminder", "read", "message"],
  },
  {
    id: "auth_user_org_tables",
    title: "Auth and organization",
    text: "Tables user, organization, member, account, session, invitation, verification store authentication and organization membership. member has role and hourly_rate. session has active_organization_id.",
    keywords: ["auth", "user", "organization", "member", "role", "session", "permission"],
  },
  {
    id: "profile_table",
    title: "User profile",
    text: "Table user_profile has user_id(unique) with phone, title, bio, address, city, state, country, postal_code, website.",
    keywords: ["profile", "user", "phone", "address", "bio"],
  },
  {
    id: "common_relationships",
    title: "Common relationships",
    text: "invoice.event_id references event.id. payment.event_id references event.id and payment.invoice_id references invoice.id. expense.event_id references event.id. staff_assignment.event_id references event.id. equipment_assignment links event and equipment_item.",
    keywords: ["foreign key", "relation", "references", "event_id", "invoice_id", "vendor_id"],
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function vectorize(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function dot(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0;
  for (const [k, v] of a.entries()) {
    const bv = b.get(k);
    if (bv) sum += v * bv;
  }
  return sum;
}

function magnitude(a: Map<string, number>): number {
  let sum = 0;
  for (const value of a.values()) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  const denom = magnitude(a) * magnitude(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

function keywordBoost(queryTokens: Set<string>, keywords: string[]): number {
  let boost = 0;
  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase();
    if (queryTokens.has(normalized)) {
      boost += 0.35;
    }
  }
  return boost;
}

export function retrieveSchemaContext(query: string, topK = 5): SchemaRetrievalResult {
  const queryTokens = tokenize(query);
  const queryVec = vectorize(queryTokens);
  const querySet = new Set(queryTokens);

  const ranked = SCHEMA_CHUNKS
    .map((chunk) => {
      const chunkVec = vectorize(tokenize(`${chunk.title} ${chunk.text}`));
      const cosine = cosineSimilarity(queryVec, chunkVec);
      const boost = keywordBoost(querySet, chunk.keywords);
      return {
        chunk,
        score: cosine + boost,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((entry) => entry.score > 0.02);

  if (ranked.length === 0) {
    return {
      context: "No high-confidence schema chunks matched this query. Use conservative extraction and do not invent unsupported fields.",
      confidence: 0,
      topChunks: [],
    };
  }

  const maxScore = Math.max(...ranked.map((entry) => entry.score));
  const confidence = Math.max(0, Math.min(1, maxScore));

  const context = ranked
    .map((entry, index) => `${index + 1}. [${entry.chunk.id}] ${entry.chunk.text}`)
    .join("\n");

  return {
    context,
    confidence,
    topChunks: ranked.map((entry) => ({
      id: entry.chunk.id,
      title: entry.chunk.title,
      score: Number(entry.score.toFixed(4)),
    })),
  };
}

export function isSchemaInfoQuery(input: string): boolean {
  const normalized = input.toLowerCase();
  return /(schema|table|tables|columns|enum|foreign key|relation|index|db structure|database structure|sql)/i.test(normalized);
}
