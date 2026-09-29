"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import type { ImageRef } from "@/lib/data/types";
import { ACCEPT_ATTR, MAX_IMAGE_BYTES } from "@/lib/storage/image-validation";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { removeImage, reorderGallery, uploadImage, type MediaResult } from "@/app/(console)/media-actions";

export type ImageSlot = "provider-photo" | "course-cover" | "institute-gallery";

const ACCEPTED = ACCEPT_ATTR.split(",");
const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Stored images are served by an authenticated route, so they are plain <img>
 * elements: next/image's optimiser would fetch them without the session.
 */
export function Thumb({ image, alt, className }: { image: Pick<ImageRef, "url" | "width" | "height">; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated, per-session image URL
    <img src={image.url} alt={alt} width={image.width} height={image.height} loading="lazy" decoding="async" className={cn("object-cover", className)} />
  );
}

/** Runs a media action with toasts and a server refresh. */
function useMediaAction() {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  return React.useCallback(
    async (fn: () => Promise<MediaResult>): Promise<MediaResult> => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message ?? "Saved");
          startTransition(() => router.refresh());
        } else toast.error(r.error);
        return r;
      } catch {
        const error = "Couldn't reach the server, or the file was too large to send. Nothing was changed.";
        toast.error(error);
        return { ok: false, error };
      }
    },
    [router],
  );
}

/**
 * Drag-and-drop or click-to-choose upload area. Client checks are for fast
 * feedback only; the server action re-validates type (magic bytes), size and
 * permission, and audits the upload.
 */
