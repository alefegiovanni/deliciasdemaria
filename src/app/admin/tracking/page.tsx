'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map as MapIcon, User, Navigation, CheckCircle2, ChevronLeft, MapPin, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './tracking.module.css';

export default function AdminTracking() {
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'admin') {
      router.push('/login');
      return;
    }

    fetchActiveTracking();

    const channel = supabase
      .channel('realtime-tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tracking_logs' },
        () => fetchActiveTracking()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => fetchActiveTracking()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveTracking = async () => {
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, customer_name, status, address')
      .eq('status', 'out_for_delivery');

    if (activeOrders && activeOrders.length > 0) {
      const driverLocations = await Promise.all(
        activeOrders.map(async (order) => {
          const { data: logs } = await supabase
            .from('tracking_logs')
            .select('*')
            .eq('order_id', order.id)
            .order('timestamp', { ascending: false })
            .limit(1);
          
          if (logs && logs.length > 0) {
            return {
              id: order.id,
              name: `Pedido #${order.id.slice(0,5)}`,
              customer: order.customer_name,
              address: order.address,
              lat: logs[0].lat,
              lng: logs[0].lng,
              status: 'Em Rota'
            };
          }
          return null;
        })
      );
      setDrivers(driverLocations.filter(d => d !== null));
    } else {
      setDrivers([]);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <button onClick={() => window.location.href = '/admin'} className={styles.backBtn}>
          <ChevronLeft /> Voltar ao Painel
        </button>
        <h1>Rastreamento em Tempo Real</h1>
      </header>

      <div className={styles.container}>
        <div className={styles.sidebar}>
          <h3>Motoboys Ativos</h3>
          <div className={styles.driverList}>
            {drivers.map(driver => (
              <div 
                key={driver.id} 
                className={`${styles.driverCard} ${selectedDriver?.id === driver.id ? styles.active : ''}`}
                onClick={() => setSelectedDriver(driver)}
              >
                <div className={styles.driverInfo}>
                  <div className={styles.avatar}><User size={20} /></div>
                  <div>
                    <strong>{driver.name}</strong>
                    <p>{driver.status}</p>
                  </div>
                </div>
                {driver.orderId !== '-' && <span className={styles.orderBadge}>#{driver.orderId}</span>}
              </div>
            ))}
          </div>

          {selectedDriver && selectedDriver.orderId !== '-' && (
            <div className={styles.orderDetails}>
              <h4>Detalhes da Entrega</h4>
              <div className={styles.detailRow}>
                <MapPin size={16} />
                <span>Destino: {selectedDriver.address}</span>
              </div>
              <div className={styles.detailRow}>
                <Navigation size={16} />
                <span>Localização Atual: {selectedDriver.location}</span>
              </div>
              <div className={styles.gpsVerification}>
                <CheckCircle2 size={16} />
                <span>GPS sincronizado</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.mapArea}>
          <div className={styles.mapPlaceholder}>
            <div className={styles.mapIcon}><MapIcon size={64} /></div>
            <p>Mapa de Rastreamento Interno</p>
            <span>Aguardando sinal de GPS do Motoboy...</span>
            
            {/* Visual simulation of the map */}
            <div className={styles.mapGrid}>
              <div className={styles.restaurantePoint}>
                <div className={styles.label}>Delícias de Maria</div>
              </div>
              {selectedDriver && selectedDriver.orderId !== '-' && (
                <div className={styles.motoboyPoint}>
                  <div className={styles.label}>Motoboy: {selectedDriver.name}</div>
                </div>
              )}
              <div className={styles.destinatarioPoint}>
                <div className={styles.label}>Cliente: {selectedDriver?.customer || 'Aguardando...'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
