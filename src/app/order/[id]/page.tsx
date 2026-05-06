'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, CheckCircle2, Package, Truck, Utensils, Phone, MapPin, User, ArrowLeft, AlertCircle, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './order.module.css';

const statuses = [
  { id: 'received', label: 'Pedido Recebido', icon: Package },
  { id: 'preparing', label: 'Em Preparo', icon: Utensils },
  { id: 'ready', label: 'Pedido Pronto', icon: CheckCircle2 },
  { id: 'waiting_driver', label: 'Aguardando Motoboy', icon: Clock },
  { id: 'out_for_delivery', label: 'Saiu para Entrega', icon: Truck },
  { id: 'delivered', label: 'Entregue', icon: CheckCircle2 },
];

function OrderSkeleton() {
  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.main}
    >
      <div className="container">
        <div className={styles.header}>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonIdentity} />
        </div>
        <div className={styles.statusSection}>
          <div className={styles.skeletonEstimated} />
          <div className={styles.skeletonTimeline}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        </div>
      </div>
    </motion.main>
  );
}

export default function OrderTracking() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single();
        
        if (!error && data) setOrder(data);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    const channel = supabase
      .channel(`order-status-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setOrder((prev: any) => ({ ...prev, status: 'cancelled' }));
          } else {
            setOrder(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <OrderSkeleton key="skeleton" />
      ) : !order ? (
        <motion.div 
          key="not-found"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="container py-20 text-center"
        >
          Pedido não encontrado.
        </motion.div>
      ) : (
        <motion.main 
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={styles.main}
        >
          <div className="container">
            <header className={styles.header}>
              <div className={styles.topNav}>
                <Link 
                  href={from === 'admin' ? '/admin' : from === 'driver' ? '/driver' : from === 'orders' ? '/menu?recovery=true' : '/'} 
                  className={styles.backLink}
                >
                  <ArrowLeft size={20} />
                  {from === 'admin' ? 'Painel Admin' : from === 'driver' ? 'Painel Motoboy' : from === 'orders' ? 'Meus Pedidos' : 'Cardápio'}
                </Link>
              </div>
              <motion.h1 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="font-serif"
              >
                Status do seu Pedido
              </motion.h1>
              <div className={styles.orderIdentity}>
                <p className={styles.orderId}># {order.id.slice(0, 8)}</p>
                <div className={styles.customerName}>
                  <User size={18} />
                  <span>{order.customer_name}</span>
                </div>
              </div>
            </header>

            <section className={styles.statusSection}>
              {order.status === 'cancelled' ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={styles.canceledCard}
                >
                  <AlertCircle size={48} color="#e11d48" />
                  <h2>Puxa! Seu pedido foi cancelado.</h2>
                  <p>Infelizmente o restaurante não pôde concluir seu pedido neste momento.</p>
                  <div className={styles.canceledActions}>
                    <Link href="/menu" className={styles.backToMenuBtn}>
                      Voltar ao Cardápio
                    </Link>
                    <a 
                      href="https://wa.me/5512991911546" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.supportCanceledBtn}
                    >
                      <MessageCircle size={20} />
                      Falar com Restaurante
                    </a>
                  </div>
                </motion.div>
              ) : (
                <>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={styles.estimatedCard}
                  >
                    <div className={styles.estimatedInfo}>
                      <Clock className={styles.clockIcon} size={32} />
                      <div>
                        <h3>Tempo estimado de preparo</h3>
                        <p className={styles.timeValue}>{order.estimated_time || 40} min</p>
                      </div>
                    </div>
                  </motion.div>

                  <div className={styles.timeline}>
                    {statuses.map((status, index) => {
                      const Icon = status.icon;
                      const currentIndex = (() => {
                        if (order.status === 'received') return 0;
                        if (order.status === 'preparing') return 1;
                        if (order.status === 'ready') return 2;
                        if (order.status === 'out_for_delivery') {
                          return order.driver_id ? 4 : 3;
                        }
                        if (order.status === 'delivered') return 5;
                        return -1;
                      })();

                      const isPast = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const isDelivered = status.id === 'delivered' && (isCurrent || isPast);

                      return (
                        <motion.div 
                          layout
                          key={status.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`${styles.statusItem} ${isPast ? styles.past : ''} ${isCurrent ? styles.current : ''} ${isDelivered ? styles.delivered : ''}`}
                        >
                          <div className={styles.statusIconWrapper}>
                            <Icon size={24} />
                            {index < statuses.length - 1 && <div className={styles.line} />}
                          </div>
                          <div className={styles.statusText}>
                            <p className={styles.statusLabel}>{status.label}</p>
                            {isCurrent && !isDelivered && (
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={styles.statusBadge}
                              >
                                Em andamento
                              </motion.p>
                            )}
                            {(isPast || isDelivered) && (
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={styles.statusBadge}
                              >
                                Concluído
                              </motion.p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Removido seções redundantes de endereço e suporte para um visual mais limpo */}
          </div>
        </motion.main>
      )}
    </AnimatePresence>
  );
}

