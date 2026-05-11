'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ShoppingBag, Plus, Minus, X, MapPin, CheckCircle2, ChevronRight, ArrowLeft, Search, Clock, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, createOrder } from '@/lib/supabase';
import { calcularTaxaEntrega, TAXA_MINIMA } from '@/lib/delivery';
import { useRouter } from 'next/navigation';
import styles from './menu.module.css';

export default function MenuPage() {
  const router = useRouter();
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Pratos');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [step, setStep] = useState<'menu' | 'checkout' | 'success'>('menu');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(40);
  const [isOpen, setIsOpen] = useState(true);
  const [distanceFees, setDistanceFees] = useState<any[]>([]);
  const [selectedFee, setSelectedFee] = useState(0);
  const [storeAddress, setStoreAddress] = useState('');
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const storeCoordsRef = useRef<{lat: number, lon: number} | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [complement, setComplement] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('Cartão (Na Entrega)');
  const [obs, setObs] = useState('');
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [foundOrders, setFoundOrders] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchSettings();

    // Senior: Handle recovery query param from landing page
    const params = new URLSearchParams(window.location.search);
    if (params.get('recovery') === 'true') {
      setIsRecoveryOpen(true);
      window.history.replaceState({}, '', '/menu');
    }
    // Check for active orders
    let trackingChannel: any;
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

          // Senior: Use a more unique name and clean up any existing channel with same name
          const channelName = `order-track-${data.id}-${Math.random().toString(36).slice(2, 7)}`;
          trackingChannel = supabase.channel(channelName)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'orders', 
              filter: `id=eq.${data.id}` 
            }, (payload: any) => {
              if (payload.new.status === 'delivered' || payload.new.status === 'cancelled') {
                setActiveOrderId(null);
                localStorage.removeItem('last_order_id');
                if (trackingChannel) supabase.removeChannel(trackingChannel);
              }
            })
            .subscribe();
        }
      }
    };
    
    checkActiveOrder();;

    // Real-time store status
    const settingsChannel = supabase
      .channel('store-settings')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'settings', 
        filter: 'id=eq.delicias_maria' 
      }, (payload: any) => {
        if (payload.new) {
          setIsOpen(payload.new.is_open ?? true);
          setEstimatedTime(payload.new.prep_time_minutes);
        }
      })
      .subscribe();

    // Load saved address
    const saved = localStorage.getItem('delicias_address');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCustomerName(data.name || '');
        setCep(data.cep || '');
        setStreet(data.street || '');
        setNumber(data.number || '');
        setNeighborhood(data.neighborhood || '');
        setCity(data.city || '');
        setComplement(data.complement || '');
        setPhone(data.phone || '');
        
        if (data.cep) {
          const fullAddress = `${data.street}, ${data.number}, ${data.neighborhood}, ${data.city}`;
          updateDeliveryFee(fullAddress);
        }
      } catch (e) {
        console.error('Error loading saved address', e);
      }
    }

    return () => {
      if (trackingChannel) supabase.removeChannel(trackingChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Proactive fee calculation when CEP and Number are present
  useEffect(() => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8 && number.length > 0) {
      const timer = setTimeout(() => {
        handleCEPBlur();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [cep, number]);

  // Body scroll lock
  useEffect(() => {
    if (isCartOpen || step !== 'menu') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Senior: Auto-close cart when moving to checkout to avoid z-index blocking on mobile
    if (step === 'checkout' && isCartOpen) {
      setIsCartOpen(false);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen, step]);

  const saveAddress = () => {
    localStorage.setItem('delicias_address', JSON.stringify({
      name: customerName,
      cep,
      street,
      number,
      neighborhood,
      city,
      complement,
      phone
    }));
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('available', true).order('name');
    if (data) setProductsList(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 'delicias_maria').single();
    if (data) {
      setEstimatedTime(data.prep_time_minutes);
      setIsOpen(data.is_open ?? true);
      // Senior: Always sort fees by distance to ensure correct matching logic
      const sortedFees = (data.distance_fees || []).sort((a: any, b: any) => a.maxKm - b.maxKm);
      setDistanceFees(sortedFees);
      setStoreAddress(data.store_address || '');
    }
  };

  const getCoordinates = async (address: string, cepValue?: string) => {
    try {
      const cleanAddr = address.replace(/\(CEP:.*?\)/g, '').replace(/-/g, ',').trim();
      const detectedCEP = (cepValue || (address.match(/\d{5}-?\d{3}/) || [])[0] || '').replace(/\D/g, '');
      const detectedCity = cleanAddr.toLowerCase().includes('são josé') ? 'São José dos Campos' : 
                          cleanAddr.toLowerCase().includes('caçapava') ? 'Caçapava' : 'Caçapava';

      // Senior: 1. Try by CEP + City together for maximum precision
      if (detectedCEP.length === 8) {
        const query = `${detectedCEP} ${detectedCity}, Brasil`;
        console.log(`[Geocoding] Attempt 1 (CEP+City): ${query}`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
          headers: { 'User-Agent': 'DeliciasDeMaria/1.0' }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
        }
      }

      // Senior: 2. Try by Street + City
      const street = cleanAddr.split(',')[0];
      const query2 = `${street}, ${detectedCity}, SP, Brasil`;
      console.log(`[Geocoding] Attempt 2 (Street+City): ${query2}`);
      const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query2)}&limit=1`, {
        headers: { 'User-Agent': 'DeliciasDeMaria/1.0' }
      });
      const data2 = await res2.json();
      if (data2 && data2.length > 0) {
        return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon), display: data2[0].display_name };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const updateDeliveryFee = async (customerAddr: string) => {
    if (!customerAddr || !storeAddress) return;
    setCalculatingFee(true);
    
    try {
      if (!storeCoordsRef.current) {
        storeCoordsRef.current = await getCoordinates(storeAddress);
      }
      
      const storeCoords = storeCoordsRef.current;
      let customerCoords = await getCoordinates(customerAddr, cep);

      // Fallback: Try searching only by CEP if full address failed
      if (!customerCoords && cep) {
        customerCoords = await getCoordinates(cep);
      }

      if (storeCoords && customerCoords) {
        const dist = calculateDistance(storeCoords.lat, storeCoords.lon, customerCoords.lat, customerCoords.lon);
        console.log(`[Fee] Distance calculated: ${dist.toFixed(2)}km`);
        setDistance(Object.assign(Number(dist), { display_target: customerCoords.display }));
        
        // Nova lógica de taxa proporcional
        const fee = calcularTaxaEntrega(dist);
        setSelectedFee(fee);
      } else {
        console.warn('[Fee] Could not determine coordinates. Using fallback logic.');
        
        // Senior: Fallback Logic - If geocoding fails but we know the city is Caçapava,
        // we use the minimum fee.
        const isLocal = customerAddr.toLowerCase().includes('caçapava');
        if (isLocal) {
          setSelectedFee(TAXA_MINIMA);
        } else {
          // If not local and geocoding failed, use a slightly higher default or keep minimum
          setSelectedFee(TAXA_MINIMA + 3.00); // Ex: R$ 8,00 as a safe default for unknown distances
        }
      }
    } catch (err) {
      console.error('Fee calculation error:', err);
      setSelectedFee(distanceFees[distanceFees.length - 1]?.price || 0);
    } finally {
      setCalculatingFee(false);
    }
  };

  const handleCEPBlur = async () => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        setCalculatingFee(true);
        const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro);
          setCity(data.localidade);
          setNeighborhood(data.bairro);
          // Trigger fee calculation with the new data
          const fullAddress = `${data.logradouro}, ${number || 'S/N'}, ${data.bairro}, ${data.localidade}`;
          await updateDeliveryFee(fullAddress);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err);
      } finally {
        setCalculatingFee(false);
      }
    }
  };

  const handleNumberBlur = () => {
    if (street && number) {
      const fullAddress = `${street}, ${number}, ${neighborhood}, ${city}`;
      updateDeliveryFee(fullAddress);
    }
  };

  const addToCart = (product: any) => {
    if (!isOpen) {
      alert('Desculpe, a loja está fechada no momento.');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0) + selectedFee;

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    // Manual validation to ensure we catch issues before submission
    if (!customerName.trim() || !phone.trim()) {
      alert('Por favor, preencha seu nome e telefone.');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        customer_name: customerName.trim(),
        customer_phone: phone.replace(/\D/g, ''), // Senior: Clean phone number for database consistency
        address: `${street}, ${number}${complement ? ` (${complement})` : ''} - ${neighborhood}, ${city} (CEP: ${cep})`,
        payment_method: payment,
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, qty: item.quantity })),
        notes: obs,
        total,
        status: 'received',
        estimated_time: estimatedTime
      };

      const newOrder = await createOrder(orderData, distance);
      
      if (!newOrder?.id) throw new Error('Não foi possível obter o ID do pedido.');

      setOrderId(newOrder.id);
      localStorage.setItem('last_order_id', newOrder.id);
      saveAddress();
      setStep('success');
      setCart([]); 
    } catch (err: any) {
      console.error('Order submission error:', err);
      // Detailed error message for debugging
      const errorMsg = err.message || 'Erro de conexão';
      alert(`Erro ao enviar pedido: ${errorMsg}. Por favor, verifique sua internet e tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  const searchOrders = async () => {
    if (!recoveryPhone) return;
    setIsSearching(true);
    try {
      const cleanPhone = recoveryPhone.replace(/\D/g, '');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_phone.eq.${recoveryPhone},customer_phone.ilike.%${cleanPhone}%`)
        .gte('created_at', todayISO)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      setFoundOrders(data || []);
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar pedidos.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <motion.button onClick={() => router.push('/')} className={styles.backBtn}>
            <ArrowLeft size={24} />
          </motion.button>
          <h1 className={styles.logo}>Cardápio</h1>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <motion.button 
              onClick={() => setIsRecoveryOpen(true)}
              className={styles.historyButton}
              title="Acompanhar meu pedido"
            >
              <Search size={22} />
            </motion.button>
            
            <motion.button 
              onClick={() => setIsCartOpen(true)}
              className={`${styles.cartButton} ${showToast ? styles.pulse : ''}`}
            >
              <ShoppingBag size={24} />
              {cart.length > 0 && (
                <span className={styles.cartBadge}>
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </header>



      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className={styles.toast}
          >
            <CheckCircle2 size={20} />
            <span>Adicionado ao carrinho!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className={styles.categoryNav}>
        <div className={styles.catContainer}>
          {['Pratos', 'Bebidas', 'Sobremesas'].map(cat => (
            <motion.button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={`${selectedCategory === cat ? styles.catBtnActive : styles.catBtn} notranslate`}
              translate="no"
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </nav>

      <section className={styles.menuSection}>
        <div className={styles.grid}>
          {productsList.filter(p => p.category === selectedCategory).map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className={styles.card}
            >
              <div className={styles.cardImageWrapper}>
                {product.image && (
                  <Image 
                    src={product.image} 
                    alt={product.name}
                    fill
                    className={styles.cardImage}
                  />
                )}
                <div className={styles.categoryBadge}>{product.category}</div>
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.productName}>{product.name}</h3>
                <p className={styles.productDesc}>{product.description}</p>
                <div className={styles.cardFooter}>
                  <span className={styles.price}>
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <motion.button 
                    onClick={() => addToCart(product)}
                    className={styles.addBtn}
                  >
                    <Plus size={18} />
                    <span>Adicionar</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {isCartOpen && (
           <div className={styles.overlayWrapper}>
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsCartOpen(false)}
               className={styles.overlay}
             />
             <motion.div
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               className={styles.drawer}
             >
               <div className={styles.drawerHeader}>
                 <h2>Seu Carrinho</h2>
                 <motion.button onClick={() => setIsCartOpen(false)}><X size={24} /></motion.button>
               </div>

               <div className={styles.drawerBody}>
                 {cart.length === 0 ? (
                   <div className={styles.emptyCart}>
                     <ShoppingBag size={48} />
                     <p>Seu carrinho está vazio.</p>
                   </div>
                 ) : (
                   cart.map(item => (
                     <div key={item.product.id} className={styles.cartItem}>
                       <div className={styles.cartItemImg}>
                         <Image src={item.product.image} alt={item.product.name} fill />
                       </div>
                       <div className={styles.cartItemInfo}>
                         <h4>{item.product.name}</h4>
                         <p className={styles.itemPrice}>R$ {item.product.price.toFixed(2)}</p>
                         <div className={styles.qtyControls}>
                           <motion.button onClick={() => updateQuantity(item.product.id, -1)}><Minus size={16} /></motion.button>
                           <span>{item.quantity}</span>
                           <motion.button onClick={() => updateQuantity(item.product.id, 1)}><Plus size={16} /></motion.button>
                         </div>
                       </div>
                       <motion.button onClick={() => removeFromCart(item.product.id)} className={styles.removeBtn}><X size={20} /></motion.button>
                     </div>
                   ))
                 )}
               </div>

               {cart.length > 0 && (
                 <div className={styles.drawerFooter}>
                   <div className={styles.addressSection}>
                     <div className={styles.addressHeader}>
                       <MapPin size={18} />
                       <span>Onde entregamos?</span>
                     </div>
                     
                     <div className={styles.cepRow}>
                       <input 
                         type="text" 
                         placeholder="Seu CEP" 
                         value={cep}
                         onChange={(e) => setCep(e.target.value)}
                         onBlur={handleCEPBlur}
                         className={styles.cepInput}
                       />
                       <input 
                         type="text" 
                         placeholder="Nº" 
                         value={number}
                         onChange={(e) => setNumber(e.target.value)}
                         onBlur={handleNumberBlur}
                         className={styles.numberInput}
                       />
                     </div>

                     {street ? (
                       <div className={styles.addressDisplay}>
                         <p>{street}, {number || 'S/N'}</p>
                         <p>{neighborhood} - {city}</p>
                       </div>
                     ) : (
                       <p className={styles.addressDisplay}>Informe o CEP para calcular a entrega</p>
                     )}
                   </div>

                   <div className={styles.totalRow}>
                     <span>Subtotal</span>
                     <span>R$ {cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}</span>
                   </div>
                   <div className={styles.totalRow}>
                     <span>Taxa de Entrega</span>
                     <span>{calculatingFee ? '...' : `R$ ${selectedFee.toFixed(2)}`}</span>
                   </div>
                   <div className={styles.finalTotal}>
                     <span>Total</span>
                     <span>R$ {total.toFixed(2)}</span>
                   </div>

                   <motion.button 
                     id="cart-continue-button"
                     whileTap={{ scale: 0.96 }}
                     className={styles.checkoutBtn}
                     disabled={!street || !number || loading || !isOpen}
                     onClick={() => { setStep('checkout'); setIsCartOpen(false); }}
                   >
                     {!isOpen ? 'Loja Fechada' : (loading ? 'Processando...' : 'CONTINUAR')}
                   </motion.button>
                 </div>
               )}
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 'checkout' && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={styles.modal}
            >
              <div className={styles.modalContent}>
                <h2 className={styles.modalTitle}>Dados para Entrega</h2>
                <form onSubmit={handleCheckout} className={styles.form}>
                  <div className={styles.formGroupFull}>
                    <label>Nome Completo</label>
                    <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Como Maria deve te chamar?" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Telefone / WhatsApp</label>
                    <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="(12) 99999-9999" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Forma de Pagamento</label>
                    <select value={payment} onChange={e => setPayment(e.target.value)}>
                      <option>Pix (Na Entrega)</option>
                      <option>Cartão (Na Entrega)</option>
                      <option>Dinheiro (Na Entrega)</option>
                    </select>
                  </div>
                  <div className={styles.formGroupFull}>
                    <label>Complemento (Opcional)</label>
                    <input type="text" value={complement} onChange={e => setComplement(e.target.value)} placeholder="Ex: Apartamento 12, Bloco B, Casa no fundo..." />
                  </div>
                  <div className={styles.formGroupFull}>
                    <label>Observações (Opcional)</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Sem cebola, campainha estragada..." />
                  </div>
                  <div className={styles.formActions}>
                    <motion.button 
                      type="submit" 
                      id="confirm-order-button"
                      whileTap={{ scale: 0.96 }}
                      className={styles.submitBtn} 
                      disabled={loading}
                    >
                      {loading ? 'Enviando...' : 'Confirmar e Enviar'}
                    </motion.button>
                    <motion.button type="button" onClick={() => setStep('menu')} className={styles.modalBackBtn}>Voltar</motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 'success' && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={styles.successCard}
            >
              <div className={styles.pulseContainer}>
                <div className={styles.pulseRing} />
                <CheckCircle2 size={64} className={styles.successIcon} />
              </div>
              <h2>Pedido Confirmado!</h2>
              <p>Seu pedido <strong>#{orderId.slice(-4).toUpperCase()}</strong> já está sendo preparado pela Maria.</p>
              <div className={styles.successActions}>
                <motion.button onClick={() => router.push(`/order/${orderId}`)} className={styles.submitBtn}>
                  Acompanhar Entrega
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecoveryOpen && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={styles.modal}
            >
              <div className={styles.modalContent}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 className={styles.modalTitle} style={{ margin: 0 }}>Meus Pedidos</h2>
                  <motion.button onClick={() => setIsRecoveryOpen(false)} style={{ background: 'none', border: 'none', color: '#666' }}>
                    <X size={24} />
                  </motion.button>
                </div>
                
                <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Esqueceu de acompanhar seu pedido? Digite seu WhatsApp abaixo:
                </p>

                <div className={styles.formGroupFull} style={{ marginBottom: '1.5rem' }}>
                  <input 
                    type="tel" 
                    placeholder="(11) 99999-9999" 
                    value={recoveryPhone} 
                    onChange={e => setRecoveryPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchOrders()}
                  />
                  <motion.button 
                    onClick={searchOrders} 
                    className={styles.submitBtn} 
                    style={{ marginTop: '1rem' }}
                    disabled={isSearching}
                  >
                    {isSearching ? 'Buscando...' : 'Buscar Pedidos'}
                  </motion.button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {foundOrders.map(order => (
                    <div 
                      key={order.id} 
                      style={{ 
                        padding: '1rem', 
                        background: '#f8f9fa', 
                        borderRadius: '16px',
                        border: '1px solid #eee',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                          Pedido #{order.id.slice(-4).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                          Status: {order.status === 'received' ? 'Recebido' : order.status === 'preparing' ? 'Preparando' : order.status === 'ready' ? 'Pronto' : order.status === 'dispatched' ? 'Ag. Motoboy' : order.status === 'out_for_delivery' ? 'Em Entrega' : order.status === 'delivered' ? 'Entregue' : 'Cancelado'}
                        </div>
                      </div>
                      <motion.button 
                        onClick={() => router.push(`/order/${order.id}?from=orders`)}
                        className={styles.addBtn}
                        style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: '10px' }}
                      >
                        <ExternalLink size={16} /> Ver
                      </motion.button>
                    </div>
                  ))}
                  {!isSearching && foundOrders.length === 0 && recoveryPhone && (
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#999' }}>Nenhum pedido recente encontrado.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
