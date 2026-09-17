"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onspeechstart: (() => void) | null;
};

/**
 * Push-to-talk speech input via the browser's Web Speech API (Chrome, Edge, Safari).
 * `onStart` fires as soon as the student starts talking, so the video can pause immediately.
 */
export function useSpeech(opts: { onStart: () => void; onFinal: (text: string) => void; onInterim: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const callbacks = useRef(opts);
  useEffect(() => {
    callbacks.current = opts;
  });

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onspeechstart = () => callbacks.current.onStart();
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) callbacks.current.onFinal(result[0].transcript.trim());
        else interim += result[0].transcript;
      }
      if (interim) callbacks.current.onInterim(interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    // Feature detection has to run in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
    return () => r.stop();
  }, []);

  const start = useCallback(() => {
    if (!recognition.current || listening) return;
    callbacks.current.onStart();
    recognition.current.start();
    setListening(true);
  }, [listening]);

  const stop = useCallback(() => recognition.current?.stop(), []);
  return { supported, listening, start, stop };
}
