'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronRight } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    const checkActiveOrder = async () => {
      const lastId = localStorage.getItem('last_order_id');
      if (lastId) {
        const { data } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', lastId)
          .single();
        
        if (data && data.status !== 'delivered' && data.status !== 'cancelled') {
          setActiveOrderId(data.id);

          const channel = supabase
            .channel(`public:orders:id=eq.${data.id}`)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'orders', 
              filter: `id=eq.${data.id}` 
            }, (payload: any) => {
              if (payload.new.status === 'delivered' || payload.new.status === 'cancelled') {
                setActiveOrderId(null);
                localStorage.removeItem('last_order_id');
                supabase.removeChannel(channel);
              }
            })
            .subscribe();
          
          return channel;
        }
      }
      return null;
    };
    
    let trackingChannel: any;
    checkActiveOrder().then(channel => {
      trackingChannel = channel;
    });

    return () => {
      if (trackingChannel) supabase.removeChannel(trackingChannel);
    };
  }, []);

  const testimonials = [
    {
      name: "Ana Paula",
      text: "O tempero da Maria é inigualável! Lembra muito a comida da minha avó. Sempre fresquinha e muito saborosa.",
      rating: 5
    },
    {
      name: "Carlos Eduardo",
      text: "Melhor marmita de Caçapava. A entrega é rápida e a comida chega quentinha. Super recomendo!",
      rating: 5
    },
    {
      name: "Juliana Silva",
      text: "Qualidade nota 10. Os ingredientes são de primeira e o sabor é maravilhoso. Não troco por nada!",
      rating: 5
    }
  ];

  return (
    <main className={styles.main}>
      {/* 1️⃣ Seção Hero (Cinematográfica) */}
      <section className={styles.hero}>
        <div className={styles.videoBackground}>
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className={styles.bgVideo}
          >
            <source src="/bg-video.mp4" type="video/mp4" />
          </video>
          <div className={styles.videoOverlay} />
        </div>

        <div className={styles.heroContent}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className={styles.heroTitle}>Sua refeição diária, com a qualidade <span>Delícias de Maria</span></h2>
            <p className={`${styles.heroSubtitle} notranslate`} translate="no">
              Refeições variadas e saborosas preparadas para garantir praticidade e nutrição no seu dia a dia.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className={styles.btnOrderNow}
                onClick={() => router.push('/menu')}
              >
                Ver Cardápio do Dia
              </button>
              
              <button 
                className={styles.btnTrackOrder}
                onClick={() => router.push('/menu?recovery=true')}
              >
                Acompanhar Pedido
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2️⃣ Seção de Depoimentos (Carrossel) */}
      <section className={styles.testimonialsSection}>
        <div className={styles.testimonialContainer}>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className={styles.sectionHeader}
          >
            <h3>O que nossos clientes dizem</h3>
            <div className={styles.divider}></div>
          </motion.div>

          <div className={styles.carouselTrack}>
            <motion.div 
              className={styles.carouselInner}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ 
                duration: 20, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              {[...testimonials, ...testimonials].map((t, idx) => (
                <div key={idx} className={styles.testimonialCard}>
                  <div className={styles.stars}>{"★".repeat(t.rating)}</div>
                  <p>"{t.text}"</p>
                  <span className={styles.clientName}>{t.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3️⃣ Footer Profissional */}
      <footer className={styles.footerLanding}>
        <div className={styles.footerContentLanding}>
           <div className={styles.footerInfo}>
             <h4>Delícias de Maria</h4>
             <p>© 2026 - O verdadeiro sabor caseiro</p>
           </div>
           <button onClick={() => router.push('/login')} className={styles.adminAccessBtn}>
             Acesso Restrito
           </button>
        </div>
      </footer>

      {/* Recovery Badge (Floating everywhere) */}
      <AnimatePresence>
        {activeOrderId && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={styles.recoveryBadge}
            onClick={() => router.push(`/order/${activeOrderId}`)}
          >
            <div className={styles.recoveryInfo}>
              <div className={styles.pulseContainerSmall}>
                <div className={styles.pulseDotSmall} />
              </div>
              <div>
                <strong>Pedido em andamento!</strong>
                <p>Clique para acompanhar a entrega</p>
              </div>
            </div>
            <ChevronRight size={20} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