export function ImageDropzone({
  slot,
  ownerId,
  label,
  hint = "JPEG, PNG or WebP, up to 5 MB",
  disabled,
  compact,
  className,
  id,
}: {
  id?: string;
  slot: ImageSlot;
  ownerId: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<{ name: string; size: number; preview: string } | null>(null);
  const run = useMediaAction();
  const errorId = React.useId();

  const send = async (file: File | undefined) => {
    if (!file || pending || disabled) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError(file.type === "image/svg+xml" ? "SVG files aren't accepted. Use a JPEG, PNG or WebP photo." : "Only JPEG, PNG or WebP photos can be uploaded.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`That file is ${mb(file.size)}. Images can be up to 5 MB.`);
      return;
    }
    const preview = URL.createObjectURL(file);
    setPending({ name: file.name, size: file.size, preview });
    const form = new FormData();
    form.set("slot", slot);
    form.set("ownerId", ownerId);
    form.set("file", file);
    const r = await run(() => uploadImage(form));
    if (!r.ok) setError(r.error);
    URL.revokeObjectURL(preview);
    setPending(null);
    if (input.current) input.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        onDragOver={(e) => {
          if (disabled || pending) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!over) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative rounded-[var(--radius-panel)] border border-dashed transition-[border-color,background-color] duration-150 ease-[var(--ease-out-quart)]",
          over ? "border-accent bg-accent-soft/50" : error ? "border-bad/60" : "border-line-strong hover:border-ink/40",
          disabled && "opacity-60",
        )}
      >
        <button
          id={id}
          type="button"
          disabled={disabled || !!pending}
          aria-describedby={error ? errorId : undefined}
          aria-busy={!!pending || undefined}
          onClick={() => input.current?.click()}
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-panel)] text-left outline-none",
            "focus-visible:ring-3 focus-visible:ring-accent/25",
            compact ? "px-3 py-2.5" : "px-4 py-4",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          {pending ? (
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={pending.preview} alt="" className="absolute inset-0 size-full object-cover opacity-50" />
              <Loader2 className="relative size-5 animate-spin text-ink" strokeWidth={2} aria-hidden />
            </span>
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-[8px] bg-sunken text-ink-2">
              <UploadCloud className="size-5" strokeWidth={1.6} aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              {pending ? `Uploading ${pending.name}` : over ? "Drop to upload" : label}
            </span>
            <span className="block text-[12px] leading-snug text-ink-3">
              {pending ? `${mb(pending.size)} · checking and saving…` : disabled ? hint : <>Drag a file here or <span className="text-ink-2 underline underline-offset-2">choose one</span>. {hint}</>}
            </span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void send(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[13px] text-bad">
          <AlertCircle className="mt-[2px] size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A single image (profile photo, cover) with replace and remove. */
export function SingleImageField({
  slot,
  ownerId,
  image,
  alt,
  shape = "wide",
  label,
  emptyHint,
  id,
}: {
  id?: string;
  slot: Exclude<ImageSlot, "institute-gallery">;
  ownerId?: string;
  image?: ImageRef;
  alt: string;
  shape?: "square" | "wide";
  label: string;
  emptyHint?: string;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const run = useMediaAction();

  if (!ownerId) {
    return (
      <p className="rounded-[var(--radius-panel)] border border-dashed border-line-strong px-4 py-3 text-[13px] text-ink-2">
        {emptyHint ?? "Save first, then add an image."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {image ? (
        <div className="flex items-center gap-4">
          <Thumb
            image={image}
            alt={alt}
            className={cn("shrink-0 border border-line bg-sunken", shape === "square" ? "size-20 rounded-[10px]" : "aspect-[16/9] w-44 rounded-[8px]")}
          />
          <div className="min-w-0 flex-1">
            <p className="num text-[12.5px] text-ink-2">
              {image.width}×{image.height} · {image.contentType.replace("image/", "").toUpperCase()} · {mb(image.bytes)}
            </p>
            <Button variant="ghost" size="sm" className="-ml-2 mt-1 text-bad hover:text-bad" onClick={() => setConfirm(true)}>
              <Trash2 className="size-3.5" strokeWidth={1.75} /> Remove
            </Button>
          </div>
        </div>
      ) : null}
      <ImageDropzone id={id} slot={slot} ownerId={ownerId} label={image ? "Replace image" : label} compact={!!image} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this image?"
        body="It's deleted from storage and disappears from the app. Upload a new one any time."
        confirmLabel="Remove image"
        loading={busy}
        onConfirm={async () => {
          if (!image) return;
          setBusy(true);
          await run(() => removeImage({ slot, ownerId, key: image.key }));
          setBusy(false);
          setConfirm(false);
        }}
      />
    </div>
  );
}

/** Institute gallery: upload, reorder (buttons or drag), remove. First photo is the cover. */
export function GalleryField({ instituteId, images, name, max = 12, id }: { instituteId?: string; images: ImageRef[]; name: string; max?: number; id?: string }) {
  const run = useMediaAction();
  const [order, setOrder] = React.useState(images);
  const [base, setBase] = React.useState(images);
  if (base !== images) {
    setBase(images);
    setOrder(images);
  }
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<ImageRef | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  if (!instituteId) {
    return (
      <p className="rounded-[var(--radius-panel)] border border-dashed border-line-strong px-4 py-3 text-[13px] text-ink-2">
        Save the institute first, then add gallery photos.
      </p>
    );
  }

  const commit = async (next: ImageRef[]) => {
    const prev = order;
    setOrder(next);
    setBusy("order");
    const r = await run(() => reorderGallery({ instituteId, keys: next.map((g) => g.key) }));
    if (!r.ok) setOrder(prev);
    setBusy(null);
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    void commit(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {order.length ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={`${name} gallery`}>
          {order.map((g, i) => (
            <li
              key={g.key}
              draggable={!busy}
              onDragStart={(e) => {
                setDragKey(g.key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => {
                if (dragKey && dragKey !== g.key) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragKey || dragKey === g.key) return;
                const from = order.findIndex((x) => x.key === dragKey);
                const next = [...order];
                const [m] = next.splice(from, 1);
                next.splice(i, 0, m);
                setDragKey(null);
                void commit(next);
              }}
              className={cn(
                "group relative overflow-hidden rounded-[8px] border border-line bg-sunken",
                dragKey === g.key && "opacity-50",
                !busy && "cursor-grab active:cursor-grabbing",
              )}
            >
              <Thumb image={g} alt={`${name}, photo ${i + 1}`} className="aspect-[4/3] w-full" />
              <span className="num absolute left-1.5 top-1.5 rounded-[4px] bg-surface/90 px-1.5 py-0.5 text-[11px] font-medium text-ink ring-1 ring-inset ring-line">
                {i === 0 ? "1 · Cover" : i + 1}
              </span>
              <div className="flex items-center justify-between gap-1 border-t border-line bg-surface px-1 py-1">
                <div className="flex">
                  <Button variant="ghost" size="icon" className="size-7" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0 || !!busy} onClick={() => move(i, -1)}>
                    <ArrowLeft className="size-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" aria-label={`Move photo ${i + 1} later`} disabled={i === order.length - 1 || !!busy} onClick={() => move(i, 1)}>
                    <ArrowRight className="size-3.5" strokeWidth={1.75} />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="size-7 text-bad hover:text-bad" aria-label={`Remove photo ${i + 1}`} disabled={!!busy} onClick={() => setRemoving(g)}>
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex items-center justify-between text-[12px] text-ink-3">
        <span className="num">
          {order.length} of {max} photos{order.length > 1 ? " · drag or use the arrows to reorder" : ""}
        </span>
        {busy === "order" ? (
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="size-3 animate-spin" strokeWidth={2} aria-hidden /> Saving order
          </span>
        ) : null}
      </div>
      {order.length < max ? (
        <ImageDropzone id={id} slot="institute-gallery" ownerId={instituteId} label={order.length ? "Add another photo" : "Add the first photo"} compact={order.length > 0} />
      ) : (
        <p className="text-[12.5px] text-ink-2">The gallery is full. Remove a photo to add another.</p>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this photo?"
        body="It's deleted from storage and disappears from the institute's gallery in the app."
        confirmLabel="Remove photo"
        loading={busy === "remove"}
        onConfirm={async () => {
          if (!removing) return;
          setBusy("remove");
          await run(() => removeImage({ slot: "institute-gallery", ownerId: instituteId, key: removing.key }));
          setBusy(null);
          setRemoving(null);
        }}
      />
    </div>
  );
}
