import { test, expect } from "@playwright/test";

test.describe("Milestone 4 critical flow", () => {
  test("login -> create event -> assign equipment -> record expense -> create invoice -> record payment", async ({ page }) => {
    await test.step("sign in", async () => {
      await page.goto("/login");
      await page.getByLabel("Email").fill("owner@example.com");
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/);
    });

    await test.step("create an event", async () => {
      await page.goto("/events/new");
      await page.getByLabel("Event Name").fill("Milestone 4 Showcase");
      await page.getByLabel("Start Date").fill("2026-04-20");
      await page.getByLabel("End Date").fill("2026-04-20");
      await page.getByLabel("Location").fill("Main Hall");
      await page.getByLabel("Client Name").fill("Acme Events");
      await page.getByRole("button", { name: /create event/i }).click();
      await expect(page).toHaveURL(/\/events\/[0-9a-f-]+/i);
    });

    await test.step("assign equipment and staff", async () => {
      await page.getByRole("tab", { name: "Equipment" }).click();
      await page.getByRole("button", { name: /assign selected/i }).click();
      await page.getByRole("tab", { name: "Staff" }).click();
      await page.getByRole("button", { name: /assign selected/i }).click();
    });

    await test.step("record expense", async () => {
      await page.getByRole("tab", { name: "Expenses" }).click();
      await page.getByLabel("Amount (paise)").fill("25000");
      await page.getByRole("button", { name: /save expense/i }).click();
      await expect(page.getByText("Expense recorded")).toBeVisible();
    });

    await test.step("create invoice", async () => {
      await page.goto("/invoices");
      await page.getByRole("button", { name: /create invoice/i }).click();
      await page.getByRole("button", { name: /create invoice/i }).last().click();
    });

    await test.step("record payment", async () => {
      await page.goto("/invoices");
      await page.getByRole("link", { name: /INV-/i }).first().click();
      await page.getByRole("button", { name: /record payment/i }).click();
      await page.getByLabel("Amount (in paise)").fill("25000");
      await page.getByRole("button", { name: /save payment/i }).click();
      await expect(page.getByText("Payment recorded successfully")).toBeVisible();
    });
  });
});