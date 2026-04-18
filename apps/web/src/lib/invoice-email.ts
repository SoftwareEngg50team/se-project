import nodemailer from "nodemailer";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { env } from "@se-project/env/server";
import { InvoicePDF } from "@/lib/invoice-pdf";
import type { InvoiceExportData } from "@/lib/invoice-export";

function formatMoney(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildBody(data: InvoiceExportData, customMessage?: string) {
  const lines = [
    `Hello ${data.event.clientName},`,
    "",
    `Please find attached invoice ${data.invoiceNumber} for ${data.event.name}.`,
    `Amount due: ${formatMoney(data.balanceDue)}.`,
  ];

  if (customMessage?.trim()) {
    lines.push("", customMessage.trim());
  }

  lines.push(
    "",
    `Due date: ${data.dueDate.toLocaleDateString("en-IN")}`,
    `Organization: ${data.branding.organizationName}`,
  );

  if (data.branding.paymentTerms) {
    lines.push("", data.branding.paymentTerms);
  }

  return lines.join("\n");
}

function buildHtmlBody(data: InvoiceExportData, customMessage?: string) {
  const safeMessage = customMessage?.trim()
    ? `<p style="margin:16px 0 0;color:#334155;white-space:pre-wrap;">${customMessage.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <p>Hello ${data.event.clientName},</p>
      <p>Please find attached invoice <strong>${data.invoiceNumber}</strong> for <strong>${data.event.name}</strong>.</p>
      <p>Amount due: <strong>${formatMoney(data.balanceDue)}</strong></p>
      ${safeMessage}
      <p>Due date: ${data.dueDate.toLocaleDateString("en-IN")}</p>
      <p>Organization: ${data.branding.organizationName}</p>
      ${data.branding.paymentTerms ? `<p style="color:#475569;">${data.branding.paymentTerms}</p>` : ""}
    </div>
  `;
}

export async function sendInvoiceViaGmail(options: {
  to: string;
  subject: string;
  message?: string;
  data: InvoiceExportData;
}) {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error("Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  const element = React.createElement(InvoicePDF, { data: options.data });
  const pdfBuffer = await renderToBuffer(element as any);

  const fromName = env.GMAIL_FROM_NAME?.trim() || options.data.branding.organizationName;
  const fromAddress = `${fromName} <${env.GMAIL_USER}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    text: buildBody(options.data, options.message),
    html: buildHtmlBody(options.data, options.message),
    attachments: [
      {
        filename: `${options.data.invoiceNumber}.pdf`,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  });

  return { messageId: info.messageId };
}
