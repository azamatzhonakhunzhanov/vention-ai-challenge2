import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { toast } from "sonner";

export type EventFormValues = {
  title: string;
  slug: string;
  description: string;
  starts_at: string; // ISO local "YYYY-MM-DDTHH:mm"
  ends_at: string;
  time_zone: string;
  venue_type: "in_person" | "online";
  venue_address: string;
  online_url: string;
  capacity: number;
  cover_image_url: string | null;
  visibility: "public" | "unlisted";
  is_paid: boolean;
};

export type EventFormSubmit = {
  values: EventFormValues;
  status: "draft" | "published";
  coverFile: File | null;
};

const browserTz = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

const tzList = (): string[] => {
  try {
    const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const list = intlAny.supportedValuesOf?.("timeZone") ?? [];
    if (list.length) return list;
  } catch { /* noop */ }
  return ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo"];
};

const schema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  description: z.string().max(10000).optional(),
  starts_at: z.string().min(1, "Start required"),
  ends_at: z.string().min(1, "End required"),
  time_zone: z.string().min(1),
  venue_type: z.enum(["in_person", "online"]),
  venue_address: z.string().max(300).optional(),
  online_url: z.string().max(500).optional(),
  capacity: z.number().int().min(1, "Must be at least 1").max(100000),
  visibility: z.enum(["public", "unlisted"]),
  is_paid: z.boolean(),
}).refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
  message: "End must be after start",
  path: ["ends_at"],
}).refine((v) => v.venue_type === "online" ? !!v.online_url : true, {
  message: "Online URL is required",
  path: ["online_url"],
}).refine((v) => v.venue_type === "in_person" ? !!v.venue_address : true, {
  message: "Venue address is required",
  path: ["venue_address"],
});

export function EventForm({
  initialValues, mode, onSubmit, onCancel, submitting, extraActions,
}: {
  initialValues: EventFormValues;
  mode: "create" | "edit";
  onSubmit: (data: EventFormSubmit) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  extraActions?: React.ReactNode;
}) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialValues.cover_image_url);

  const tzOptions = useMemo(() => tzList(), []);

  useEffect(() => {
    if (!slugTouched) setValues((v) => ({ ...v, slug: slugify(v.title) }));
  }, [values.title, slugTouched]);

  const update = <K extends keyof EventFormValues>(key: K, val: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const onCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover image must be under 8MB");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handle = (status: "draft" | "published") => async () => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    await onSubmit({ values, status, coverFile });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title" required maxLength={140}
                value={values.title} onChange={(e) => update("title", e.target.value)}
                placeholder="Summer book swap"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/events/</span>
                <Input
                  id="slug" required maxLength={80}
                  value={values.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description" rows={6} maxLength={10000}
                value={values.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What's the event about? Markdown is supported."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>When</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Starts</Label>
              <Input
                id="starts_at" type="datetime-local" required
                value={values.starts_at}
                onChange={(e) => update("starts_at", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">Ends</Label>
              <Input
                id="ends_at" type="datetime-local" required
                value={values.ends_at}
                onChange={(e) => update("ends_at", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tz">Time zone</Label>
              <Select value={values.time_zone} onValueChange={(v) => update("time_zone", v)}>
                <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {tzOptions.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Where</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup
              value={values.venue_type}
              onValueChange={(v) => update("venue_type", v as "in_person" | "online")}
              className="flex gap-6"
            >
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="in_person" /> In-person
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="online" /> Online
              </Label>
            </RadioGroup>
            {values.venue_type === "in_person" ? (
              <div className="space-y-2">
                <Label htmlFor="venue_address">Venue address</Label>
                <Input
                  id="venue_address" maxLength={300}
                  value={values.venue_address}
                  onChange={(e) => update("venue_address", e.target.value)}
                  placeholder="123 Main St, Brooklyn, NY"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="online_url">Online URL</Label>
                <Input
                  id="online_url" type="url" maxLength={500}
                  value={values.online_url}
                  onChange={(e) => update("online_url", e.target.value)}
                  placeholder="https://meet.example.com/..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity" type="number" min={1} max={100000} required
                value={values.capacity}
                onChange={(e) => update("capacity", parseInt(e.target.value || "0", 10))}
              />
            </div>

            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-32 overflow-hidden rounded-md border bg-muted">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <Input type="file" accept="image/*" onChange={onCoverChange} className="max-w-xs" />
              </div>
              <p className="text-xs text-muted-foreground">JPG or PNG, up to 8MB.</p>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <RadioGroup
                value={values.visibility}
                onValueChange={(v) => update("visibility", v as "public" | "unlisted")}
                className="flex gap-6"
              >
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="public" /> Public
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="unlisted" /> Unlisted
                </Label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Unlisted events don't appear in Explore but are accessible via direct link.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Pricing</Label>
              <RadioGroup
                value={values.is_paid ? "paid" : "free"}
                onValueChange={(v) => update("is_paid", v === "paid")}
                className="flex gap-6"
              >
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="free" /> Free
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex items-center gap-2 opacity-50 cursor-not-allowed">
                      <RadioGroupItem value="paid" disabled /> Paid
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon</TooltipContent>
                </Tooltip>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          {extraActions}
          <Button type="button" variant="outline" onClick={handle("draft")} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save draft
          </Button>
          <Button type="button" onClick={handle("published")} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function defaultEventValues(): EventFormValues {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000); // +1h
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2h
  return {
    title: "",
    slug: "",
    description: "",
    starts_at: toLocalInput(start),
    ends_at: toLocalInput(end),
    time_zone: browserTz(),
    venue_type: "in_person",
    venue_address: "",
    online_url: "",
    capacity: 50,
    cover_image_url: null,
    visibility: "public",
    is_paid: false,
  };
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(s: string): string {
  // Treat as local time, return ISO
  return new Date(s).toISOString();
}

/** Upload cover to event-covers bucket; returns public URL or null. */
export async function uploadEventCover(
  userId: string,
  hostSlug: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${hostSlug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("event-covers")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
}
