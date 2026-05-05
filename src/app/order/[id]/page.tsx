'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, CheckCircle2, Package, Truck, Utensils, Phone, MapPin, User, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './order.module.css';

const statuses = [
  { id: 'received', label: 'Pedido Recebido', icon: Package },
  { id: 'preparing', label: 'Em Preparo', icon: Utensils },
  { id: 'ready', label: 'Pedido Pronto', icon: CheckCircle2 },
  { id: 'out_for_delivery', label: 'Saiu para Entrega', icon: Truck },
  { id: 'delivered', label: 'Entregue', icon: CheckCircle2 },
];

export default function OrderTracking() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) setOrder(data);
      setLoading(false);
    };

    fetchOrder();

    // Subscribe to changes for this specific order
    const channel = supabase
      .channel(`order-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => setOrder(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) return <div className="container py-20 text-center">Carregando pedido...</div>;
  if (!order) return <div className="container py-20 text-center">Pedido não encontrado.</div>;

  const currentStatus = order.status;
  const estimatedTime = order.estimated_time || 40;

  const currentIndex = statuses.findIndex(s => s.id === currentStatus);

  return (
    <main className={styles.main}>
      <div className="container">
        <header className={styles.header}>
          <div className={styles.topNav}>
            <Link 
              href={from === 'admin' ? '/admin' : from === 'driver' ? '/driver' : '/'} 
              className={styles.backLink}
            >
              <ArrowLeft size={20} />
              {from === 'admin' ? 'Painel Admin' : from === 'driver' ? 'Painel Motoboy' : 'Cardápio'}
            </Link>
          </div>
          <h1 className="font-serif">Status do seu Pedido</h1>
          <div className={styles.orderIdentity}>
            <p className={styles.orderId}># {order.id.slice(0, 8)}</p>
            <div className={styles.customerName}>
              <User size={18} />
              <span>{order.customer_name}</span>
            </div>
          </div>
        </header>

        <section className={styles.statusSection}>
          <div className={styles.estimatedCard}>
            <div className={styles.estimatedInfo}>
              <Clock className={styles.clockIcon} size={32} />
              <div>
                <h3>Tempo estimado de preparo</h3>
                <p className={styles.timeValue}>{estimatedTime} min</p>
              </div>
            </div>
          </div>

          <div className={styles.timeline}>
            {statuses.map((status, index) => {
              const Icon = status.icon;
              const isPast = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isDelivered = status.id === 'delivered' && (isCurrent || isPast);

              return (
                <div key={status.id} className={`${styles.statusItem} ${isPast ? styles.past : ''} ${isCurrent ? styles.current : ''} ${isDelivered ? styles.delivered : ''}`}>
                  <div className={styles.statusIconWrapper}>
                    <Icon size={24} />
                    {index < statuses.length - 1 && <div className={styles.line} />}
                  </div>
                  <div className={styles.statusText}>
                    <p className={styles.statusLabel}>{status.label}</p>
                    {isCurrent && !isDelivered && <p className={styles.statusBadge}>Em andamento</p>}
                    {(isPast || isDelivered) && <p className={styles.statusBadge}>Concluído</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.detailsSection}>
          <div className={styles.card}>
            <h3>Detalhes da Entrega</h3>
            <div className={styles.detailRow}>
              <MapPin size={18} />
              <p>{order.address}</p>
            </div>
            <div className={styles.detailRow}>
              <Phone size={18} />
              <p>{order.customer_phone}</p>
            </div>
          </div>

          <div className={styles.card}>
            <h3>Suporte</h3>
            <p className={styles.supportText}>Algum problema com seu pedido?</p>
            <button className={styles.contactBtn}>
              Falar com o Restaurante
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
