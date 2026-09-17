import { createClient } from "@/lib/supabase/client";

export const HOMEWORK_BUCKET = "homework";
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 12;
/** Wide enough for Gemini to read handwriting and small print, small enough to upload quickly. */
const PAGE_WIDTH = 1600;

export type UploadProgress = (step: string) => void;

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't render the page"))), "image/png"));
}

/** Renders each PDF page to a PNG in the browser, avoiding a server-side PDF toolchain. */
async function pdfToPages(file: File, onProgress?: UploadProgress) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const count = Math.min(doc.numPages, MAX_PAGES);
  const pages: { pageNumber: number; blob: Blob; width: number; height: number }[] = [];

  for (let n = 1; n <= count; n++) {
    onProgress?.(`Rendering page ${n} of ${count}…`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ pageNumber: n, blob: await canvasToPng(canvas), width: canvas.width, height: canvas.height });
  }
  return { pages, truncated: doc.numPages > count };
}

/** A photo or screenshot is a single page; downscale it so uploads stay quick. */
async function imageToPage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PAGE_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { pages: [{ pageNumber: 1, blob: await canvasToPng(canvas), width: canvas.width, height: canvas.height }], truncated: false };
}

/**
 * Turns one uploaded file into an assignment: pages are rendered here, uploaded straight to
 * private storage, then the server reads the problems off them.
 */
export async function uploadAssignment(
  file: File,
  opts: { title?: string; kind: string; courseId?: string | null; onProgress?: UploadProgress },
): Promise<{ assignmentId: string; truncated: boolean }> {
  if (file.size > MAX_BYTES) throw new Error("Over 25 MB. Try splitting the PDF or taking a smaller photo.");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first");

  opts.onProgress?.("Reading the file…");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const { pages, truncated } = isPdf ? await pdfToPages(file, opts.onProgress) : await imageToPage(file);
  if (!pages.length) throw new Error("That file had no pages to read");

  const res = await fetch("/api/homework", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: opts.title || file.name.replace(/\.[^.]+$/, ""), kind: opts.kind, courseId: opts.courseId ?? null }),
  });
  const created = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(created.error ?? "Couldn't start the assignment");
  const assignmentId = created.assignmentId as string;

  const base = `${user.id}/${assignmentId}`;
  const uploaded: { pageNumber: number; imagePath: string; width: number; height: number }[] = [];
  for (const page of pages) {
    opts.onProgress?.(`Uploading page ${page.pageNumber} of ${pages.length}…`);
    const imagePath = `${base}/p${page.pageNumber}.png`;
    const { error } = await supabase.storage.from(HOMEWORK_BUCKET).upload(imagePath, page.blob, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    uploaded.push({ pageNumber: page.pageNumber, imagePath, width: page.width, height: page.height });
  }

  // Keep the original too, so it can be re-read or downloaded later.
  const filePath = `${base}/source-${safeName(file.name)}`;
  await supabase.storage.from(HOMEWORK_BUCKET).upload(filePath, file, { contentType: file.type || undefined, upsert: true });

  opts.onProgress?.("Reading the problems…");
  const register = await fetch(`/api/homework/${assignmentId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, pages: uploaded }),
  });
  const done = await register.json().catch(() => ({}));
  if (!register.ok) throw new Error(done.error ?? "Couldn't read the pages");
  return { assignmentId, truncated };
}
