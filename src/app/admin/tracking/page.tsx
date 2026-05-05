'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map as MapIcon, User, Navigation, CheckCircle2, ChevronLeft, MapPin, LogOut, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './tracking.module.css';

export default function AdminTracking() {
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showAddress, setShowAddress] = useState(false);
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
      .select('id, customer_name, status, address, driver_id')
      .eq('status', 'out_for_delivery');

    if (activeOrders && activeOrders.length > 0) {
      const driverLocations = await Promise.all(
        activeOrders.map(async (order) => {
          // Fetch driver name
          let driverName = `Pedido #${order.id.slice(0,5)}`;
          if (order.driver_id) {
            const { data: driverData } = await supabase.from('drivers').select('name').eq('id', order.driver_id).single();
            if (driverData) driverName = driverData.name;
          }

          const { data: logs } = await supabase
            .from('tracking_logs')
            .select('*')
            .eq('order_id', order.id)
            .order('timestamp', { ascending: false })
            .limit(1);
          
          if (logs && logs.length > 0) {
            return {
              id: order.id,
              orderId: order.id.slice(0, 5),
              name: driverName,
              customer: order.customer_name,
              address: order.address,
              lat: logs[0].lat,
              lng: logs[0].lng,
              location: `${logs[0].lat.toFixed(4)}, ${logs[0].lng.toFixed(4)}`,
              status: 'Em Rota'
            };
          }
          return null;
        })
      );
      const filtered = driverLocations.filter(d => d !== null);
      setDrivers(filtered);
      
      // Keep selection if it exists
      if (selectedDriver) {
        const stillActive = filtered.find(d => d.id === selectedDriver.id);
        if (stillActive) setSelectedDriver(stillActive);
      }
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
        <h1>Rastreamento de Pedidos</h1>
      </header>

      <div className={styles.container}>
        <div className={styles.sidebar}>
          <h3>Entregas em Rota</h3>
          <div className={styles.driverList}>
            {drivers.map(driver => (
              <div 
                key={driver.id} 
                className={`${styles.driverCard} ${selectedDriver?.id === driver.id ? styles.active : ''}`}
                onClick={() => setSelectedDriver(driver)}
              >
                <div className={styles.driverInfo}>
                  <div className={styles.avatar}><Truck size={20} /></div>
                  <div>
                    <strong>{driver.name}</strong>
                    <p>{driver.status} - Pedido #{driver.orderId}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedDriver && selectedDriver.orderId !== '-' && (
            <div className={styles.orderDetails}>
              <h4>Detalhes da Entrega</h4>
              
              <button 
                className={styles.btnShowAddress}
                onClick={() => setShowAddress(!showAddress)}
              >
                <MapPin size={18} />
                {showAddress ? 'Ocultar Endereço' : 'Ver Endereço de Entrega'}
              </button>

              {showAddress && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={styles.addressBox}
                >
                  <p>{selectedDriver.address}</p>
                </motion.div>
              )}

              <div className={styles.detailRow} style={{ marginTop: '1rem' }}>
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
            <p>Mapa de Rastreamento em Tempo Real</p>
            <span>Aguardando sinal de GPS do Motoboy...</span>
            
            <div className={styles.mapGrid}>
              <div className={styles.restaurantePoint}>
                <div className={styles.label}>Restaurante</div>
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
