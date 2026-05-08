import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { slugify } from "@/lib/slug";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/host/new")({
  head: () => ({ meta: [{ title: "Create a host — Gather" }] }),
  component: HostNewPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is too short")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer").optional(),
  contact_email: z.string().trim().email("Invalid email").max(255),
});

function HostNewPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: "/host/new" } });
    }
  }, [user, authLoading, navigate]);

  // Default contact email to user's email
  useEffect(() => {
    if (user?.email && !contactEmail) setContactEmail(user.email);
  }, [user, contactEmail]);

  // Auto-slug from name unless user edited slug
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const logoUrl = useMemo(() => logoPreview, [logoPreview]);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = schema.safeParse({ name, slug, bio: bio || undefined, contact_email: contactEmail });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      // Check slug uniqueness
      const { data: existing } = await supabase
        .from("hosts")
        .select("id")
        .eq("slug", parsed.data.slug)
        .maybeSingle();
      if (existing) {
        toast.error("That slug is taken — try another");
        setSubmitting(false);
        return;
      }

      // Upload logo (optional)
      let logoPublicUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${user.id}/${parsed.data.slug}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("host-logos")
          .upload(path, logoFile, { upsert: false, contentType: logoFile.type });
        if (uploadErr) throw uploadErr;
        logoPublicUrl = supabase.storage.from("host-logos").getPublicUrl(path).data.publicUrl;
      }

      // Insert host (DB trigger adds owner as 'host' member)
      const { data: inserted, error: insertErr } = await supabase
        .from("hosts")
        .insert({
          name: parsed.data.name,
          slug: parsed.data.slug,
          bio: parsed.data.bio ?? null,
          contact_email: parsed.data.contact_email,
          owner_id: user.id,
          logo_url: logoPublicUrl,
        })
        .select("slug")
        .single();
      if (insertErr) throw insertErr;

      toast.success("Host created!");
      navigate({ to: "/host/$slug/dashboard", params: { slug: inserted.slug } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Host</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Create a host</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A host is your community page on Gather. You can invite teammates and publish events under it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Host details</CardTitle>
          <CardDescription>You can edit these later from your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Brooklyn Book Club"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">gather-up-joy.lovable.app/hosts/</span>
                <Input
                  id="slug"
                  required
                  maxLength={60}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="brooklyn-book-club"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={onLogoChange}
                  className="max-w-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="A short description of your community."
              />
              <p className="text-right text-xs text-muted-foreground">{bio.length}/500</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input
                id="contact_email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create host"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
