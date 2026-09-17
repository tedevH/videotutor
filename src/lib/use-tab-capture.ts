"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_FRAME_WIDTH = 1280;
const JPEG_QUALITY = 0.85;

type CaptureStatus = "off" | "on" | "unsupported";

/**
 * Captures exact frames of the embedded YouTube player. Cross-origin iframes can't be read
 * directly, so we ask the student to share this tab once, then crop the player out of it.
 */
export function useTabCapture() {
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CaptureStatus>("off");

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStatus((s) => (s === "unsupported" ? s : "off"));
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("unsupported");
      return false;
    }
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
      const track = media.getVideoTracks()[0];
      if ((track.getSettings() as { displaySurface?: string }).displaySurface !== "browser") {
        // A window or whole screen can't be mapped onto the player's position.
        media.getTracks().forEach((t) => t.stop());
        return false;
      }
      track.addEventListener("ended", stop);

      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.srcObject = media;
      await el.play();
      video.current = el;
      stream.current = media;
      setStatus("on");
      return true;
    } catch {
      return false;
    }
  }, [stop]);

  /** Returns the region of `element` from the latest tab frame as base64 JPEG (no data: prefix). */
  const grab = useCallback((element: HTMLElement | null, maxWidth = MAX_FRAME_WIDTH): string | null => {
    const el = video.current;
    if (!stream.current || !el || !element || !el.videoWidth) return null;

    // The captured tab frame maps to the viewport; scale CSS pixels to capture pixels.
    const scaleX = el.videoWidth / window.innerWidth;
    const scaleY = el.videoHeight / window.innerHeight;
    const rect = element.getBoundingClientRect();
    const sx = Math.max(0, rect.left * scaleX);
    const sy = Math.max(0, rect.top * scaleY);
    const sw = Math.min(el.videoWidth - sx, rect.width * scaleX);
    const sh = Math.min(el.videoHeight - sy, rect.height * scaleY);
    if (sw < 50 || sh < 50) return null;

    const outW = Math.min(maxWidth, Math.round(sw));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = Math.round((sh / sw) * outW);
    canvas.getContext("2d")!.drawImage(el, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1] ?? null;
  }, []);

  return { status, start, stop, grab };
}
