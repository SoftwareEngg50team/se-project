"use client";

import { Button } from "@se-project/ui/components/button";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { Textarea } from "@se-project/ui/components/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@se-project/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";
import { EquipmentCategoryIcon } from "@/components/shared/equipment-category-icon";

interface EquipmentFormProps {
  defaultValues?: {
    name: string;
    categoryId: string;
    status: string;
    purchaseDate: string;
    purchaseCost: string;
    notes: string;
  };
  equipmentId?: string;
}

const equipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  status: z.string().min(1, "Status is required"),
  purchaseDate: z.string(),
  purchaseCost: z.string().refine(
    (val) => val === "" || /^\d+$/.test(val),
    { message: "Purchase cost must be a whole number in paise" },
  ),
  notes: z.string(),
});

export function EquipmentForm({ defaultValues, equipmentId }: EquipmentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(equipmentId);

  const { data: categories, isLoading: isLoadingCategories } = useQuery(
    orpc.equipment.listCategories.queryOptions(),
  );

  const createEquipment = useMutation(orpc.equipment.create.mutationOptions());
  const updateEquipment = useMutation(orpc.equipment.update.mutationOptions());

  const form = useForm({
    defaultValues: defaultValues ?? {
      name: "",
      categoryId: "",
      status: "available",
      purchaseDate: "",
      purchaseCost: "",
      notes: "",
    },
    onSubmit: async ({ value }) => {
      const purchaseCost = value.purchaseCost.trim() === "" ? undefined : Number(value.purchaseCost);

      const payload = {
        name: value.name,
        categoryId: value.categoryId,
        status: value.status as
          | "available"
          | "assigned"
          | "in_transit"
          | "at_event"
          | "under_repair",
        purchaseDate: value.purchaseDate
          ? new Date(value.purchaseDate)
          : undefined,
        purchaseCost,
        notes: value.notes || undefined,
      };

      if (isEditing && equipmentId) {
        await updateEquipment.mutateAsync(
          { id: equipmentId, ...payload },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({
                queryKey: [["equipment", "list"]],
              });
              queryClient.invalidateQueries({
                queryKey: orpc.equipment.getById.queryOptions({ input: { id: equipmentId } })
                  .queryKey,
              });
              router.push(`/equipment/${equipmentId}`);
              toast.success("Equipment updated successfully");
            },
            onError: (error) => {
              toast.error(error.message || "Failed to update equipment");
            },
          },
        );
      } else {
        await createEquipment.mutateAsync(payload, {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: [["equipment", "list"]],
            });
            router.push("/equipment");
            toast.success("Equipment created successfully");
          },
          onError: (error) => {
            toast.error(error.message || "Failed to create equipment");
          },
        });
      }
    },
    validators: {
      onSubmit: equipmentSchema,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-8"
    >
      <Card>
        <CardHeader>
          <CardTitle>Equipment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Equipment Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter equipment name"
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="categoryId">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Category</Label>
                  {!isLoadingCategories && (categories ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No categories available. Please create a category first.
                    </p>
                  ) : (
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category">
                          {field.state.value ? ((categories ?? []).find((c) => c.id === field.state.value)?.name ?? "Select a category") : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingCategories ? (
                          <SelectItem value="loading" disabled>
                            Loading...
                          </SelectItem>
                        ) : (
                          (categories ?? []).map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <span className="inline-flex items-center gap-2">
                                <EquipmentCategoryIcon name={cat.name} className="size-4 text-primary" />
                                {cat.name}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Status</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status">
                        {field.state.value ? { available: "Available", assigned: "Assigned", in_transit: "In Transit", at_event: "At Event", under_repair: "Under Repair" }[field.state.value] : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="at_event">At Event</SelectItem>
                      <SelectItem value="under_repair">Under Repair</SelectItem>
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="purchaseDate">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Purchase Date</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="purchaseCost">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Purchase Cost (in paise)</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    inputMode="numeric"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter amount in paise"
                  />
                  <p className="text-xs text-muted-foreground">
                      Display value: {field.state.value ? `\u20B9${(Number(field.state.value) / 100).toFixed(2)}` : "—"}
                  </p>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Notes</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={4}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Update Equipment"
                  : "Add Equipment"}
            </Button>
          )}
        </form.Subscribe>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              isEditing && equipmentId
                ? `/equipment/${equipmentId}`
                : "/equipment",
            )
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
