'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, X } from 'lucide-react';

export default function GlobalNotificationSystem() {
  const [showAlert, setShowAlert] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const lastOrderTimestampRef = useRef<string>(new Date().toISOString());

  // Initialize and resume AudioContext
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playBlip = useCallback(() => {
    try {
      initAudio();
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;

      const playBeep = (time: number, freq: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.4);
      };

      const now = audioCtx.currentTime;
      playBeep(now, 880);
      playBeep(now + 0.15, 1046.50);
    } catch (err) {
      console.error('[GlobalNotification] Error playing sound:', err);
    }
  }, [initAudio]);

  const handleNewOrder = useCallback((newOrder: any) => {
    if (notifiedOrdersRef.current.has(newOrder.id)) return;
    notifiedOrdersRef.current.add(newOrder.id);

    console.log('[GlobalNotification] NEW ORDER:', newOrder.id);
    
    // SOUND
    playBlip();

    // VISUAL ALERT
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 8000);

    if (newOrder.created_at > lastOrderTimestampRef.current) {
      lastOrderTimestampRef.current = newOrder.created_at;
    }
  }, [playBlip]);

  useEffect(() => {
    // Only Maria (admin) needs to hear the blip globally
    const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
    if (role !== 'admin') return;

    // Unlock AudioContext on interaction
    const unlockAudio = () => {
      initAudio();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Strategy 1: Supabase Realtime
    const channel = supabase
      .channel('global-order-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          handleNewOrder(payload.new);
        }
      )
      .subscribe();

    // Strategy 2: Fast Polling (1.5s) fallback
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, created_at')
          .gt('created_at', lastOrderTimestampRef.current)
          .order('created_at', { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          [...data].reverse().forEach(order => handleNewOrder(order));
        }
      } catch (err) {
        // Silent fail
      }
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [handleNewOrder, initAudio]);

  return (
    <AnimatePresence>
      {showAlert && (
        <motion.div
          initial={{ opacity: 0, y: -100, x: '-50%' }}
          animate={{ opacity: 1, y: 20, x: '-50%' }}
          exit={{ opacity: 0, y: -100, x: '-50%' }}
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            zIndex: 2147483647,
            width: 'calc(100% - 40px)',
            maxWidth: '400px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '16px 20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            borderLeft: '6px solid #d44e6d'
          }}
          onClick={() => setShowAlert(false)}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: '#fff1f2',
            color: '#d44e6d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={24} />
          </div>
          
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: '#1a1a2e', fontSize: '1rem', fontWeight: 800 }}>
              NOVO PEDIDO!
            </h4>
            <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Um novo pedido acaba de chegar na cozinha.
            </p>
          </div>

          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#9ca3af',
              padding: '4px',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowAlert(false);
            }}
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
