import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, ImageIcon, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ReportDialog } from "@/components/report-dialog";

type GalleryItem = { id: string; image_url: string; user_id: string; status: string; created_at: string };

export function GallerySection({
  eventId,
  ended,
  userIsGoing,
}: {
  eventId: string;
  ended: boolean;
  userIsGoing: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("gallery_items")
      .select("id, image_url, user_id, status, created_at")
      .eq("event_id", eventId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as GalleryItem[]);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [eventId]);

  const canUpload = user && (userIsGoing || ended);

  const onUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    if (!file.type.startsWith("image/")) return toast.error("Images only");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${eventId}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gallery").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
      const { error: insErr } = await supabase.from("gallery_items").insert({
        event_id: eventId, user_id: user.id, image_url: pub.publicUrl, status: "pending",
      });
      if (insErr) throw insErr;
      toast.success("Uploaded — awaiting host approval");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Photo gallery</h2>
        {canUpload && (
          <>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Add photo"}
            </Button>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p>No photos yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img src={it.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              {user && (
                <ReportDialog
                  targetType="photo"
                  targetId={it.id}
                  trigger={
                    <button
                      className="absolute right-1 top-1 rounded-md bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                      aria-label="Report photo"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
