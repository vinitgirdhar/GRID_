import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Loader2, Volume2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { askCopilot } from '../services/apiService';

// @ts-ignore - SpeechRecognition is not fully typed
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

type VoiceState = 'idle' | 'listening' | 'computing' | 'speaking' | 'error';

export default function VoicePilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  // Use a ref to track the latest transcript so the onend callback always has the current value
  const transcriptRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const voiceStateRef = useRef<VoiceState>('idle');

  // Keep refs in sync with state
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v => (v.lang.includes('en-US') || v.lang.includes('en-GB')) && v.name.includes('Google')
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      setVoiceState('idle');
    };
    utterance.onerror = () => {
      setVoiceState('idle');
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const sendToBackend = useCallback(async (queryText: string) => {
    if (!queryText.trim()) {
      setVoiceState('idle');
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
      setVoiceState('speaking');
      const fallback = "I couldn't reach my brain right now. Please check the backend server.";
      setAiResponse(fallback);
      speakText(fallback);
    }
  }, [speakText]);

  // Set up speech recognition ONCE
  useEffect(() => {
    if (!SpeechRecognition) return;

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
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
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
      // Use the ref, NOT the state, to avoid stale closure
      const finalText = transcriptRef.current;
      if (finalText.trim() && voiceStateRef.current === 'listening') {
        sendToBackend(finalText);
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
      } catch (e) {
        console.error(e);
      }
    } else {
      if (voiceState === 'listening') recognitionRef.current?.stop();
      if (voiceState === 'speaking') window.speechSynthesis.cancel();
      setVoiceState('idle');
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating AI Orb Button */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleMic(); }}
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-14 h-14 rounded-full flex items-center justify-center z-[60]"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title="GRID Voice Copilot"
      >
        {/* Pulsing Outer Rings */}
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
        {/* Core Orb */}
        <div className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300',
          voiceState === 'listening'
            ? 'bg-gradient-to-br from-[var(--danger)] to-rose-600 shadow-rose-500/40'
            : voiceState === 'speaking'
              ? 'bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] shadow-[var(--primary)]/40'
            : voiceState === 'computing'
              ? 'bg-gradient-to-br from-[var(--primary-dark)] to-purple-700 shadow-purple-500/30'
            : 'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]'
        )}>
          <Mic className={cn(
            'w-6 h-6 transition-all',
            (voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'computing')
              ? 'text-white'
              : 'text-[var(--text-primary)]'
          )} />
        </div>
      </motion.button>


      {/* Voice Assistant Overlay UI */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-40 right-6 md:bottom-24 md:right-8 w-80 bg-[var(--surface)] border border-[var(--border)] shadow-2xl rounded-2xl p-5 z-[60] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  voiceState === 'idle' ? "bg-slate-400" :
                  voiceState === 'error' ? "bg-[var(--danger)]" :
                  "bg-[var(--primary)] animate-pulse"
                )} />
                <span className="text-sm font-bold text-[var(--text-primary)]">GRID Pilot</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (voiceState === 'speaking') window.speechSynthesis.cancel();
                  if (voiceState === 'listening') recognitionRef.current?.stop();
                  setVoiceState('idle');
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="min-h-24 space-y-4">
              {/* User Transcript */}
              <div className="font-medium text-lg leading-snug text-[var(--text-primary)]">
                {transcript ? (
                  `"${transcript}"`
                ) : voiceState === 'listening' ? (
                  <span className="text-[var(--text-secondary)] italic">Listening...</span>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">Tap the mic to ask a question.</span>
                )}
              </div>

              {/* Status & Response */}
              <div className="pt-2">
                {voiceState === 'computing' && (
                  <div className="flex items-center gap-2 text-sm text-[var(--primary-dark)] font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing grid data...
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

            {/* Visualizer bars */}
            {(voiceState === 'listening' || voiceState === 'speaking') && (
              <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 px-2 pb-1 opacity-50">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ['20%', `${Math.random() * 100}%`, '20%'] }}
                    transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                    className={cn("flex-1 rounded-t-sm", voiceState === 'listening' ? "bg-[var(--danger)]" : "bg-[var(--primary)]")}
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
