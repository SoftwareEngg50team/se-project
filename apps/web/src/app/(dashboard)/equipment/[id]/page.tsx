import { EquipmentDetailView } from "./equipment-detail-view";

export default function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EquipmentDetailView paramsPromise={params} />;
}
