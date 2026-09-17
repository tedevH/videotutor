"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type VimeoPlayerType from "@vimeo/player";
import type { PlayerHandle } from "@/components/youtube-player";

/** Vimeo embed behind the same handle as the YouTube player. Also streams caption cues to the tutor. */
export function VimeoPlayer({
  url,
  start,
  onStateChange,
  onCaption,
  ref,
}: {
  url: string;
  start: number;
  onStateChange?: (playing: boolean) => void;
  onCaption?: (text: string, at: number) => void;
  ref: Ref<PlayerHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<VimeoPlayerType | null>(null);
  // The Vimeo API is async; cache what the sync handle needs.
  const state = useRef({ time: start, duration: 0, playing: false });
  const callbacks = useRef({ onStateChange, onCaption });
  useEffect(() => {
    callbacks.current = { onStateChange, onCaption };
  });

  useEffect(() => {
    let cancelled = false;
    import("@vimeo/player").then(async ({ default: Player }) => {
      if (cancelled || !host.current) return;
      const p = new Player(host.current, { url: url as `https://vimeo.com/${string}`, responsive: true, dnt: true });
      player.current = p;
      p.on("timeupdate", (d) => {
        state.current.time = d.seconds;
        state.current.duration = d.duration;
      });
      p.on("play", () => {
        state.current.playing = true;
        callbacks.current.onStateChange?.(true);
      });
      p.on("pause", () => {
        state.current.playing = false;
        callbacks.current.onStateChange?.(false);
      });
      p.on("cuechange", (d) => {
        const text = d.cues.map((c) => c.text).join(" ").trim();
        if (text) callbacks.current.onCaption?.(text, state.current.time);
      });

      await p.ready().catch(() => null);
      if (start > 0) await p.setCurrentTime(start).catch(() => null);
      state.current.duration = await p.getDuration().catch(() => 0);
      // Turn on captions without showing them, so the tutor hears what the video says.
      const tracks = await p.getTextTracks().catch(() => []);
      const track = tracks.find((t) => t.language.startsWith("en")) ?? tracks[0];
      if (track) await p.enableTextTrack(track.language, track.kind, false).catch(() => null);
    });
    return () => {
      cancelled = true;
      player.current?.destroy().catch(() => null);
      player.current = null;
    };
    // Recreating the player on `start` changes would restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useImperativeHandle(ref, () => ({
    play: () => void player.current?.play().catch(() => null),
    pause: () => void player.current?.pause().catch(() => null),
    seek: (s) => {
      state.current.time = s;
      void player.current?.setCurrentTime(s).catch(() => null);
    },
    currentTime: () => state.current.time,
    duration: () => state.current.duration,
    isPlaying: () => state.current.playing,
  }));

  return <div ref={host} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&_iframe]:h-full [&_iframe]:w-full" />;
}
