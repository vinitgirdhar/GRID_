import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useOffline } from '../OfflineContext';
import { cn } from '../lib/utils';
import { askCopilot, postDriverSession } from '../services/apiService';

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as SpeechRecognitionWindow).SpeechRecognition ||
      (window as SpeechRecognitionWindow).webkitSpeechRecognition
    : undefined;

type VoiceState = 'idle' | 'listening' | 'computing' | 'speaking' | 'error';
type OfflineCommand = 'start-ride' | 'end-ride' | 'where-to-go';

function normalizeTranscript(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchOfflineCommand(text: string): OfflineCommand | null {
  const normalized = normalizeTranscript(text);

  if (normalized.includes('start ride') || normalized.includes('start trip')) {
    return 'start-ride';
  }

  if (
    normalized.includes('end ride') ||
    normalized.includes('stop ride') ||
    normalized.includes('finish ride')
  ) {
    return 'end-ride';
  }

  if (
    normalized.includes('where to go') ||
    normalized.includes('where should i go') ||
    normalized.includes('where next')
  ) {
    return 'where-to-go';
  }

  return null;
}

function dispatchPageNavigation(page: string) {
  window.dispatchEvent(new CustomEvent('grid-navigate-page', { detail: { page } }));
}

function dispatchSessionToggle(isLive: boolean, page?: string) {
  window.dispatchEvent(new CustomEvent('grid-driver-session-toggle', { detail: { isLive, page } }));
}

export default function VoicePilot() {
  const { isOnline } = useOffline();
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const transcriptRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const voiceStateRef = useRef<VoiceState>('idle');

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (voice) =>
          (voice.lang.includes('en-US') || voice.lang.includes('en-GB')) &&
          voice.name.includes('Google'),
      ) || voices.find((voice) => voice.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setVoiceState('idle');
    };

    utterance.onerror = () => {
      setVoiceState('idle');
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const executeOfflineCommand = useCallback(
    async (command: OfflineCommand) => {
      let response = '';

      switch (command) {
        case 'start-ride':
          dispatchSessionToggle(true, 'go-for-ride');
          await postDriverSession({ is_live: true });
          response = isOnline
            ? 'Ride started. Opening live ride opportunities now.'
            : 'You are offline. Recording trip locally and opening cached ride alerts.';
          break;
        case 'end-ride':
          dispatchSessionToggle(false, 'overview');
          await postDriverSession({ is_live: false });
          response = isOnline
            ? 'Ride ended. Returning to your dashboard.'
            : 'You are offline. Ending the trip locally and saving it to sync later.';
          break;
        case 'where-to-go':
          dispatchPageNavigation('where-next');
          response = isOnline
            ? 'Opening live demand guidance now.'
            : 'You are offline. Opening cached hotspot guidance.';
          break;
      }

      setVoiceState('speaking');
      setAiResponse(response);
      speakText(response);
    },
    [isOnline, speakText],
  );

  const sendToBackend = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) {
        setVoiceState('idle');
        return;
      }

      const offlineCommand = matchOfflineCommand(queryText);

      if (!isOnline && offlineCommand) {
        await executeOfflineCommand(offlineCommand);
        return;
      }

      setVoiceState('computing');

      try {
        const response = await askCopilot(queryText, new Date().toISOString());
        setVoiceState('speaking');
        setAiResponse(response.spoken_response);
        speakText(response.spoken_response);

        if (response.action?.type === 'navigate_to_zone') {
          const event = new CustomEvent('grid-copilot-navigate', {
            detail: { zoneId: response.action.payload },
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.error('Copilot API error:', error);

        if (offlineCommand) {
          await executeOfflineCommand(offlineCommand);
          return;
        }

        setVoiceState('speaking');
        const fallback = isOnline
          ? "I couldn't reach my brain right now. Please check the backend server."
          : 'You are offline. Try start ride, end ride, or where to go for local commands.';
        setAiResponse(fallback);
        speakText(fallback);
      }
    },
    [executeOfflineCommand, isOnline, speakText],
  );

  useEffect(() => {
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
      setAiResponse('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        finalTranscript += event.results[index][0].transcript;
      }
      setTranscript(finalTranscript);
      transcriptRef.current = finalTranscript;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        setVoiceState('error');
        setAiResponse(`Speech error: ${event.error}`);
        setTimeout(() => setVoiceState('idle'), 3000);
      }
    };

    recognition.onend = () => {
      const finalText = transcriptRef.current;
      if (finalText.trim() && voiceStateRef.current === 'listening') {
        void sendToBackend(finalText);
      } else if (voiceStateRef.current === 'listening') {
        setVoiceState('idle');
      }
    };

    recognitionRef.current = recognition;
  }, [sendToBackend]);

  const toggleMic = () => {
    if (!SpeechRecognition) {
      alert('Your browser does not support Voice Recognition. Try Chrome.');
      return;
    }

    if (voiceState === 'idle' || voiceState === 'error') {
      setIsOpen(true);
      setAiResponse('');
      setTranscript('');
      transcriptRef.current = '';
      try {
        recognitionRef.current?.start();
      } catch (error) {
        console.error(error);
      }
      return;
    }

    if (voiceState === 'listening') {
      recognitionRef.current?.stop();
    }
    if (voiceState === 'speaking') {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
    setIsOpen(false);
  };

  return (
    <>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleMic();
        }}
        className="fixed bottom-28 right-4 sm:right-6 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full flex items-center justify-center z-[60]"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title="GRID Voice Copilot"
      >
        {voiceState === 'listening' && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--danger)]"
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--danger)]"
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, delay: 0.3, repeat: Infinity, ease: 'easeOut' }}
            />
          </>
        )}
        {voiceState === 'speaking' && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-[var(--primary)]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        {voiceState === 'computing' && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-t-[var(--primary)] border-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ borderRadius: '100%' }}
          />
        )}
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300',
            voiceState === 'listening'
              ? 'bg-gradient-to-br from-[var(--danger)] to-rose-600 shadow-rose-500/40'
              : voiceState === 'speaking'
                ? 'bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] shadow-[var(--primary)]/40'
                : voiceState === 'computing'
                  ? 'bg-gradient-to-br from-[var(--primary-dark)] to-purple-700 shadow-purple-500/30'
                  : 'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]',
          )}
        >
          <Mic
            className={cn(
              'w-6 h-6 transition-all',
              voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'computing'
                ? 'text-white'
                : 'text-[var(--text-primary)]',
            )}
          />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-44 left-4 right-4 lg:left-auto lg:right-8 lg:bottom-24 w-auto lg:w-80 max-w-sm bg-[var(--surface)] border border-[var(--border)] shadow-2xl rounded-2xl p-5 z-[60] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    voiceState === 'idle'
                      ? 'bg-slate-400'
                      : voiceState === 'error'
                        ? 'bg-[var(--danger)]'
                        : 'bg-[var(--primary)] animate-pulse',
                  )}
                />
                <span className="text-sm font-bold text-[var(--text-primary)]">GRID Pilot</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (voiceState === 'speaking') {
                    window.speechSynthesis.cancel();
                  }
                  if (voiceState === 'listening') {
                    recognitionRef.current?.stop();
                  }
                  setVoiceState('idle');
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-24 space-y-4">
              <div className="font-medium text-lg leading-snug text-[var(--text-primary)]">
                {transcript ? (
                  `"${transcript}"`
                ) : voiceState === 'listening' ? (
                  <span className="text-[var(--text-secondary)] italic">Listening...</span>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">Tap the mic to ask a question.</span>
                )}
              </div>

              <div className="pt-2">
                {voiceState === 'computing' && (
                  <div className="flex items-center gap-2 text-sm text-[var(--primary-dark)] font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isOnline ? 'Analyzing grid data...' : 'Checking offline command...'}
                  </div>
                )}

                {(voiceState === 'speaking' || (voiceState === 'idle' && aiResponse)) && aiResponse && (
                  <div className="bg-[var(--primary)]/10 p-3 rounded-xl border border-[var(--primary)]/20">
                    <div className="flex items-center gap-2 text-[var(--accent)] font-bold mb-1 text-xs">
                      <Volume2 className="w-3 h-3" /> GRID says:
                    </div>
                    <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
                      {aiResponse}
                    </p>
                  </div>
                )}

                {voiceState === 'error' && (
                  <p className="text-sm text-[var(--danger)] font-bold">
                    {aiResponse || "Sorry, I didn't catch that. Try again."}
                  </p>
                )}
              </div>
            </div>

            {(voiceState === 'listening' || voiceState === 'speaking') && (
              <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 px-2 pb-1 opacity-50">
                {[...Array(20)].map((_, index) => (
                  <motion.div
                    key={index}
                    animate={{ height: ['20%', `${Math.random() * 100}%`, '20%'] }}
                    transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                    className={cn('flex-1 rounded-t-sm', voiceState === 'listening' ? 'bg-[var(--danger)]' : 'bg-[var(--primary)]')}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
