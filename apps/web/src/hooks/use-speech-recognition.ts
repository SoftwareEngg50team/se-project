"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type UseSpeechRecognitionOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
};

type UseSpeechRecognitionResult = {
  isSupported: boolean;
  isListening: boolean;
  liveTranscript: string;
  finalTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const {
    lang = "hi-IN",
    continuous = true,
    interimResults = true,
  } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognitionImpl =
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      const message = event.error ? `Speech recognition error: ${event.error}` : "Speech recognition failed";
      setError(message);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalTextChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalTextChunk += `${transcript} `;
        } else {
          interim += transcript;
        }
      }

      if (finalTextChunk.trim()) {
        setFinalTranscript((current) => `${current} ${finalTextChunk}`.trim());
      }
      setLiveTranscript(interim.trim());
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    try {
      setLiveTranscript("");
      recognitionRef.current.start();
    } catch {
      setError("Unable to start microphone listening");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setLiveTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    liveTranscript,
    finalTranscript,
    error,
    start,
    stop,
    reset,
  };
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
    error?: string;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start: () => void;
    stop: () => void;
  }
}
