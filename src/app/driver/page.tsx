'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, MapPin, Phone, CheckCircle2, Navigation, AlertCircle, LogOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './driver.module.css';

export default function DriverDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [currentDriver, setCurrentDriver] = useState<any | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initSession = async () => {
      fetchDrivers();

      // Se houver um token (link único), fazemos o login automático por ele
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (token) {
        const { data } = await supabase.from('drivers').select('*').eq('id', token).single();
        if (data) {
          if (!data.active) {
            alert('Sua conta está bloqueada.');
            return;
          }
          setCurrentDriver(data);
          localStorage.setItem('delicias_driver', JSON.stringify(data));
          window.history.replaceState({}, document.title, '/driver');
        }
      } else {
        // Se não houver token, tentamos carregar a sessão salva para evitar re-seleção ao atualizar
        const saved = localStorage.getItem('delicias_driver');
        if (saved) {
          try {
            setCurrentDriver(JSON.parse(saved));
          } catch (e) {
            localStorage.removeItem('delicias_driver');
          }
        }
      }
      fetchReadyOrders();
    };

    initSession();
    
    // Strategy 1: Realtime (Instant if connection is stable)
    const channelOrders = supabase
      .channel('driver-orders-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchReadyOrders())
      .subscribe();

    // Strategy 2: Fast Polling (1.5s) - Essential for Mobile reliability
    const pollInterval = setInterval(() => fetchReadyOrders(), 1500);

    // Listen for driver status changes (Blocking)
    let channelStatus: any;
    if (currentDriver) {
      channelStatus = supabase
        .channel(`driver-status-${currentDriver.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${currentDriver.id}` }, 
          (payload: any) => {
            if (payload.new && !payload.new.active) {
              localStorage.clear();
              alert('Sua conta foi desativada. Entre em contato com a administração.');
              router.push('/login');
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channelOrders);
      clearInterval(pollInterval);
      if (channelStatus) supabase.removeChannel(channelStatus);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId, currentDriver]);

  const fetchDrivers = async () => {
    const { data } = await supabase.from('drivers').select('*').eq('active', true).order('name');
    if (data) setAllDrivers(data);
  };

  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [tempDriver, setTempDriver] = useState<any>(null);

  const selectDriver = (driver: any) => {
    setTempDriver(driver);
    setPinInput('');
    setShowPinModal(true);
  };

  const verifyPin = () => {
    if (tempDriver && (pinInput === tempDriver.pin || !tempDriver.pin)) {
      setCurrentDriver(tempDriver);
      localStorage.setItem('delicias_driver', JSON.stringify(tempDriver));
      setShowPinModal(false);
    } else {
      alert('PIN Incorreto! Verifique com a administração.');
      setPinInput('');
    }
  };

  const currentDriverRef = useRef(currentDriver);
  useEffect(() => {
    currentDriverRef.current = currentDriver;
  }, [currentDriver]);

  const fetchReadyOrders = async () => {
    try {
      const driver = currentDriverRef.current;
      
      if (!driver || !driver.id) {
        setOrders([]);
        return;
      }

      setIsFetching(true);

      // 1. Fetch ALL orders assigned to this specific driver that are ready/in route
      const { data: allAssigned, error: errAvail } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', driver.id)
        .in('status', ['out_for_delivery', 'dispatched']) // Support both legacy and new status
        .order('created_at', { ascending: false });

      if (!errAvail && allAssigned) {
        // 2. Identify if there's an active delivery (already picked up or being tracked)
        // For now, we assume the driver can only have ONE active delivery at a time.
        // We'll check if they are already tracking one in the state.
        
        // If we don't have an activeOrder in state, but the DB says we have one in 'out_for_delivery'
        // we should check if it's already "accepted" or just "assigned".
        // Logic: Maria assigns -> it's in the "Ready" list. Driver clicks "Confirmar" -> it's "Active".
        
        // For simplicity: The list shows EVERYTHING assigned to them.
        // We filter out the one that is currently active in the UI.
        setOrders(allAssigned.filter(o => o.id !== activeOrder?.id));

        // 3. Auto-recovery: If we have an assigned order but no activeOrder state, 
        // and we were previously tracking something (or just refreshed), we could auto-resume.
        // But let's keep it simple: the driver sees their assigned orders and confirms pickup.
      }
    } catch (err) {
      console.error('[fetchReadyOrders] Error:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const startGpsTracking = (orderId: string) => {
    if ("geolocation" in navigator && !watchId) {
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await supabase.from('tracking_logs').insert([{
            order_id: orderId,
            lat: latitude,
            lng: longitude
          }]);
        },
        (error) => console.error('GPS Error:', error),
        { enableHighAccuracy: true }
      );
      setWatchId(id);
    }
  };

  useEffect(() => {
    if (activeOrder && isTracking) {
      startGpsTracking(activeOrder.id);
    } else if (!activeOrder && watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [activeOrder, isTracking]);

  const acceptOrder = async (orderId: string) => {
    if (!currentDriver) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: 'out_for_delivery',
          driver_id: currentDriver.id 
        })
        .eq('id', orderId)
        .eq('driver_id', currentDriver.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('Este pedido não está mais disponível ou não foi atribuído a você.');
      } else {
        const accepted = data[0];
        setActiveOrder(accepted);
        setIsTracking(true);
        // GPS tracking will start via the useEffect watching [activeOrder, isTracking]
      }
    } catch (err: any) {
      console.error('[acceptOrder] Error:', err);
      alert('Erro ao aceitar pedido: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      fetchReadyOrders();
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
        <button className={styles.logoutBtn} onClick={() => { 
          localStorage.removeItem('delicias_driver'); 
          setCurrentDriver(null); 
        }}>
          <LogOut size={20} /> Sair
        </button>
      </header>

      <div className="container">
        {!currentDriver ? (
          <div className={styles.selectionScreen}>
            <h2 className={styles.sectionTitle}>Quem é você?</h2>
            <p>Selecione seu nome para começar</p>
            <div className={styles.driverGrid}>
              {allDrivers.map(d => (
                <button key={d.id} className={styles.driverBtn} onClick={() => selectDriver(d)}>
                  {d.name}
                </button>
              ))}
              {allDrivers.length === 0 && <p className={styles.emptyMsg}>Aguardando cadastro de motoboys...</p>}
            </div>
          </div>
        ) : !activeOrder ? (
          <div className={styles.listSection}>
            <div className={styles.driverWelcome}>
              <span>Motoboy: <strong>{currentDriver.name}</strong></span>
              <button onClick={() => { localStorage.removeItem('delicias_driver'); setCurrentDriver(null); }} className={styles.changeBtn}>
                Trocar
              </button>
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: '#d44e6d', 
              marginBottom: '1rem', 
              padding: '8px', 
              background: '#fff1f2', 
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              Sincronização: {orders.length} pedidos encontrados | Última atualização: {new Date().toLocaleTimeString()}
            </div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Seus Pedidos para Retirar</h2>
              <button 
                onClick={() => fetchReadyOrders()} 
                className={`${styles.refreshBtn} ${isFetching ? styles.spinning : ''}`}
                disabled={isFetching}
              >
                <RotateCcw size={18} />
              </button>
            </div>
            <div className={styles.orderList}>
              {orders.map(order => (
                <div key={order.id} className={styles.orderCard}>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderHead}>
                      <span className={styles.orderId}>#{order.id.slice(0, 5)}</span>
                      <span className={styles.readyBadge}>Pode Retirar</span>
                    </div>
                    <h3 className={styles.customerName}>{order.customer_name}</h3>
                    <p className={styles.addressText}><MapPin size={16} /> {order.address}</p>
                  </div>
                  <button onClick={() => acceptOrder(order.id)} className={styles.btnStart}>
                    Confirmar Retirada
                  </button>
                </div>
              ))}
              {orders.length === 0 && (
                <div className={styles.emptyState}>
                  <AlertCircle size={48} />
                  <p>Você não tem pedidos atribuídos no momento.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.activeDelivery}
          >
            <div className={styles.deliveryHeader}>
              <span className={styles.deliveryBadge}>Entrega em Curso</span>
              <h1 className={styles.customerMain}>{activeOrder.customer_name}</h1>
              <a href={`tel:${activeOrder.customer_phone}`} style={{ 
                color: '#e11d48', 
                fontWeight: 700, 
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <Phone size={20} /> Ligar para Cliente
              </a>
            </div>

            <div className={styles.deliveryAddress}>
              <div className={styles.addressIcon}>
                <MapPin size={24} />
              </div>
              <div className={styles.addressDetails}>
                <div className={styles.addressTitle}>Endereço de Entrega</div>
                <div className={styles.addressLine}>{activeOrder.address}</div>
              </div>
            </div>

            <div className={styles.deliveryActions}>
              <button 
                onClick={() => openInMaps(activeOrder.address)}
                className={styles.btnMaps}
              >
                <Navigation size={22} /> Navegar com Google Maps
              </button>

              <button 
                onClick={completeDelivery}
                className={styles.btnComplete}
                disabled={completing}
              >
                <CheckCircle2 size={24} /> 
                {completing ? 'Finalizando...' : 'Confirmar Entrega Realizada'}
              </button>
            </div>

            <div style={{ 
              marginTop: '2rem', 
              textAlign: 'center', 
              fontSize: '0.85rem', 
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
              Rastreamento GPS ativo para a Maria
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

      <AnimatePresence>
        {showPinModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={styles.pinCard}
            >
              <h3>Acesso de Motoboy</h3>
              <p>Olá <strong>{tempDriver?.name}</strong>, digite seu PIN de 4 dígitos:</p>
              
              <input 
                type="password" 
                maxLength={4}
                inputMode="numeric"
                value={pinInput}
                onFocus={(e) => {
                  // Senior: Ensures input is visible when keyboard opens
                  setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className={styles.pinInput}
                autoFocus
              />

              <div className={styles.pinActions}>
                <button onClick={() => setShowPinModal(false)} className={styles.btnCancel}>Cancelar</button>
                <button 
                  onClick={verifyPin} 
                  className={styles.btnConfirm}
                  disabled={pinInput.length < 4}
                >
                  Acessar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
