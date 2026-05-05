'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShoppingBag, Plus, Minus, X, MessageSquare, MapPin, Phone, CreditCard, Clock, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, createOrder } from '@/lib/supabase';
import styles from './page.module.css';

export default function Home() {
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

          // Listen for real-time status changes to hide badge automatically
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
        setPhone(data.phone || '');
        
        if (data.cep) {
          // Trigger fee calculation with saved address
          const fullAddress = `${data.street}, ${data.number}, ${data.neighborhood}, ${data.city}`;
          updateDeliveryFee(fullAddress);
        }
      } catch (e) {
        console.error('Error loading saved address', e);
      }
    }

    return () => {
      if (trackingChannel) supabase.removeChannel(trackingChannel);
    };
  }, []);

  const saveAddress = () => {
    localStorage.setItem('delicias_address', JSON.stringify({
      name: customerName,
      cep,
      street,
      number,
      neighborhood,
      city,
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
      // Add city and country to ensure better results
      const searchAddr = address.includes('Caçapava') ? address : `${address}, Caçapava, SP, Brasil`;
      console.log(`Tentativa 1: "${searchAddr}"`);
      
      let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`);
      let data = await response.json();

      // If fails, try a simpler version (without number/details)
      if (!data || data.length === 0) {
        const simpleAddr = address.split(',')[0] + ', Caçapava, SP, Brasil';
        console.log(`Tentativa 2 (Simples): "${simpleAddr}"`);
        response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpleAddr)}&limit=1`);
        data = await response.json();
      }

      if (data && data.length > 0) {
        console.log(`Sucesso! Coordenadas: ${data[0].lat}, ${data[0].lon}`);
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }

      console.warn(`Mapa não encontrou: "${address}"`);
      return null;
    } catch (error) {
      console.error('Erro de conexão com serviço de mapas:', error);
      return null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

   const updateDeliveryFee = async (customerAddr: string) => {
    if (!customerAddr || !storeAddress) {
      console.warn('Cálculo ignorado: endereço do cliente ou da loja ausente.', { customerAddr, storeAddress });
      return;
    }
    setCalculatingFee(true);
    
    console.log('Calculando frete para:', customerAddr);
    const storeCoords = await getCoordinates(storeAddress);
    const customerCoords = await getCoordinates(customerAddr);

    if (storeCoords && customerCoords) {
      const dist = calculateDistance(storeCoords.lat, storeCoords.lon, customerCoords.lat, customerCoords.lon);
      console.log(`Distância calculada: ${dist.toFixed(2)} km`);
      setDistance(dist);

      // Find appropriate fee
      const feeRule = distanceFees.find(f => dist <= f.maxKm);
      if (feeRule) {
        setSelectedFee(feeRule.price);
        console.log(`Taxa aplicada: R$ ${feeRule.price}`);
      } else {
        const lastFee = distanceFees[distanceFees.length - 1]?.price || 0;
        setSelectedFee(lastFee);
        console.log(`Fora do raio. Aplicando taxa padrão: R$ ${lastFee}`);
      }
    } else {
      console.error('Não foi possível obter coordenadas para o cálculo.');
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
          
          // Trigger distance calculation with current number if exists
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
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    
    // Show feedback
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
        address: `${street}, ${number} - ${neighborhood}, ${city} (CEP: ${cep})`,
        payment_method: payment,
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, qty: item.quantity })),
        total,
        status: 'received',
        estimated_time: estimatedTime
      };
      
      const newOrder = await createOrder(orderData);
      setOrderId(newOrder.id);
      localStorage.setItem('last_order_id', newOrder.id);
      setStep('success');
      setCart([]); // Clear cart
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao enviar pedido: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
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

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <h1 className={styles.logo}>Delícias de Maria</h1>
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

      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className={styles.heroTitle}>Sua refeição diária, com a qualidade Maria.</h2>
            <p className={styles.heroSubtitle}>
              Marmitas variadas e saborosas preparadas para garantir praticidade e nutrição no seu dia a dia.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <nav className={styles.categoryNav}>
        <div className="container flex-center gap-1">
          {['Pratos', 'Bebidas', 'Sobremesas'].map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={selectedCategory === cat ? styles.catBtnActive : styles.catBtn}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Product Grid */}
      <section className={styles.menuSection}>
        <div className="container">
          <div className={styles.grid}>
            {productsList.filter(p => p.category === selectedCategory).map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
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
                      <Plus size={20} />
                      Adicionar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cart Drawer */}
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
                      {calculatingFee && <span className={styles.loadingFee}>...</span>}
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
                    <span>Taxa de Entrega {distance && <small>({distance.toFixed(1)}km)</small>}</span>
                    <span>{calculatingFee ? 'Calculando...' : `R$ ${selectedFee.toFixed(2)}`}</span>
                  </div>
                  <div className={styles.finalTotal}>
                    <span>Total</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => { setIsCartOpen(false); setStep('checkout'); }}
                    className={styles.checkoutBtn}
                    disabled={!street || calculatingFee}
                  >
                    {street ? 'Finalizar Pedido' : 'Informe o CEP'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {step === 'checkout' && (
          <div className={styles.modalOverlay}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={styles.overlay}
              onClick={() => setStep('menu')}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={styles.modal}
            >
              <div className={styles.modalContent}>
                <h2 className={styles.modalTitle}><CreditCard /> Finalizar Pedido</h2>
                
                <form className={styles.form} onSubmit={handleCheckout}>
                  <div className={styles.formGroupFull}>
                    <label>Nome Completo</label>
                    <div className={styles.inputWrapper}>
                      <User size={20} />
                      <input 
                        required 
                        type="text" 
                        placeholder="Como podemos te chamar?" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroupFull}>
                    <label>Endereço de Entrega</label>
                    <div className={styles.addressSummary}>
                      <MapPin size={20} />
                      <div>
                        <p><strong>{street}, {number}</strong></p>
                        <p>{neighborhood} - {city} (CEP: {cep})</p>
                      </div>
                      <button type="button" onClick={() => { setStep('menu'); setIsCartOpen(true); }} className={styles.editAddrBtn}>
                        Alterar
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>WhatsApp</label>
                    <div className={styles.inputWrapper}>
                      <Phone size={20} />
                      <input 
                        required 
                        type="tel" 
                        placeholder="(00) 00000-0000" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Pagamento</label>
                    <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                      <option>Cartão (Entrega)</option>
                      <option>Pix</option>
                      <option>Dinheiro</option>
                    </select>
                  </div>

                  <div className={styles.formGroupFull}>
                    <label>Observações</label>
                    <div className={styles.inputWrapper}>
                      <MessageSquare size={20} />
                      <textarea 
                        placeholder="Ex: Entrega rápida..."
                        value={obs}
                        onChange={(e) => setObs(e.target.value)}
                      ></textarea>
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                      {loading ? 'Enviando...' : 'Confirmar Pedido'}
                    </button>
                    <button type="button" onClick={() => setStep('menu')} className={styles.backBtn}>
                      Voltar ao Cardápio
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success View */}
      <AnimatePresence>
        {step === 'success' && (
          <div className={styles.modalOverlay}>
            <div className={styles.overlay} />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={styles.successCard}
            >
              <div className={styles.successIcon}>
                <CheckCircle2 size={48} />
              </div>
              <h2>Pedido Confirmado!</h2>
              <p>Sua doçura já está sendo preparada.</p>
              <button 
                onClick={() => window.location.href = `/order/${orderId}`} 
                className={styles.submitBtn}
              >
                Ver Status do Pedido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!isOpen && (
          <motion.div 
            className={styles.closedOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.closedCard}>
              <Clock size={64} className={styles.closedIcon} />
              <h2>Loja Fechada no Momento</h2>
              <p>Desculpe, já encerramos nosso expediente ou estamos em manutenção. Voltaremos em breve com as melhores delícias!</p>
              <div className={styles.closedInfo}>
                <span>Horário de Atendimento</span>
                <strong>Terça a Domingo - 11h às 23h</strong>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
