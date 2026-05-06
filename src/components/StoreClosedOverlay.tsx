'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function StoreClosedOverlay() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null); // null = loading
  const pathname = usePathname();
  const lastStatusRef = useRef<boolean | null>(null);

  // Admin, login, and driver routes are exempt from the block
  const isExemptRoute =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/driver');

  useEffect(() => {
    if (isExemptRoute) return;

    // Fetch store status immediately
    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('is_open')
          .eq('id', 'delicias_maria')
          .single();

        if (data) {
          const open = data.is_open ?? true;
          if (lastStatusRef.current !== open) {
            setIsOpen(open);
            lastStatusRef.current = open;
          }
        }
      } catch (err) {
        // Silent fail — next poll will retry
      }
    };

    // Initial fetch
    fetchStatus();

    // Fast poll every 1.5s — guaranteed to catch status changes within 1.5s
    // This is lightweight: single row, single column query
    const pollInterval = setInterval(fetchStatus, 1500);

    // Also try Supabase Realtime as a bonus (instant if configured)
    const channel = supabase
      .channel('store-status-global')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: 'id=eq.delicias_maria',
        },
        (payload) => {
          if (payload.new && 'is_open' in payload.new) {
            const open = payload.new.is_open as boolean;
            setIsOpen(open);
            lastStatusRef.current = open;
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [isExemptRoute]);

  // Don't render on exempt routes or while loading or when store is open
  if (isExemptRoute || isOpen === null || isOpen === true) return null;

  // FULL SCREEN BLOCKER
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647, // Maximum possible z-index
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        // Block ALL interactions underneath
        pointerEvents: 'all',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          borderRadius: '28px',
          padding: '48px 32px 40px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          animation: 'closedCardEntry 0.4s ease-out',
        }}
      >
        {/* Red circle with icon */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)',
          }}
        >
          <span style={{ fontSize: '48px', lineHeight: 1 }}>🚫</span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.625rem',
            fontWeight: 800,
            color: '#1a1a2e',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          RESTAURANTE FECHADO
        </h2>

        {/* Divider */}
        <div
          style={{
            width: '48px',
            height: '3px',
            background: 'linear-gradient(90deg, #ef4444, #f97316)',
            borderRadius: '2px',
            margin: '0 auto 20px',
          }}
        />

        {/* Message */}
        <p
          style={{
            color: '#6b7280',
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: '0 0 28px',
          }}
        >
          Não estamos atendendo no momento.
          <br />
          Tente novamente mais tarde!
        </p>

        {/* Subtle footer */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 20px',
            backgroundColor: '#f3f4f6',
            borderRadius: '100px',
            fontSize: '0.8rem',
            color: '#9ca3af',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'inline-block',
              animation: 'closedPulse 2s infinite',
            }}
          />
          Loja offline
        </div>
      </div>

      {/* CSS animations injected inline */}
      <style>{`
        @keyframes closedCardEntry {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(16px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes closedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
