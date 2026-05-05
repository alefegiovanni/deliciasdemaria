'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShoppingBag, Plus, Minus, X, MapPin, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, createOrder } from '@/lib/supabase';
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
  const [payment, setPayment] = useState('Cartão (Entrega)');
  const [obs, setObs] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchSettings();

    // Check for active orders
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

  // Body scroll lock
  useEffect(() => {
    if (isCartOpen || step !== 'menu') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
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
      setDistanceFees(data.distance_fees || []);
      setStoreAddress(data.store_address || '');
    }
  };

  const getCoordinates = async (address: string) => {
    try {
      const searchAddr = address.includes('Caçapava') ? address : `${address}, Caçapava, SP, Brasil`;
      let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`);
      let data = await response.json();

      if (!data || data.length === 0) {
        const simpleAddr = address.split(',')[0] + ', Caçapava, SP, Brasil';
        response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpleAddr)}&limit=1`);
        data = await response.json();
      }

      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    } catch (error) {
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
    const storeCoords = await getCoordinates(storeAddress);
    const customerCoords = await getCoordinates(customerAddr);

    if (storeCoords && customerCoords) {
      const dist = calculateDistance(storeCoords.lat, storeCoords.lon, customerCoords.lat, customerCoords.lon);
      setDistance(dist);
      const feeRule = distanceFees.find(f => dist <= f.maxKm);
      if (feeRule) setSelectedFee(feeRule.price);
      else setSelectedFee(distanceFees[distanceFees.length - 1]?.price || 0);
    }
    setCalculatingFee(false);
  };

  const handleCEPBlur = async () => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro);
          setCity(data.localidade);
          setNeighborhood(data.bairro);
          const fullAddress = `${data.logradouro}, ${number}, ${data.bairro}, ${data.localidade}`;
          updateDeliveryFee(fullAddress);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP', err);
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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const orderData = {
        customer_name: customerName,
        customer_phone: phone,
        address: `${street}, ${number}${complement ? ` (${complement})` : ''} - ${neighborhood}, ${city} (CEP: ${cep})`,
        payment_method: payment,
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, qty: item.quantity })),
        notes: obs, // Agora a observação será salva corretamente!
        total,
        status: 'received',
        estimated_time: estimatedTime
      };
      const newOrder = await createOrder(orderData);
      setOrderId(newOrder.id);
      localStorage.setItem('last_order_id', newOrder.id);
      saveAddress();
      setStep('success');
      setCart([]); 
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao enviar pedido: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      {/* Header com botão Voltar */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <button onClick={() => router.push('/')} className={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.logo}>Cardápio</h1>
          <button 
            onClick={() => setIsCartOpen(true)}
            className={`${styles.cartButton} ${showToast ? styles.pulse : ''}`}
          >
            <ShoppingBag size={24} />
            {cart.length > 0 && (
              <span className={styles.cartBadge}>
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Store Closed Banner - Elegant Redesign */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles.closedBanner}
          >
            <div className={styles.closedContent}>
              <div className={styles.closedIconWrapper}>
                <X size={18} />
              </div>
              <div className={styles.closedText}>
                <strong>Restaurante Fechado no Momento</strong>
                <p>Ainda estamos preparando tudo ou já encerramos por hoje. Volte logo!</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recovery Badge */}
      <AnimatePresence>
        {activeOrderId && step === 'menu' && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={styles.recoveryBadge}
            onClick={() => window.location.href = `/order/${activeOrderId}`}
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

      {/* Toast Notification */}
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

      {/* Categorias */}
      <nav className={styles.categoryNav}>
        <div className={styles.catContainer}>
          {['Pratos', 'Bebidas', 'Sobremesas'].map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={`${selectedCategory === cat ? styles.catBtnActive : styles.catBtn} notranslate`}
              translate="no"
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Listagem de Comidas */}
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
                  <button 
                    onClick={() => addToCart(product)}
                    className={styles.addBtn}
                  >
                    <Plus size={18} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Cart Drawer & Checkout (Simplified copy from page.tsx) */}
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
               <button onClick={() => setIsCartOpen(false)}><X size={24} /></button>
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
                         <button onClick={() => updateQuantity(item.product.id, -1)}><Minus size={16} /></button>
                         <span>{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.product.id, 1)}><Plus size={16} /></button>
                       </div>
                     </div>
                     <button onClick={() => removeFromCart(item.product.id)} className={styles.removeBtn}><X size={20} /></button>
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

                 <button 
                   className={styles.checkoutBtn}
                   disabled={!street || !number || loading || !isOpen}
                   onClick={() => setStep('checkout')}
                 >
                   {!isOpen ? 'Loja Fechada' : (loading ? 'Processando...' : 'Finalizar Pedido')}
                 </button>
               </div>
             )}
           </motion.div>
         </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal (Simplified copy) */}
      <AnimatePresence>
        {step === 'checkout' && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
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
                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                      {loading ? 'Enviando...' : 'Confirmar e Enviar'}
                    </button>
                    <button type="button" onClick={() => setStep('menu')} className={styles.modalBackBtn}>Voltar</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success View */}
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
              <button onClick={() => router.push(`/order/${orderId}`)} className={styles.submitBtn}>
                Acompanhar Entrega
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
