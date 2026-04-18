import { VendorDetailView } from "./vendor-detail-view";

export default function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <VendorDetailView paramsPromise={params} />;
}
