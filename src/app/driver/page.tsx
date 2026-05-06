'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, MapPin, Phone, CheckCircle2, Navigation, AlertCircle, LogOut } from 'lucide-react';
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
          sessionStorage.setItem('delicias_driver', JSON.stringify(data));
          window.history.replaceState({}, document.title, '/driver');
        }
      } 
      // Se não houver token, não carregamos o driver do sessionStorage automaticamente
      // para forçar a seleção do nome no Portal Geral da Equipe toda vez que o link for aberto.
      
      fetchReadyOrders();
    };

    initSession();
    
    const channelOrders = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchReadyOrders())
      .subscribe();

    // Listen for driver status changes (Blocking)
    let channelStatus: any;
    if (currentDriver) {
      channelStatus = supabase
        .channel(`driver-status-${currentDriver.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${currentDriver.id}` }, 
          (payload: any) => {
            if (payload.new && !payload.new.active) {
              sessionStorage.clear();
              alert('Sua conta foi desativada. Entre em contato com a administração.');
              router.push('/login');
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channelOrders);
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
      sessionStorage.setItem('delicias_driver', JSON.stringify(tempDriver));
      setShowPinModal(false);
    } else {
      alert('PIN Incorreto! Verifique com a administração.');
      setPinInput('');
    }
  };

  const fetchReadyOrders = async () => {
    if (!currentDriver) return;

    // 1. Double check if driver is still active
    const { data: check } = await supabase.from('drivers').select('active').eq('id', currentDriver.id).single();
    if (check && !check.active) {
      sessionStorage.clear();
      router.push('/login');
      return;
    }

    // 2. Fetch available orders (dispatched = ready and sent to delivery pool)
    const { data: available } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'dispatched')
      .is('driver_id', null)
      .order('created_at', { ascending: false });

    // 3. Fetch current driver's active order
    const { data: myActive } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'out_for_delivery')
      .eq('driver_id', currentDriver.id)
      .maybeSingle();

    if (available) setOrders(available);

    if (myActive) {
      setActiveOrder(myActive);
      setIsTracking(true);
      if (!watchId) startGpsTracking(myActive.id);
    } else {
      setActiveOrder(null);
      setIsTracking(false);
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
    }
  };

  const startGpsTracking = (orderId: string) => {
    if ("geolocation" in navigator) {
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

  const acceptOrder = async (orderId: string) => {
    if (!currentDriver) return;
    
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'out_for_delivery',
        driver_id: currentDriver.id 
      })
      .eq('id', orderId)
      .is('driver_id', null)
      .select();

    if (error || !data || data.length === 0) {
      alert('Este pedido já foi pego por outro motoboy!');
    } else {
      const accepted = data[0];
      setActiveOrder(accepted);
      setIsTracking(true);
      startGpsTracking(accepted.id);
    }
    fetchReadyOrders();
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
          sessionStorage.removeItem('delicias_driver'); 
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
              <button onClick={() => { sessionStorage.removeItem('delicias_driver'); setCurrentDriver(null); }} className={styles.changeBtn}>
                Trocar
              </button>
            </div>
            <h2 className={styles.sectionTitle}>Entregas Disponíveis</h2>
            <div className={styles.orderList}>
              {orders.filter(o => !o.driver_id).map(order => (
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
                    Aceitar Entrega
                  </button>
                </div>
              ))}
              {orders.filter(o => !o.driver_id).length === 0 && (
                <div className={styles.emptyState}>
                  <AlertCircle size={48} />
                  <p>Sem pedidos prontos agora.</p>
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
                <button 
                  className={styles.btnShowAddress}
                  onClick={() => setShowAddress(!showAddress)}
                >
                  <MapPin size={18} />
                  {showAddress ? 'Ocultar Endereço' : 'Ver Endereço Completo'}
                </button>

                <AnimatePresence>
                  {showAddress && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={styles.addressBox}
                    >
                      <p className={styles.activeAddress}>{activeOrder.address}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

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
