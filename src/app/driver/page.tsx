'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, MapPin, Phone, CheckCircle2, Navigation, AlertCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './driver.module.css';

export default function DriverDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'driver') {
      router.push('/login');
      return;
    }

    fetchReadyOrders();
    
    const channel = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchReadyOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const fetchReadyOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['ready', 'out_for_delivery'])
      .order('created_at', { ascending: false });
    
    if (!error && data) setOrders(data);
  };

  const startRoute = async (order: any) => {
    setActiveOrder(order);
    setIsTracking(true);

    // Update status to 'out_for_delivery'
    await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', order.id);

    // Start GPS Tracking
    if ("geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await supabase.from('tracking_logs').insert([{
            order_id: order.id,
            lat: latitude,
            lng: longitude
          }]);
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
      setWatchId(id);
    }
  };

  const completeDelivery = async () => {
    if (!activeOrder || completing) return;
    setCompleting(true);

    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    const finish = async (lat?: number, lng?: number) => {
      try {
        await supabase.from('orders').update({ 
          status: 'delivered'
        }).eq('id', activeOrder.id);

        if (lat && lng) {
          await supabase.from('tracking_logs').insert([{
            order_id: activeOrder.id,
            lat,
            lng
          }]);
        }

        setCompleting(false);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setActiveOrder(null);
          setIsTracking(false);
        }, 3000);
      } catch (err) {
        console.error(err);
        setCompleting(false);
        alert('Erro ao finalizar pedido. Tente novamente.');
      }
    };

    // Try to capture final GPS position, but don't block if it fails
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => finish(position.coords.latitude, position.coords.longitude),
        () => finish(), // Fallback if GPS fails
        { timeout: 5000 }
      );
    } else {
      finish();
    }
  };

  const openInMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Truck className={styles.icon} />
          <h1>Painel do Motoboy</h1>
        </div>
        <button className={styles.logoutBtn} onClick={() => { localStorage.clear(); router.push('/login'); }}>
          <LogOut size={20} />
        </button>
      </header>

      <div className="container">
        {!activeOrder ? (
          <div className={styles.listSection}>
            <h2 className={styles.sectionTitle}>Entregas Disponíveis</h2>
            <div className={styles.orderList}>
              {orders.map(order => (
                <div key={order.id} className={styles.orderCard}>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderHead}>
                      <span className={styles.orderId}>#{order.id.slice(0, 5)}</span>
                      <span className={styles.readyBadge}>Pronto para Coleta</span>
                    </div>
                    <h3 className={styles.customerName}>{order.customer_name}</h3>
                    <p className={styles.addressText}><MapPin size={16} /> {order.address}</p>
                  </div>
                  <button 
                    onClick={() => startRoute(order)}
                    className={styles.btnStart}
                  >
                    Iniciar Rota
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.activeDelivery}
          >
            <div className={styles.activeHeader}>
              <h2>Entrega em Curso</h2>
              <div className={styles.pulseDot} />
            </div>

            <div className={styles.deliveryDetails}>
              <div className={styles.detailGroup}>
                <label>Cliente</label>
                <div className={styles.customerRow}>
                  <h3>{activeOrder.customer_name}</h3>
                  <a href={`tel:${activeOrder.customer_phone}`} className={styles.phoneBtn}>
                    <Phone size={20} /> Ligar
                  </a>
                </div>
              </div>

              <div className={styles.detailGroup}>
                <label>Endereço de Entrega</label>
                <p className={styles.activeAddress}>{activeOrder.address}</p>
                <button 
                  onClick={() => openInMaps(activeOrder.address)}
                  className={styles.btnNav}
                >
                  <Navigation size={20} /> Abrir no Google Maps
                </button>
              </div>

              <div className={styles.trackingStatus}>
                <AlertCircle size={20} />
                <span>Rastreamento GPS ativo para a cozinha</span>
              </div>

              <button 
                onClick={completeDelivery}
                className={styles.btnComplete}
                disabled={completing}
              >
                <CheckCircle2 size={24} /> 
                {completing ? 'Finalizando...' : 'Pedido Entregue'}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            className={styles.successOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={styles.successCard}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className={styles.pulseContainer}>
                <div className={styles.pulseRing} />
                <CheckCircle2 size={80} className={styles.successIcon} />
              </div>
              <h2>Pedido Entregue!</h2>
              <p>O status foi atualizado e a localização final registrada com sucesso.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
