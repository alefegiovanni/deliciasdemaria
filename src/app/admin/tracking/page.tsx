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

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any>({});
  const [polyline, setPolyline] = useState<any>(null);

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

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (leafletLoaded && !map) {
      const L = (window as any).L;
      const mapInstance = L.map('map-container', {
        scrollWheelZoom: false, // Evita zoom acidental ao rolar a página
        touchZoom: 'center',
        dragging: !L.Browser.mobile // Desativa arrasto no mobile para permitir o scroll da página (o usuário pode reativar ou usar o zoom manual)
      }).setView([-23.5505, -46.6333], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance);

      // Fix marker icon issues
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      setMap(mapInstance);
    }
  }, [leafletLoaded]);

  // Update Map when driver selection or data changes
  useEffect(() => {
    if (!map || !leafletLoaded) return;
    const L = (window as any).L;

    // Remove old markers and polyline
    Object.values(markers).forEach((m: any) => map.removeLayer(m));
    if (polyline) map.removeLayer(polyline);

    if (selectedDriver) {
      const pos: [number, number] = [selectedDriver.lat, selectedDriver.lng];
      
      // Update view
      map.setView(pos, 16);

      // Add Motoboy Marker
      const motoboyIcon = L.divIcon({
        className: styles.motoboyMarker,
        html: `<div class="${styles.markerPulse}"></div><div class="${styles.markerIcon}">🏍️</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const mMarker = L.marker(pos, { icon: motoboyIcon })
        .addTo(map)
        .bindPopup(`<strong>Motoboy: ${selectedDriver.name}</strong><br>Pedido #${selectedDriver.orderId}`)
        .openPopup();

      setMarkers({ [selectedDriver.id]: mMarker });

      // Fetch path history for polyline
      const fetchHistory = async () => {
        const { data: logs } = await supabase
          .from('tracking_logs')
          .select('lat, lng')
          .eq('order_id', selectedDriver.id)
          .order('timestamp', { ascending: true })
          .limit(50);
        
        if (logs && logs.length > 1) {
          const path = logs.map((l: any) => [l.lat, l.lng]);
          const line = L.polyline(path, { 
            color: '#9b59b6', // Roxo solicitado
            weight: 6, 
            opacity: 0.8, 
            smoothFactor: 1,
            lineJoin: 'round'
          }).addTo(map);
          setPolyline(line);
        }
      };
      fetchHistory();
    }
  }, [selectedDriver, map]);

  const simulateMovement = async () => {
    if (!selectedDriver) return;
    
    const baseLat = selectedDriver.lat;
    const baseLng = selectedDriver.lng;
    
    // Create 10 mock points following a path
    for (let i = 1; i <= 10; i++) {
      await supabase.from('tracking_logs').insert([{
        order_id: selectedDriver.id,
        lat: baseLat + (i * 0.001),
        lng: baseLng + (i * 0.0005 * (i % 2 === 0 ? 1 : -1)),
        timestamp: new Date().toISOString()
      }]);
    }
    fetchActiveTracking();
    alert('Simulação iniciada! O rastro roxo aparecerá conforme os pontos são processados.');
  };

  const fetchActiveTracking = async () => {
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, customer_name, status, address, driver_id')
      .eq('status', 'out_for_delivery');

    if (activeOrders && activeOrders.length > 0) {
      const driverLocations = await Promise.all(
        activeOrders.map(async (order: any) => {
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
      const filtered = driverLocations.filter((d: any) => d !== null);
      setDrivers(filtered);
      
      if (selectedDriver) {
        const stillActive = filtered.find((d: any) => d.id === selectedDriver.id);
        if (stillActive) setSelectedDriver(stillActive);
      } else if (filtered.length > 0) {
        setSelectedDriver(filtered[0]);
      }
    } else {
      setDrivers([]);
      setSelectedDriver(null);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle Fullscreen and Handle Interactions
  useEffect(() => {
    if (map) {
      const L = (window as any).L;
      
      if (isFullscreen) {
        // Habilita navegação total no modo tela cheia
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        if (map.touchZoom) map.touchZoom.enable();
      } else {
        // Desabilita interferência no modo normal (especialmente mobile)
        if (L.Browser.mobile) {
          map.dragging.disable();
        } else {
          map.dragging.enable();
        }
        map.scrollWheelZoom.disable();
      }

      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }
  }, [isFullscreen, map]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <main className={`${styles.main} ${isFullscreen ? styles.fullscreenMode : ''}`}>
      {!isFullscreen && (
        <header className={styles.header}>
          <button onClick={() => window.location.href = '/admin'} className={styles.backBtn}>
            <ChevronLeft /> Voltar ao Painel
          </button>
          <h1>Rastreamento de Pedidos</h1>
        </header>
      )}

      <div className={styles.container}>
        {!isFullscreen && (
          <div className={styles.sidebar}>
            <h3>Entregas em Rota</h3>
            <div className={styles.driverList}>
              {drivers.map((driver: any) => (
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
              {drivers.length === 0 && (
                <p className={styles.emptyMsg}>Nenhum motoboy em rota no momento.</p>
              )}
            </div>

            {selectedDriver && (
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
                  <span>Localização: {selectedDriver.location}</span>
                </div>
                <button 
                  onClick={simulateMovement}
                  className={styles.btnSimulate}
                  style={{ marginTop: '1rem', background: '#9b59b6', color: 'white', border: 'none' }}
                >
                  <Navigation size={18} /> Simular Percurso (Roxo)
                </button>
              </div>
            )}
          </div>
        )}

        <div className={`${styles.mapArea} ${isFullscreen ? styles.mapFullscreen : ''}`}>
          <div id="map-container" className={styles.realMap}></div>
          
          <button className={styles.btnExpand} onClick={toggleFullscreen}>
            {isFullscreen ? <ChevronLeft size={24} /> : <MapIcon size={20} />}
            <span>{isFullscreen ? 'Voltar para Lista' : 'Expandir Mapa'}</span>
          </button>

          {!leafletLoaded && (
            <div className={styles.mapLoader}>
              <div className={styles.spinner}></div>
              <p>Carregando Mapas...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
