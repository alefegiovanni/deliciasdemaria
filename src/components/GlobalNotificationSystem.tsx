'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GlobalNotificationSystem() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const lastOrderTimestampRef = useRef<string>(new Date().toISOString());
  const [isAdmin, setIsAdmin] = useState(false);

  // Sync admin status
  useEffect(() => {
    const checkAdmin = () => {
      const role = localStorage.getItem('user_role');
      setIsAdmin(role === 'admin');
    };
    
    checkAdmin();
    // Listen for storage changes (login/logout in other tabs or current tab)
    window.addEventListener('storage', checkAdmin);
    // Also check on a small interval as a fallback since navigation in the same tab 
    // doesn't always trigger 'storage' for the same window
    const interval = setInterval(checkAdmin, 2000);
    
    return () => {
      window.removeEventListener('storage', checkAdmin);
      clearInterval(interval);
    };
  }, []);

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

    console.log('[GlobalNotification] NEW ORDER SOUND:', newOrder.id);
    
    // SOUND ONLY - No visual alert globally as requested
    playBlip();

    if (newOrder.created_at > lastOrderTimestampRef.current) {
      lastOrderTimestampRef.current = newOrder.created_at;
    }
  }, [playBlip]);

  useEffect(() => {
    if (!isAdmin) return;

    console.log('[GlobalNotification] Admin detected, starting listeners...');

    // Unlock AudioContext on interaction
    const unlockAudio = () => {
      initAudio();
      // We don't remove the listener here because we want to keep it ready 
      // in case the browser suspends the context again
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Strategy 1: Supabase Realtime
    const channel = supabase
      .channel('global-order-notifications-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          handleNewOrder(payload.new);
        }
      )
      .subscribe();

    // Strategy 2: Fast Polling (1.5s) fallback
    let isMounted = true;
    let pollTimeout: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted) return;
      
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
      
      if (isMounted) {
        pollTimeout = setTimeout(poll, 1500);
      }
    };

    poll();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      clearTimeout(pollTimeout);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isAdmin, handleNewOrder, initAudio]);

  return null; // Sound only component
}
