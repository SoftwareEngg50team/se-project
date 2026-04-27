const crypto = require("crypto");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const APP_URL = process.env.APP_URL || "https://se-project-main-fresh.vercel.app";
const REQUEST_ORIGIN = process.env.CORS_ORIGIN || APP_URL;
const TARGET_DATE = new Date("2026-04-27T12:00:00.000Z");
const WINDOW_START = new Date("2026-04-20T00:00:00.000Z");
const WINDOW_END = new Date("2026-05-27T23:59:59.000Z");

const MAIN_USER = {
  email: "saqib29abubakar@gmail.com",
  password: "12345678",
  name: "MOHD SAQIB",
};

function stableUuid(key) {
  const hex = crypto.createHash("md5").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stableTextId(prefix, key) {
  const short = crypto.createHash("sha1").update(key).digest("hex").slice(0, 20);
  return `${prefix}_${short}`;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(29042026);

function pick(array) {
  return array[Math.floor(rand() * array.length) % array.length];
}

function int(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function amount(min, max, step = 100) {
  const value = int(min / step, max / step) * step;
  return value;
}

function randomBetween(from, to) {
  const start = from.getTime();
  const end = to.getTime();
  const t = Math.floor(start + rand() * (end - start));
  return new Date(t);
}

async function ensureMainAccount() {
  const payload = {
    email: MAIN_USER.email,
    password: MAIN_USER.password,
    name: MAIN_USER.name,
  };

  try {
    const response = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: REQUEST_ORIGIN,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      const alreadyExists = /already exists|exists|duplicate|409/i.test(text);
      if (!alreadyExists) {
        throw new Error(`Failed to sign up main user: ${response.status} ${text}`);
      }
    }
  } catch (error) {
    throw new Error(`Main account setup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyLogin() {
  const payload = {
    email: MAIN_USER.email,
    password: MAIN_USER.password,
  };

  const response = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: REQUEST_ORIGIN,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login verification failed: ${response.status} ${text}`);
  }

  return {
    status: response.status,
    ok: true,
    responsePreview: text.slice(0, 160),
  };
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await ensureMainAccount();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const mainUserRes = await client.query('select id from "user" where email = $1 limit 1', [MAIN_USER.email]);
    const mainUserId = mainUserRes.rows[0]?.id;

    if (!mainUserId) {
      throw new Error("Main user not found in user table after sign-up.");
    }

    await client.query(
      `update "user" set name = $2, email_verified = true, updated_at = now() where id = $1`,
      [mainUserId, MAIN_USER.name],
    );

    await client.query(
      `insert into user_profile (id, user_id, phone, title, bio, address, city, state, country, postal_code, website, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'Delhi', 'India', $8, $9, now(), now())
       on conflict (user_id) do update set
         phone = excluded.phone,
         title = excluded.title,
         bio = excluded.bio,
         address = excluded.address,
         city = excluded.city,
         state = excluded.state,
         country = excluded.country,
         postal_code = excluded.postal_code,
         website = excluded.website,
         updated_at = now()`,
      [
        stableTextId("profile", mainUserId),
        mainUserId,
        "+91-9812345678",
        "Owner",
        "Primary owner account for EventFlow realistic seed dataset.",
        "Sector 29, Gurgaon",
        "Gurgaon",
        "122001",
        "https://profiles.eventflow.test/main-owner",
      ],
    );

    const organizationId = stableTextId("org", "eventflow-main-org");
    const organizationSlug = "eventflow-main";

    await client.query(
      `insert into organization (id, name, slug, metadata, created_at)
       values ($1, $2, $3, $4, now())
       on conflict (id) do update set name = excluded.name, slug = excluded.slug, metadata = excluded.metadata`,
      [organizationId, "EventFlow Main Operations", organizationSlug, "bulk realistic seed dataset"],
    );

    await client.query(
      `insert into member (id, user_id, organization_id, role, hourly_rate, created_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (id) do update set role = excluded.role, hourly_rate = excluded.hourly_rate`,
      [stableTextId("member", `${mainUserId}:${organizationId}`), mainUserId, organizationId, "owner", 2200],
    );

    const firstNames = [
      "Aarav", "Vihaan", "Kabir", "Reyansh", "Ayaan", "Arjun", "Aditya", "Krish", "Ibrahim", "Rohan",
      "Anaya", "Aadhya", "Kiara", "Saanvi", "Myra", "Zoya", "Meher", "Inaya", "Navya", "Tara",
      "Rahul", "Neha", "Vikram", "Priya", "Farhan", "Aisha", "Karan", "Sana", "Yash", "Pooja",
    ];

    const lastNames = [
      "Sharma", "Verma", "Khan", "Patel", "Singh", "Gupta", "Nair", "Iyer", "Joshi", "Kapoor",
      "Malhotra", "Bansal", "Qureshi", "Roy", "Das", "Mehta", "Mishra", "Saxena", "Arora", "Chauhan",
    ];

    const cities = ["Delhi", "Noida", "Gurgaon", "Mumbai", "Pune", "Jaipur", "Lucknow", "Bengaluru", "Hyderabad", "Chandigarh"];
    const roles = ["staff", "staff", "staff", "event_head", "staff", "event_head", "staff"];
    const titles = ["Sound Engineer", "Light Operator", "Event Coordinator", "Warehouse Lead", "Operations Associate"];

    const userPool = [{ id: mainUserId, name: MAIN_USER.name, email: MAIN_USER.email, city: "Delhi" }];

    for (let i = 0; i < 74; i += 1) {
      const first = pick(firstNames);
      const last = pick(lastNames);
      const fullName = `${first} ${last}`;
      const city = pick(cities);
      const email = `ops.user.${String(i + 1).padStart(3, "0")}@eventflow.test`;
      const userId = stableTextId("user", email);

      await client.query(
        `insert into "user" (id, name, email, email_verified, image, created_at, updated_at)
         values ($1, $2, $3, true, $4, now(), now())
         on conflict (email) do update set name = excluded.name, image = excluded.image, updated_at = now()`,
        [userId, fullName, email, `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}`],
      );

      await client.query(
        `insert into user_profile (id, user_id, phone, title, bio, address, city, state, country, postal_code, website, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, 'State', 'India', $8, $9, now(), now())
         on conflict (user_id) do update set
           phone = excluded.phone,
           title = excluded.title,
           bio = excluded.bio,
           address = excluded.address,
           city = excluded.city,
           state = excluded.state,
           country = excluded.country,
           postal_code = excluded.postal_code,
           website = excluded.website,
           updated_at = now()`,
        [
          stableTextId("profile", userId),
          userId,
          `+91-98${String(10000000 + i).slice(-8)}`,
          pick(titles),
          `${fullName} handles event operations and delivery quality for live events.`,
          `Block ${int(1, 90)}, ${city}`,
          city,
          `${110000 + i}`,
          `https://profiles.eventflow.test/${userId}`,
        ],
      );

      await client.query(
        `insert into member (id, user_id, organization_id, role, hourly_rate, created_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (id) do update set role = excluded.role, hourly_rate = excluded.hourly_rate`,
        [stableTextId("member", `${userId}:${organizationId}`), userId, organizationId, pick(roles), int(500, 1800)],
      );

      userPool.push({ id: userId, name: fullName, email, city });
    }

    for (let i = 0; i < 60; i += 1) {
      const user = userPool[i % userPool.length];
      const accountId = stableTextId("acct", `${user.id}:${i + 1}`);
      const providerId = i % 2 === 0 ? "credential" : "google";

      await client.query(
        `insert into account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
         on conflict (id) do update set
           account_id = excluded.account_id,
           provider_id = excluded.provider_id,
           user_id = excluded.user_id,
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           id_token = excluded.id_token,
           access_token_expires_at = excluded.access_token_expires_at,
           refresh_token_expires_at = excluded.refresh_token_expires_at,
           scope = excluded.scope,
           password = excluded.password,
           updated_at = now()`,
        [
          accountId,
          user.email,
          providerId,
          user.id,
          stableTextId("atk", `${i}:${user.id}`),
          stableTextId("rtk", `${i}:${user.id}`),
          stableTextId("idtk", `${i}:${user.id}`),
          new Date(TARGET_DATE.getTime() + int(1, 14) * 86400000).toISOString(),
          new Date(TARGET_DATE.getTime() + int(14, 45) * 86400000).toISOString(),
          "openid profile email",
          providerId === "credential" ? stableTextId("pwd", `${user.email}:seed`) : null,
        ],
      );
    }

    for (let i = 0; i < 70; i += 1) {
      const user = userPool[i % userPool.length];
      const sessionId = stableTextId("sess", `${user.id}:${i + 1}`);

      await client.query(
        `insert into session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id, active_organization_id)
         values ($1, $2, $3, now(), now(), $4, $5, $6, $7)
         on conflict (id) do update set
           expires_at = excluded.expires_at,
           token = excluded.token,
           ip_address = excluded.ip_address,
           user_agent = excluded.user_agent,
           user_id = excluded.user_id,
           active_organization_id = excluded.active_organization_id,
           updated_at = now()`,
        [
          sessionId,
          new Date(TARGET_DATE.getTime() + int(3, 30) * 86400000).toISOString(),
          stableTextId("token", `${sessionId}:token`),
          `10.0.${int(1, 254)}.${int(1, 254)}`,
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          user.id,
          organizationId,
        ],
      );
    }

    for (let i = 0; i < 50; i += 1) {
      const user = userPool[i % userPool.length];
      await client.query(
        `insert into verification (id, identifier, value, expires_at, created_at, updated_at)
         values ($1, $2, $3, $4, now(), now())
         on conflict (id) do update set
           identifier = excluded.identifier,
           value = excluded.value,
           expires_at = excluded.expires_at,
           updated_at = now()`,
        [
          stableTextId("ver", `verification:${i + 1}`),
          user.email,
          stableTextId("verify", `${user.email}:${i}`),
          new Date(TARGET_DATE.getTime() + int(1, 20) * 86400000).toISOString(),
        ],
      );
    }

    const categories = [
      ["Speakers", "PA and monitor speakers"],
      ["Subwoofers", "Low-frequency systems"],
      ["Mixers", "Digital and analog mixers"],
      ["Microphones", "Wired and wireless microphones"],
      ["DI Boxes", "Signal conversion units"],
      ["Amplifiers", "Power amplifiers"],
      ["Lighting Fixtures", "Par cans and movers"],
      ["Lighting Consoles", "Lighting control desks"],
      ["Trusses", "Rigging truss systems"],
      ["Power Distribution", "Power distro and protection"],
      ["Cables", "Signal and power cabling"],
      ["LED Walls", "Display and wall panels"],
      ["Generators", "Event backup power"],
      ["Stage Platforms", "Stage deck systems"],
      ["Communication", "Intercom and communication gear"],
    ];

    for (const [name, description] of categories) {
      await client.query(
        `insert into equipment_category (id, name, description)
         values ($1, $2, $3)
         on conflict (name) do update set description = excluded.description`,
        [stableUuid(`eq-cat:${name}`), name, description],
      );
    }

    const catRows = await client.query("select id, name from equipment_category order by name");
    const categoryRows = catRows.rows;

    const vendors = [];
    const vendorTypes = ["food", "transportation", "repair", "other"];
    for (let i = 0; i < 60; i += 1) {
      const id = stableUuid(`vendor:${i + 1}`);
      const owner = pick(userPool);
      const city = pick(cities);

      await client.query(
        `insert into vendor (id, name, phone, email, type, created_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set
           name = excluded.name,
           phone = excluded.phone,
           email = excluded.email,
           type = excluded.type,
           created_by = excluded.created_by`,
        [
          id,
          `${city} ${pick(["Audio", "Logistics", "Catering", "Power", "Rigging"])} Partners ${i + 1}`,
          `+91-97${String(20000000 + i).slice(-8)}`,
          `vendor.${String(i + 1).padStart(3, "0")}@eventflow.test`,
          pick(vendorTypes),
          randomBetween(WINDOW_START, TARGET_DATE).toISOString(),
          owner.id,
        ],
      );

      vendors.push(id);
    }

    const equipmentIds = [];
    const equipmentStatus = ["available", "assigned", "in_transit", "at_event", "under_repair"];
    for (let i = 0; i < 85; i += 1) {
      const id = stableUuid(`equipment:${i + 1}`);
      const cat = categoryRows[i % categoryRows.length];
      const creator = pick(userPool);

      await client.query(
        `insert into equipment_item (id, name, category_id, status, purchase_date, purchase_cost, notes, created_at, updated_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, now(), now(), $8)
         on conflict (id) do update set
           name = excluded.name,
           category_id = excluded.category_id,
           status = excluded.status,
           purchase_date = excluded.purchase_date,
           purchase_cost = excluded.purchase_cost,
           notes = excluded.notes,
           created_by = excluded.created_by,
           updated_at = now()`,
        [
          id,
          `${cat.name} Unit ${String(i + 1).padStart(3, "0")}`,
          cat.id,
          pick(equipmentStatus),
          randomBetween(new Date("2022-01-01T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z")).toISOString(),
          amount(7000, 180000, 500),
          `Asset maintained under annual service cycle #${(i % 12) + 1}`,
          creator.id,
        ],
      );

      equipmentIds.push(id);
    }

    const events = [];
    const eventStatusByDate = (startDate) => {
      if (startDate < TARGET_DATE) return "completed";
      if (startDate.toDateString() === TARGET_DATE.toDateString()) return "in_progress";
      return "upcoming";
    };

    for (let i = 0; i < 75; i += 1) {
      const id = stableUuid(`event:${i + 1}`);
      const creator = pick(userPool);
      const city = pick(cities);
      const startDate = randomBetween(WINDOW_START, WINDOW_END);
      startDate.setHours(int(8, 18), pick([0, 15, 30, 45]), 0, 0);
      const endDate = new Date(startDate.getTime() + int(4, 14) * 60 * 60 * 1000);

      await client.query(
        `insert into event (id, name, start_date, end_date, location, status, client_name, client_phone, client_email, notes, total_revenue, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
         on conflict (id) do update set
           name = excluded.name,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           location = excluded.location,
           status = excluded.status,
           client_name = excluded.client_name,
           client_phone = excluded.client_phone,
           client_email = excluded.client_email,
           notes = excluded.notes,
           total_revenue = excluded.total_revenue,
           created_by = excluded.created_by,
           updated_at = now()`,
        [
          id,
          `${pick(["Wedding", "Corporate", "Concert", "Expo", "Private Party"])} ${String(i + 1).padStart(3, "0")}`,
          startDate.toISOString(),
          endDate.toISOString(),
          `${city} ${pick(["Convention Center", "Banquet", "Open Ground", "Club", "Auditorium"])}`,
          eventStatusByDate(startDate),
          `${pick(firstNames)} ${pick(lastNames)}`,
          `+91-96${String(30000000 + i).slice(-8)}`,
          `client.${String(i + 1).padStart(3, "0")}@mail.test`,
          `Full-service event package with audio, lighting, and stage management.`,
          amount(60000, 950000, 1000),
          creator.id,
        ],
      );

      events.push({ id, startDate, endDate, creatorId: creator.id });
    }

    for (let i = 0; i < 100; i += 1) {
      const event = pick(events);
      const staffUser = pick(userPool);
      const assignedBy = pick(userPool);
      const assignedAt = randomBetween(new Date(event.startDate.getTime() - 3 * 86400000), event.startDate);
      const attendanceDate = randomBetween(new Date(event.startDate.getTime() - 86400000), new Date(event.endDate.getTime() + 86400000));

      await client.query(
        `insert into staff_assignment (id, event_id, user_id, assigned_by, assigned_at, notification_sent)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set
           event_id = excluded.event_id,
           user_id = excluded.user_id,
           assigned_by = excluded.assigned_by,
           assigned_at = excluded.assigned_at,
           notification_sent = excluded.notification_sent`,
        [stableUuid(`staff-assignment:${i + 1}`), event.id, staffUser.id, assignedBy.id, assignedAt.toISOString(), i % 4 !== 0],
      );

      await client.query(
        `insert into attendance (id, event_id, user_id, date, present, hours_worked, marked_by)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set
           event_id = excluded.event_id,
           user_id = excluded.user_id,
           date = excluded.date,
           present = excluded.present,
           hours_worked = excluded.hours_worked,
           marked_by = excluded.marked_by`,
        [
          stableUuid(`attendance:${i + 1}`),
          event.id,
          staffUser.id,
          attendanceDate.toISOString(),
          i % 7 !== 0,
          int(4, 11),
          assignedBy.id,
        ],
      );
    }

    const returnStatuses = ["pending", "returned", "missing", "damaged"];
    for (let i = 0; i < 100; i += 1) {
      const event = pick(events);
      const equipmentId = pick(equipmentIds);
      const assignedBy = pick(userPool);
      const assignedAt = randomBetween(new Date(event.startDate.getTime() - 2 * 86400000), event.startDate);
      const shouldReturn = event.startDate < TARGET_DATE;
      const returnedAt = shouldReturn
        ? randomBetween(event.endDate, new Date(event.endDate.getTime() + 2 * 86400000)).toISOString()
        : null;
      const status = shouldReturn ? pick(["returned", "returned", "pending", "damaged"]) : pick(["pending", "pending", "missing"]);

      await client.query(
        `insert into equipment_assignment (id, event_id, equipment_id, assigned_at, returned_at, return_status, damage_notes, assigned_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           event_id = excluded.event_id,
           equipment_id = excluded.equipment_id,
           assigned_at = excluded.assigned_at,
           returned_at = excluded.returned_at,
           return_status = excluded.return_status,
           damage_notes = excluded.damage_notes,
           assigned_by = excluded.assigned_by`,
        [
          stableUuid(`equipment-assignment:${i + 1}`),
          event.id,
          equipmentId,
          assignedAt.toISOString(),
          returnedAt,
          status,
          status === "damaged" ? "Minor connector issue observed during return." : null,
          assignedBy.id,
        ],
      );
    }

    const expenseCategories = ["salary", "food", "transportation", "equipment_repair", "miscellaneous"];
    for (let i = 0; i < 90; i += 1) {
      const event = pick(events);
      const createdBy = pick(userPool);
      const vendorId = i % 5 === 0 ? null : pick(vendors);

      await client.query(
        `insert into expense (id, event_id, category, amount, description, vendor_id, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           event_id = excluded.event_id,
           category = excluded.category,
           amount = excluded.amount,
           description = excluded.description,
           vendor_id = excluded.vendor_id,
           created_by = excluded.created_by,
           created_at = excluded.created_at`,
        [
          stableUuid(`expense:${i + 1}`),
          event.id,
          pick(expenseCategories),
          amount(1500, 85000, 100),
          `Operational expense entry ${i + 1}`,
          vendorId,
          createdBy.id,
          randomBetween(WINDOW_START, WINDOW_END).toISOString(),
        ],
      );
    }

    const invoices = [];
    const invoiceStatuses = ["draft", "sent", "partial", "paid", "overdue"];
    for (let i = 0; i < 80; i += 1) {
      const event = pick(events);
      const createdBy = pick(userPool);
      const issuedAt = randomBetween(WINDOW_START, WINDOW_END);
      const dueDate = new Date(issuedAt.getTime() + int(3, 18) * 86400000);
      const status = pick(invoiceStatuses);
      const amountValue = amount(15000, 420000, 500);
      const invoiceId = stableUuid(`invoice:${i + 1}`);

      await client.query(
        `insert into invoice (id, event_id, invoice_number, amount, status, issued_at, due_date, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           event_id = excluded.event_id,
           invoice_number = excluded.invoice_number,
           amount = excluded.amount,
           status = excluded.status,
           issued_at = excluded.issued_at,
           due_date = excluded.due_date,
           created_by = excluded.created_by`,
        [
          invoiceId,
          event.id,
          `EVF-2026-${String(i + 1).padStart(5, "0")}`,
          amountValue,
          status,
          issuedAt.toISOString(),
          dueDate.toISOString(),
          createdBy.id,
        ],
      );

      await client.query(
        `insert into invoice_line_item (id, invoice_id, description, quantity, unit_price, service_date, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set
           description = excluded.description,
           quantity = excluded.quantity,
           unit_price = excluded.unit_price,
           service_date = excluded.service_date,
           sort_order = excluded.sort_order`,
        [
          stableUuid(`invoice-line-a:${i + 1}`),
          invoiceId,
          "Sound and light production package",
          1,
          Math.floor(amountValue * 0.7),
          issuedAt.toISOString(),
          0,
        ],
      );

      await client.query(
        `insert into invoice_line_item (id, invoice_id, description, quantity, unit_price, service_date, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set
           description = excluded.description,
           quantity = excluded.quantity,
           unit_price = excluded.unit_price,
           service_date = excluded.service_date,
           sort_order = excluded.sort_order`,
        [
          stableUuid(`invoice-line-b:${i + 1}`),
          invoiceId,
          "On-site setup and teardown support",
          1,
          Math.floor(amountValue * 0.3),
          issuedAt.toISOString(),
          1,
        ],
      );

      invoices.push({ id: invoiceId, eventId: event.id, amount: amountValue, createdBy: createdBy.id, status });
    }

    const paymentTypes = ["customer_advance", "customer_payment", "vendor_payment"];
    for (let i = 0; i < 90; i += 1) {
      const invoice = pick(invoices);
      const recordedBy = pick(userPool);
      const vendorId = i % 3 === 0 ? pick(vendors) : null;
      const type = vendorId ? "vendor_payment" : pick(["customer_advance", "customer_payment", "customer_payment"]);

      await client.query(
        `insert into payment (id, invoice_id, vendor_id, event_id, amount, payment_date, payment_method, type, notes, recorded_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set
           invoice_id = excluded.invoice_id,
           vendor_id = excluded.vendor_id,
           event_id = excluded.event_id,
           amount = excluded.amount,
           payment_date = excluded.payment_date,
           payment_method = excluded.payment_method,
           type = excluded.type,
           notes = excluded.notes,
           recorded_by = excluded.recorded_by`,
        [
          stableUuid(`payment:${i + 1}`),
          invoice.id,
          vendorId,
          invoice.eventId,
          type === "vendor_payment"
            ? amount(1200, 65000, 100)
            : Math.min(invoice.amount, amount(5000, Math.max(5000, invoice.amount), 100)),
          randomBetween(WINDOW_START, WINDOW_END).toISOString(),
          pick(["bank transfer", "upi", "cash", "cheque"]),
          type,
          `Payment entry ${i + 1}`,
          recordedBy.id,
        ],
      );
    }

    const notificationTypes = ["assignment", "cancellation", "weekly_digest", "payment_reminder"];
    for (let i = 0; i < 100; i += 1) {
      const user = pick(userPool);
      const event = pick(events);
      const sentAt = randomBetween(WINDOW_START, WINDOW_END);
      await client.query(
        `insert into notification (id, user_id, event_id, type, message, sent_at, read)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set
           user_id = excluded.user_id,
           event_id = excluded.event_id,
           type = excluded.type,
           message = excluded.message,
           sent_at = excluded.sent_at,
           read = excluded.read`,
        [
          stableUuid(`notification:${i + 1}`),
          user.id,
          event.id,
          pick(notificationTypes),
          `Notification ${i + 1}: action required for ${event.id.slice(0, 8)}.`,
          sentAt.toISOString(),
          i % 4 === 0,
        ],
      );
    }

    for (let i = 0; i < 50; i += 1) {
      const inviter = pick(userPool);
      await client.query(
        `insert into invitation (id, email, inviter_id, organization_id, role, status, expires_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           email = excluded.email,
           inviter_id = excluded.inviter_id,
           organization_id = excluded.organization_id,
           role = excluded.role,
           status = excluded.status,
           expires_at = excluded.expires_at,
           created_at = excluded.created_at`,
        [
          stableTextId("invite", `invite-${i + 1}`),
          `invite.${String(i + 1).padStart(3, "0")}@eventflow.test`,
          inviter.id,
          organizationId,
          pick(["staff", "event_head"]),
          pick(["pending", "accepted", "pending", "pending"]),
          randomBetween(TARGET_DATE, WINDOW_END).toISOString(),
          randomBetween(WINDOW_START, TARGET_DATE).toISOString(),
        ],
      );
    }

    for (let i = 0; i < 60; i += 1) {
      await client.query(
        `insert into playing_with_neon (id, name, value)
         values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name, value = excluded.value`,
        [i + 1, `sample_metric_${String(i + 1).padStart(2, "0")}`, Number((rand() * 100).toFixed(2))],
      );
    }

    await client.query("COMMIT");

    const countTables = [
      "user",
      "account",
      "session",
      "verification",
      "user_profile",
      "member",
      "organization",
      "event",
      "vendor",
      "equipment_category",
      "equipment_item",
      "equipment_assignment",
      "staff_assignment",
      "attendance",
      "expense",
      "invoice",
      "invoice_line_item",
      "payment",
      "notification",
      "invitation",
      "playing_with_neon",
    ];

    const counts = {};
    for (const table of countTables) {
      const result = await client.query(`select count(*)::int as count from public."${table}"`);
      counts[table] = result.rows[0].count;
    }

    const loginCheck = await verifyLogin();

    console.log(
      JSON.stringify(
        {
          ok: true,
          dateWindow: {
            start: WINDOW_START.toISOString(),
            end: WINDOW_END.toISOString(),
            anchor: TARGET_DATE.toISOString(),
          },
          mainUser: {
            email: MAIN_USER.email,
            password: MAIN_USER.password,
            name: MAIN_USER.name,
          },
          counts,
          loginCheck,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
