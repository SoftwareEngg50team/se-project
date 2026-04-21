const crypto = require("crypto");
const { Client } = require("pg");

function stableUuid(key) {
  const hex = crypto.createHash("md5").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stableTextId(prefix, key) {
  const short = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `${prefix}_${short}`;
}

function randChoice(arr, idx) {
  return arr[idx % arr.length];
}

function amount(min, step, idx) {
  return min + (idx % 7) * step;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const usersRes = await client.query('select id, email, name from "user" order by created_at asc');
    if (usersRes.rows.length === 0) {
      throw new Error("No base user found. Create at least one account before seeding realistic data.");
    }

    const baseUser = usersRes.rows[0];

    const memberRes = await client.query(
      "select organization_id from member where user_id = $1 order by created_at asc limit 1",
      [baseUser.id],
    );

    let organizationId = memberRes.rows[0]?.organization_id;
    if (!organizationId) {
      organizationId = stableTextId("org", "eventflow-main-org");
      await client.query(
        `insert into organization (id, name, slug, metadata, created_at)
         values ($1, $2, $3, $4, now())
         on conflict (id) do update set name = excluded.name, slug = excluded.slug, metadata = excluded.metadata`,
        [organizationId, "EventFlow Operations", "eventflow-ops", "seeded main org"],
      );

      await client.query(
        `insert into member (id, user_id, organization_id, role, hourly_rate, created_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (id) do update set role = excluded.role, hourly_rate = excluded.hourly_rate`,
        [stableTextId("member", `${baseUser.id}:${organizationId}`), baseUser.id, organizationId, "owner", 1200],
      );
    }

    const firstNames = [
      "Rahul", "Aisha", "Vikram", "Neha", "Arjun", "Priya", "Karan", "Zoya", "Rohan", "Meera",
      "Imran", "Kavya", "Aman", "Sneha", "Dev", "Ananya", "Farhan", "Isha", "Manav", "Tara",
      "Nikhil", "Sana", "Yash", "Pooja", "Rehan",
    ];
    const lastNames = [
      "Sharma", "Khan", "Verma", "Patel", "Singh", "Mehta", "Gupta", "Roy", "Das", "Nair",
      "Bansal", "Kapoor", "Joshi", "Mishra", "Chauhan", "Malhotra", "Iyer", "Arora", "Qureshi", "Saxena",
    ];
    const cities = ["Delhi", "Mumbai", "Bengaluru", "Pune", "Jaipur", "Lucknow", "Hyderabad", "Chandigarh"];
    const titles = ["Sound Engineer", "Lighting Technician", "Event Coordinator", "Operations Manager", "Warehouse Staff"];
    const roles = ["event_head", "staff", "staff", "staff", "event_head", "staff"];

    const seedUsers = [];
    for (let i = 0; i < 25; i += 1) {
      const first = firstNames[i % firstNames.length];
      const last = lastNames[(i * 3) % lastNames.length];
      const email = `seed.user${String(i + 1).padStart(2, "0")}@eventflow.test`;
      const userId = stableTextId("user", email);
      const fullName = `${first} ${last}`;
      const city = randChoice(cities, i);
      const title = randChoice(titles, i);
      const role = randChoice(roles, i);
      const hourlyRate = 500 + ((i % 8) * 100);

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
          title,
          `${fullName} works in EventFlow operations with focus on execution quality and client satisfaction.`,
          `Sector ${10 + i}, ${city}`,
          city,
          `${110000 + i}`,
          `https://profiles.eventflow.test/${userId}`,
        ],
      );

      await client.query(
        `insert into member (id, user_id, organization_id, role, hourly_rate, created_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (id) do update set role = excluded.role, hourly_rate = excluded.hourly_rate`,
        [stableTextId("member", `${userId}:${organizationId}`), userId, organizationId, role, hourlyRate],
      );

      seedUsers.push({ id: userId, name: fullName, city, role });
    }

    const categoryNames = [
      ["Speakers", "PA and monitor speakers"],
      ["Mixers", "Audio mixers and consoles"],
      ["Microphones", "Wired and wireless microphones"],
      ["Lighting", "Par cans, movers and controllers"],
      ["Power", "Power cables and distribution"],
    ];

    for (const [name, description] of categoryNames) {
      await client.query(
        `insert into equipment_category (id, name, description)
         values ($1, $2, $3)
         on conflict (name) do update set description = excluded.description`,
        [stableUuid(`eq-cat:${name}`), name, description],
      );
    }

    const catRows = await client.query("select id, name from equipment_category order by name");
    const categories = catRows.rows;

    const eventIds = [];
    for (let i = 0; i < 16; i += 1) {
      const creator = seedUsers[i % seedUsers.length];
      const eventId = stableUuid(`seed-event-${i + 1}`);
      const start = new Date();
      start.setDate(start.getDate() + (i - 6));
      start.setHours(10 + (i % 5), 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 5 + (i % 3));

      const status = i < 5 ? "completed" : (i < 8 ? "in_progress" : "upcoming");

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
          eventId,
          `Seed Event ${i + 1} - ${creator.city}`,
          start.toISOString(),
          end.toISOString(),
          creator.city,
          status,
          `Client ${i + 1}`,
          `+91-97${String(20000000 + i).slice(-8)}`,
          `client${i + 1}@example.test`,
          `Seeded event for end-to-end testing #${i + 1}`,
          50000 + (i * 7500),
          creator.id,
        ],
      );

      eventIds.push(eventId);
    }

    const vendorTypes = ["food", "transportation", "repair", "other"];
    const vendors = [];
    for (let i = 0; i < 12; i += 1) {
      const vendorId = stableUuid(`seed-vendor-${i + 1}`);
      const owner = seedUsers[i % seedUsers.length];
      const vendorType = randChoice(vendorTypes, i);

      await client.query(
        `insert into vendor (id, name, phone, email, type, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (id) do update set
           name = excluded.name,
           phone = excluded.phone,
           email = excluded.email,
           type = excluded.type,
           created_by = excluded.created_by`,
        [
          vendorId,
          `Seed Vendor ${i + 1}`,
          `+91-96${String(30000000 + i).slice(-8)}`,
          `vendor${i + 1}@eventflow.test`,
          vendorType,
          owner.id,
        ],
      );

      vendors.push(vendorId);
    }

    for (let i = 0; i < 20; i += 1) {
      const eqId = stableUuid(`seed-eq-${i + 1}`);
      const owner = seedUsers[i % seedUsers.length];
      const cat = categories[i % categories.length];

      await client.query(
        `insert into equipment_item (id, name, category_id, status, purchase_date, purchase_cost, notes, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
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
          eqId,
          `${cat.name} Unit ${i + 1}`,
          cat.id,
          i % 5 === 0 ? "under_repair" : "available",
          new Date(Date.now() - (100 + i) * 86400000).toISOString(),
          amount(8000, 1200, i),
          `Seed equipment asset ${i + 1}`,
          owner.id,
        ],
      );
    }

    for (let i = 0; i < 24; i += 1) {
      const eventId = eventIds[i % eventIds.length];
      const staff = seedUsers[(i + 3) % seedUsers.length];
      const assigner = seedUsers[(i + 1) % seedUsers.length];

      await client.query(
        `insert into staff_assignment (id, event_id, user_id, assigned_by, assigned_at, notification_sent)
         values ($1, $2, $3, $4, now() - ($5::int || ' days')::interval, true)
         on conflict (id) do update set
           event_id = excluded.event_id,
           user_id = excluded.user_id,
           assigned_by = excluded.assigned_by,
           notification_sent = excluded.notification_sent`,
        [stableUuid(`seed-staff-assign-${i + 1}`), eventId, staff.id, assigner.id, i % 20],
      );

      await client.query(
        `insert into attendance (id, event_id, user_id, date, present, hours_worked, marked_by)
         values ($1, $2, $3, now() - ($4::int || ' days')::interval, $5, $6, $7)
         on conflict (id) do update set
           present = excluded.present,
           hours_worked = excluded.hours_worked,
           marked_by = excluded.marked_by`,
        [stableUuid(`seed-att-${i + 1}`), eventId, staff.id, i % 20, true, 6 + (i % 4), assigner.id],
      );
    }

    for (let i = 0; i < 18; i += 1) {
      const eventId = eventIds[i % eventIds.length];
      const creator = seedUsers[(i + 2) % seedUsers.length];
      const vendorId = vendors[i % vendors.length];

      await client.query(
        `insert into expense (id, event_id, category, amount, description, vendor_id, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, now())
         on conflict (id) do update set
           category = excluded.category,
           amount = excluded.amount,
           description = excluded.description,
           vendor_id = excluded.vendor_id,
           created_by = excluded.created_by`,
        [
          stableUuid(`seed-exp-${i + 1}`),
          eventId,
          randChoice(["salary", "food", "transportation", "equipment_repair", "miscellaneous"], i),
          amount(1500, 600, i),
          `Seed expense ${i + 1}`,
          vendorId,
          creator.id,
        ],
      );
    }

    for (let i = 0; i < 14; i += 1) {
      const eventId = eventIds[i % eventIds.length];
      const creator = seedUsers[(i + 4) % seedUsers.length];
      const invoiceId = stableUuid(`seed-invoice-${i + 1}`);
      const invoiceNumber = `SEED-INV-${String(i + 1).padStart(4, "0")}`;
      const amountValue = amount(12000, 4500, i);

      await client.query(
        `insert into invoice (id, event_id, invoice_number, amount, status, issued_at, due_date, created_by)
         values ($1, $2, $3, $4, $5, now() - ($6::int || ' days')::interval, now() + ($7::int || ' days')::interval, $8)
         on conflict (id) do update set
           event_id = excluded.event_id,
           invoice_number = excluded.invoice_number,
           amount = excluded.amount,
           status = excluded.status,
           due_date = excluded.due_date,
           created_by = excluded.created_by`,
        [invoiceId, eventId, invoiceNumber, amountValue, i % 3 === 0 ? "paid" : "partial", i % 20, 10 + (i % 12), creator.id],
      );

      await client.query(
        `insert into invoice_line_item (id, invoice_id, description, quantity, unit_price, service_date, sort_order)
         values ($1, $2, $3, 1, $4, now(), 0)
         on conflict (id) do update set description = excluded.description, unit_price = excluded.unit_price`,
        [stableUuid(`seed-invoice-li-a-${i + 1}`), invoiceId, `Main service package #${i + 1}`, Math.floor(amountValue * 0.7)],
      );

      await client.query(
        `insert into invoice_line_item (id, invoice_id, description, quantity, unit_price, service_date, sort_order)
         values ($1, $2, $3, 1, $4, now(), 1)
         on conflict (id) do update set description = excluded.description, unit_price = excluded.unit_price`,
        [stableUuid(`seed-invoice-li-b-${i + 1}`), invoiceId, `Additional setup #${i + 1}`, Math.floor(amountValue * 0.3)],
      );

      await client.query(
        `insert into payment (id, invoice_id, vendor_id, event_id, amount, payment_date, payment_method, type, notes, recorded_by)
         values ($1, $2, null, $3, $4, now() - ($5::int || ' days')::interval, 'bank transfer', 'customer_payment', $6, $7)
         on conflict (id) do update set amount = excluded.amount, notes = excluded.notes, recorded_by = excluded.recorded_by`,
        [
          stableUuid(`seed-payment-customer-${i + 1}`),
          invoiceId,
          eventId,
          Math.floor(amountValue * (i % 2 === 0 ? 1 : 0.6)),
          i % 15,
          `Seed customer payment for invoice ${invoiceNumber}`,
          creator.id,
        ],
      );
    }

    for (let i = 0; i < 40; i += 1) {
      const user = seedUsers[i % seedUsers.length];
      const eventId = eventIds[i % eventIds.length];
      const type = randChoice(["assignment", "cancellation", "weekly_digest", "payment_reminder"], i);

      await client.query(
        `insert into notification (id, user_id, event_id, type, message, sent_at, read)
         values ($1, $2, $3, $4, $5, now() - ($6::int || ' hours')::interval, $7)
         on conflict (id) do update set message = excluded.message, read = excluded.read`,
        [
          stableUuid(`seed-notification-${i + 1}`),
          user.id,
          eventId,
          type,
          `Seed ${type.replace("_", " ")} alert #${i + 1} for ${user.name}`,
          i % 72,
          i % 3 === 0,
        ],
      );
    }

    await client.query("COMMIT");

    console.log(JSON.stringify({
      ok: true,
      seededUsers: 25,
      seededEvents: 16,
      seededVendors: 12,
      seededEquipment: 20,
      seededInvoices: 14,
      seededPayments: 14,
      seededNotifications: 40,
      organizationId,
    }, null, 2));
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
