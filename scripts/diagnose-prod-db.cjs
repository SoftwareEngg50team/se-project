const { Client } = require("pg");

async function main() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error("DATABASE_URL is not set in process env");
  }

  const client = new Client({ connectionString: conn });
  await client.connect();

  const tables = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name in ('__drizzle_migrations', 'vendor', 'equipment_item')
     order by table_name;`,
  );

  const createdByColumns = await client.query(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'vendor' and column_name = 'created_by')
            or (table_name = 'equipment_item' and column_name = 'created_by'))
     order by table_name;`,
  );

  const migrations = await client.query(
    `select id, hash, created_at
     from __drizzle_migrations
     order by created_at desc
     limit 5;`,
  ).catch(() => ({ rows: [] }));

  console.log("tables:", JSON.stringify(tables.rows, null, 2));
  console.log("created_by columns:", JSON.stringify(createdByColumns.rows, null, 2));
  console.log("recent migrations:", JSON.stringify(migrations.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
