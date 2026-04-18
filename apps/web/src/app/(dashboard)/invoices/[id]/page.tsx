import { InvoiceDetailView } from "./invoice-detail-view";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <InvoiceDetailView paramsPromise={params} />;
}
