import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    INVOICE_BRAND_COLOR: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
    INVOICE_COMPANY_ADDRESS: z.string().min(1).optional(),
    INVOICE_COMPANY_EMAIL: z.string().email().optional(),
    INVOICE_COMPANY_PHONE: z.string().min(1).optional(),
    INVOICE_COMPANY_TAX_ID: z.string().min(1).optional(),
    INVOICE_COMPANY_WEBSITE: z.url().optional(),
    INVOICE_BANK_ACCOUNT_NAME: z.string().min(1).optional(),
    INVOICE_BANK_ACCOUNT_NUMBER: z.string().min(1).optional(),
    INVOICE_BANK_IFSC: z.string().min(1).optional(),
    INVOICE_BANK_NAME: z.string().min(1).optional(),
    INVOICE_PAYMENT_NOTES: z.string().min(1).optional(),
    INVOICE_PAYMENT_TERMS: z.string().min(1).optional(),
    INVOICE_UPI_ID: z.string().min(1).optional(),
    INVOICE_UPI_NAME: z.string().min(1).optional(),
    GMAIL_USER: z.string().email().optional(),
    GMAIL_APP_PASSWORD: z.string().min(1).optional(),
    GMAIL_FROM_NAME: z.string().min(1).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
