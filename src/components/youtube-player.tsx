"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type PlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  currentTime: () => number;
  duration: () => number;
  isPlaying: () => boolean;
};

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: object) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;
let apiReady: Promise<void> | null = null;

function loadApi() {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiReady;
}

export function YouTubePlayer({
  videoId,
  start,
  onStateChange,
  ref,
}: {
  videoId: string;
  start: number;
  onStateChange?: (playing: boolean) => void;
  ref: Ref<PlayerHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const onChange = useRef(onStateChange);
  useEffect(() => {
    onChange.current = onStateChange;
  });

  useEffect(() => {
    let cancelled = false;
    loadApi().then(() => {
      if (cancelled || !host.current || !window.YT) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new window.YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { start: Math.floor(start), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => onChange.current?.(e.data === PLAYING),
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
    // Recreating the player on `start` changes would restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    play: () => player.current?.playVideo(),
    pause: () => player.current?.pauseVideo(),
    seek: (s) => player.current?.seekTo(s, true),
    currentTime: () => player.current?.getCurrentTime?.() ?? 0,
    duration: () => player.current?.getDuration?.() ?? 0,
    isPlaying: () => player.current?.getPlayerState?.() === PLAYING,
  }));

  return <div ref={host} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&>iframe]:h-full [&>iframe]:w-full" />;
}
