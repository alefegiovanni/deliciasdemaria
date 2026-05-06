'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Store } from 'lucide-react';

export default function StoreClosedOverlay() {
  const [isOpen, setIsOpen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const pathname = usePathname();

  // Exclui rotas administrativas e de motorista do bloqueio
  const isExemptRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/login') || pathname?.startsWith('/driver');

  useEffect(() => {
    // Busca o status inicial
    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('is_open')
        .eq('id', 'delicias_maria')
        .single();
      
      if (!error && data) {
        setIsOpen(data.is_open ?? true);
      }
      setIsInitialized(true);
    };

    fetchStatus();

    // Inscreve-se para atualizações em tempo real EXCLUSIVAS da tabela settings
    // Isso garante que se a Maria fechar a loja, o aviso apareça em < 1s
    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'settings', 
        filter: 'id=eq.delicias_maria' 
      }, (payload) => {
        if (payload.new && 'is_open' in payload.new) {
          console.log('[REALTIME] Store status changed:', payload.new.is_open);
          setIsOpen(payload.new.is_open);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Não renderiza nada se for rota isenta ou se a loja estiver aberta
  if (isExemptRoute || !isInitialized || isOpen) return null;

  // Renderiza o modal de bloqueio global
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999, // Fica por cima de TUDO
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '2.5rem 1.5rem',
            width: '100%',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem',
            position: 'relative'
          }}>
            <Store size={40} color="#ef4444" />
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '24px',
              height: '24px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              border: '3px solid white'
            }}>
              <span style={{ fontSize: '14px', lineHeight: '14px' }}>✕</span>
            </div>
          </div>
          
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 800, 
            color: '#1f2937',
            margin: 0,
            lineHeight: 1.2
          }}>
            RESTAURANTE FECHADO
          </h2>
          
          <p style={{ 
            color: '#4b5563', 
            fontSize: '1rem',
            lineHeight: 1.5,
            margin: 0
          }}>
            No momento não estamos atendendo. Nossos horários se encerraram ou estamos em uma pausa.<br/><br/>
            <strong>Tente novamente mais tarde!</strong>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
