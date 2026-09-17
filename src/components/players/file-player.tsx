"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import type { PlayerHandle } from "@/components/youtube-player";

/** A plain HTML5 video for direct files, behind the same handle as the other players. */
export function FilePlayer({
  src,
  start,
  onStateChange,
  ref,
}: {
  src: string;
  start: number;
  onStateChange?: (playing: boolean) => void;
  ref: Ref<PlayerHandle>;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    play: () => void video.current?.play().catch(() => null),
    pause: () => video.current?.pause(),
    seek: (s) => {
      if (video.current) video.current.currentTime = s;
    },
    currentTime: () => video.current?.currentTime ?? 0,
    duration: () => (Number.isFinite(video.current?.duration) ? video.current!.duration : 0),
    isPlaying: () => !!video.current && !video.current.paused && !video.current.ended,
  }));

  return (
    <video
      ref={video}
      src={`${src}#t=${Math.floor(start)}`}
      controls
      playsInline
      preload="metadata"
      onPlay={() => onStateChange?.(true)}
      onPause={() => onStateChange?.(false)}
      className="aspect-video w-full rounded-xl bg-black"
    />
  );
}
