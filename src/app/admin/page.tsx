'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Search, Clock, Map as MapIcon, ChevronRight, CheckCircle2, Truck, AlertCircle, LogOut, Utensils, Trash2, Plus, ChefHat, Edit, Users, UserX, MessageCircle, MapPin, Bell, Store, Link, Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

export default function KitchenDashboard() {
  const [view, setView] = useState<'orders' | 'menu' | 'clients' | 'fees' | 'drivers'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', pin: '' });
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [distanceFees, setDistanceFees] = useState<any[]>([]);
  const [newDistanceFee, setNewDistanceFee] = useState({ maxKm: '', price: '' });
  const [storeAddress, setStoreAddress] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [storeAddressData, setStoreAddressData] = useState({
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    cep: ''
  });
  const [clients, setClients] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Pratos',
    image: ''
  });
  const [estimatedTime, setEstimatedTime] = useState(40);
  const [search, setSearch] = useState('');
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'received' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'>('active');

  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'admin') {
      router.push('/login');
      return;
    }

    fetchOrders();
    fetchSettings();
    fetchProducts();
    fetchClients();
    fetchDrivers();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        playNotificationSound();
        setShowNewOrderAlert(true);
        setTimeout(() => setShowNewOrderAlert(false), 6000);
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchSettings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('category');
    if (data) setProductsList(data);
  };

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('products').update({ available: !currentStatus }).eq('id', id);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Deseja excluir este item do cardápio?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      ...newProduct,
      price: parseFloat(newProduct.price)
    };

    let error;
    if (editingProduct) {
      const { error: err } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('products').insert([productData]);
      error = err;
    }

    if (!error) {
      setIsModalOpen(false);
      setEditingProduct(null);
      setNewProduct({ name: '', description: '', price: '', category: 'Pratos', image: '' });
      fetchProducts();
    } else {
      alert('Erro ao salvar produto.');
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setOrders(data);
      // Update clients list whenever orders change
      extractClients(data);
    }
  };

  const extractClients = (orderData: any[]) => {
    const clientMap = new Map();
    orderData.forEach(order => {
      if (!order.customer_phone) return;
      if (!clientMap.has(order.customer_phone)) {
        clientMap.set(order.customer_phone, {
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.address,
          totalOrders: 1,
          lastOrder: order.created_at
        });
      } else {
        const existing = clientMap.get(order.customer_phone);
        existing.totalOrders += 1;
        if (new Date(order.created_at) > new Date(existing.lastOrder)) {
          existing.lastOrder = order.created_at;
          existing.name = order.customer_name; // Keep most recent name
          existing.address = order.address;
        }
      }
    });
    setClients(Array.from(clientMap.values()));
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('orders').select('*');
    if (data) extractClients(data);
  };

  const fetchDrivers = async () => {
    const { data } = await supabase.from('drivers').select('*').order('name');
    if (data) setDrivers(data);
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newDriver.pin.length !== 4) {
      alert('O PIN deve ter exatamente 4 dígitos.');
      return;
    }
    
    if (editingDriver) {
      const { error } = await supabase.from('drivers').update(newDriver).eq('id', editingDriver.id);
      if (!error) {
        setIsDriverModalOpen(false);
        setEditingDriver(null);
        setNewDriver({ name: '', phone: '', pin: '' });
        fetchDrivers();
      } else {
        alert('Erro ao atualizar: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('drivers').insert([newDriver]);
      if (!error) {
        setIsDriverModalOpen(false);
        setNewDriver({ name: '', phone: '', pin: '' });
        fetchDrivers();
      } else {
        alert('Erro ao salvar no banco: ' + error.message);
      }
    }
  };

  const toggleDriverStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('drivers').update({ active: !currentStatus }).eq('id', id);
    if (!error) fetchDrivers();
  };

  const copyDriverLink = (driverId: string) => {
    const link = `${window.location.origin}/driver?token=${driverId}`;
    navigator.clipboard.writeText(link);
    alert('Link exclusivo copiado! Envie pelo WhatsApp para este motoboy acessar o painel dele.');
  };

  const deleteDriver = async (id: string) => {
    if (!confirm('Deseja excluir este motoboy?')) return;
    await supabase.from('drivers').delete().eq('id', id);
    fetchDrivers();
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 'delicias_maria').single();
    if (data) {
      setEstimatedTime(data.prep_time_minutes);
      setIsOpen(data.is_open ?? true);
      setDistanceFees(data.distance_fees || []);
      setStoreAddress(data.store_address || '');
      if (data.store_address_json) {
        setStoreAddressData(data.store_address_json);
      } else if (data.store_address) {
        // Fallback or initial parse
        setStoreAddressData(prev => ({ ...prev, street: data.store_address }));
      }
    }
  };

  const saveStoreAddress = async () => {
    try {
      const formatted = `${storeAddressData.street}, ${storeAddressData.number} - ${storeAddressData.neighborhood}, ${storeAddressData.city} (CEP: ${storeAddressData.cep})`;
      
      // Update locally first for instant feedback
      setStoreAddress(formatted);
      
      await saveSettings({ 
        store_address: formatted,
        store_address_json: storeAddressData
      });
      
      setIsAddressModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o endereço.');
    }
  };

  const handleStoreCEPBlur = async () => {
    const cleanCEP = storeAddressData.cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStoreAddressData(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar CEP da loja', err);
      }
    }
  };

  const saveSettings = async (updates: any) => {
    const { error } = await supabase.from('settings').upsert({ id: 'delicias_maria', ...updates });
    if (error) {
      console.error('Erro ao salvar no Supabase:', error);
      alert('Erro do Banco: ' + error.message);
    } else {
      await fetchSettings();
    }
  };

  const addDistanceFee = () => {
    if (!newDistanceFee.maxKm || !newDistanceFee.price) return;
    const updated = [...distanceFees, { 
      maxKm: parseFloat(newDistanceFee.maxKm), 
      price: parseFloat(newDistanceFee.price) 
    }].sort((a, b) => a.maxKm - b.maxKm);
    
    saveSettings({ distance_fees: updated });
    setNewDistanceFee({ maxKm: '', price: '' });
  };

  const removeDistanceFee = (index: number) => {
    const updated = distanceFees.filter((_, i) => i !== index);
    saveSettings({ distance_fees: updated });
  };

  const toggleStoreStatus = async () => {
    const newStatus = !isOpen;
    setIsOpen(newStatus);
    await supabase.from('settings').update({ is_open: newStatus }).eq('id', 'delicias_maria');
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (time: number, freq: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.1, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.3);
      };

      // Double beep
      playBeep(audioCtx.currentTime, 880);
      playBeep(audioCtx.currentTime + 0.4, 1046.50); // C6
    } catch (err) {
      console.error('Erro ao tocar som:', err);
    }
  };

  const updatePrepTime = async (newTime: number) => {
    setEstimatedTime(newTime);
    await supabase.from('settings').update({ prep_time_minutes: newTime }).eq('id', 'delicias_maria');
  };

  const updateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
      fetchOrders(); // Revert to server state
    } else {
      fetchOrders(); // Ensure fresh data
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received': return 'Recebido';
      case 'preparing': return 'Em Preparo';
      case 'ready': return 'Pronto';
      case 'out_for_delivery': return 'Em Rota';
      case 'delivered': return 'Entregue';
      default: return status;
    }
  };

  const categories = Array.from(new Set(productsList.map(p => p.category)));

  return (
    <main className={styles.main}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarBrandGroup}>
            <ChefHat size={32} className={styles.logoIcon} />
            <h1 className="font-serif italic">Maria Admin</h1>
          </div>
          <button 
            className={styles.mobileMenuBtn} 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
        <nav className={`${styles.nav} ${isMobileMenuOpen ? styles.navOpen : ''}`}>
          <button 
            className={view === 'orders' ? styles.navItemActive : styles.navItem} 
            onClick={() => { setView('orders'); setIsMobileMenuOpen(false); }}
          >
            <Package size={20} /> Pedidos
          </button>

          
          <button 
            className={view === 'menu' ? styles.navItemActive : styles.navItem} 
            onClick={() => { setView('menu'); fetchProducts(); setIsMobileMenuOpen(false); }}
          >
            <Utensils size={20} /> Cardápio
          </button>


          <button 
            className={view === 'clients' ? styles.navItemActive : styles.navItem} 
            onClick={() => { setView('clients'); fetchClients(); setIsMobileMenuOpen(false); }}
          >
            <Users size={20} /> Clientes
          </button>


          <button 
            className={view === 'fees' ? styles.navItemActive : styles.navItem} 
            onClick={() => { setView('fees'); fetchSettings(); setIsMobileMenuOpen(false); }}
          >
            <Truck size={20} /> Taxas de Entrega
          </button>


          <button 
            className={view === 'drivers' ? styles.navItemActive : styles.navItem} 
            onClick={() => { setView('drivers'); fetchDrivers(); setIsMobileMenuOpen(false); }}
          >
            <Users size={20} /> Motoboys
          </button>


          <button className={styles.navItem} onClick={() => window.location.href='/admin/tracking'}>
            <MapIcon size={20} /> Rastreamento
          </button>
          <button className={styles.logoutBtn} onClick={() => { localStorage.clear(); router.push('/'); }}>
            <LogOut size={20} /> Sair
          </button>
        </nav>
        {isMobileMenuOpen && (
          <div className={styles.mobileOverlay} onClick={() => setIsMobileMenuOpen(false)}></div>
        )}
      </aside>

      <div className={styles.content}>
        <header className={styles.topHeader}>
          <div className={styles.headerTitle}>
            <h2>
              {view === 'orders' ? 'Painel de Pedidos' : 
               view === 'menu' ? 'Cardápio' : 
               view === 'clients' ? 'Clientes' :
               view === 'drivers' ? 'Motoboys' :
               'Taxas por Distância'}
            </h2>
            <p>
              {view === 'orders' ? 'Gerencie os pedidos em tempo real.' : 
               view === 'menu' ? 'Organize seus pratos e preços.' : 
               view === 'clients' ? 'Histórico e dados dos seus clientes.' :
               view === 'drivers' ? 'Cadastre e gerencie seus entregadores.' :
               'Defina valores de entrega por raio de quilometragem.'}
            </p>
          </div>
          
          <div className={styles.headerActions}>
            <button 
              className={styles.btnSoundTest}
              onClick={() => {
                playNotificationSound();
                const btn = document.activeElement as HTMLElement;
                btn.style.transform = 'scale(1.2)';
                setTimeout(() => btn.style.transform = '', 200);
              }}
              title="Testar som de notificação"
            >
              <Bell size={18} />
            </button>

            <button 
              className={`${styles.storeToggle} ${isOpen ? styles.storeOpen : styles.storeClosed}`}
              onClick={toggleStoreStatus}
            >
              <div className={styles.statusDot} />
              {isOpen ? 'Loja Aberta' : 'Loja Fechada'}
            </button>

            {view === 'menu' && (
              <button className={styles.btnAddItemMain} onClick={() => { 
                setNewProduct({ name: '', description: '', price: '', category: 'Pratos', image: '' });
                setEditingProduct(null);
                setIsModalOpen(true); 
              }}>
                <Plus size={18} /> Novo Prato
              </button>
            )}
            <div className={styles.prepTimeControl}>
              <Clock size={16} />
              <span>Preparo:</span>
              <input 
                type="number" 
                value={estimatedTime} 
                onChange={(e) => updatePrepTime(Number(e.target.value))}
                className={styles.timeInput}
              />
              <small>min</small>
            </div>
          </div>
        </header>

        {view === 'orders' && (
          <>
            {showNewOrderAlert && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.newOrderAlert}
              >
                <AlertCircle size={24} />
                <span>MAIS UM PEDIDO RECEBIDO!</span>
                <AlertCircle size={24} />
              </motion.div>
            )}
            <section className={styles.statsGrid}>
              <div 
                className={`${styles.statCard} ${statusFilter === 'active' ? styles.statCardActive : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                <p>Ativos (Cozinha)</p>
                <h3>{orders.filter(o => ['received', 'preparing', 'ready'].includes(o.status)).length}</h3>
              </div>
              <div 
                className={`${styles.statCard} ${statusFilter === 'preparing' ? styles.statCardActive : ''}`}
                onClick={() => setStatusFilter('preparing')}
              >
                <p>Em Preparo</p>
                <h3>{orders.filter(o => o.status === 'preparing').length}</h3>
              </div>
              <div 
                className={`${styles.statCard} ${statusFilter === 'out_for_delivery' ? styles.statCardActive : ''}`}
                onClick={() => setStatusFilter('out_for_delivery')}
              >
                <p>Em Rota</p>
                <h3>{orders.filter(o => o.status === 'out_for_delivery').length}</h3>
              </div>
              <div 
                className={`${styles.statCard} ${statusFilter === 'delivered' ? styles.statCardActive : ''} ${styles.statCardHistory}`}
                onClick={() => setStatusFilter('delivered')}
              >
                <p>Histórico</p>
                <small>Ver Concluídos</small>
              </div>
            </section>


            <div className={styles.orderContainer}>
              <div className={styles.searchBar}>
                <Search size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar pedido por cliente..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => {
                      const matchesSearch = o.customer_name?.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
                      const matchesStatus = statusFilter === 'all' || o.status === statusFilter || (statusFilter === 'active' && ['received', 'preparing', 'ready'].includes(o.status));
                      return matchesSearch && matchesStatus;
                    })
                    .map(order => (

                    <tr key={order.id}>
                      <td>
                        <div className={styles.customerCell}>
                          <strong>{order.customer_name}</strong>
                          <span>{order.customer_phone}</span>
                        </div>
                      </td>
                      <td className={styles.itemsCell}>
                        <div className={styles.itemList}>
                          {order.items?.map((it: any, idx: number) => (
                            <div key={idx} className={styles.orderItemRow}>
                              <div className={styles.itemMainInfo}>
                                <span className={styles.itemQty}>{it.qty}x</span>
                                <span className={styles.itemName}>{it.name}</span>
                              </div>
                              {it.observation && (
                                <div className={styles.itemObservation}>
                                  <MessageCircle size={14} />
                                  <span>{it.observation}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusTag} ${styles[order.status]}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {order.status === 'received' && (
                            <button onClick={() => updateStatus(order.id, 'preparing')} className={styles.btnPrepare}>Preparar</button>
                          )}
                          {order.status === 'preparing' && (
                            <button onClick={() => updateStatus(order.id, 'ready')} className={styles.btnReady}>Pronto</button>
                          )}
                          {order.status === 'ready' && (
                            <button onClick={() => updateStatus(order.id, 'out_for_delivery')} className={styles.btnShip}>Enviar</button>
                          )}
                          {order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <button 
                              onClick={() => {
                                if(confirm('Deseja realmente CANCELAR este pedido?')) {
                                  updateStatus(order.id, 'cancelled');
                                }
                              }} 
                              className={styles.btnCancel}
                              title="Cancelar Pedido"
                            >
                              <UserX size={18} />
                            </button>
                          )}
                          <button 
                            className={styles.btnDetails} 
                            onClick={() => router.push(`/order/${order.id}?from=admin`)}
                            title="Ver detalhes do pedido"
                          >
                            <ChevronRight size={18} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === 'menu' && (
          <div className={styles.menuContainer}>
            {categories.map(category => (
              <details key={category} className={styles.categorySection}>
                <summary className={styles.categoryHeader}>
                  <div className={styles.categoryTitle}>
                    <ChevronRight className={styles.chevron} />
                    <h3>{category}</h3>
                  </div>
                  <button className={styles.btnAddSub} onClick={(e) => {
                    e.preventDefault();
                    setNewProduct({...newProduct, category});
                    setIsModalOpen(true);
                  }}>
                    <Plus size={16} /> Add {category}
                  </button>
                </summary>

                <div className={styles.categoryContent}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Preço</th>
                        <th>Disponibilidade</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsList.filter(p => p.category === category).map(product => (
                        <tr key={product.id}>
                          <td>
                            <div className={styles.productCell}>
                              <img src={product.image} alt="" className={styles.productThumb} />
                              <div>
                                <strong>{product.name}</strong>
                                <p>{product.description?.slice(0, 60)}...</p>
                              </div>
                            </div>
                          </td>
                          <td><strong>R$ {product.price.toFixed(2)}</strong></td>
                          <td>
                            <button 
                              onClick={() => toggleProductStatus(product.id, product.available)}
                              className={`${styles.statusToggle} ${product.available ? styles.active : styles.inactive}`}
                            >
                              {product.available ? '✅ Ativo' : '❌ Pausado'}
                            </button>
                          </td>
                          <td>
                            <div className={styles.productActions}>
                              <button onClick={() => {
                                setEditingProduct(product);
                                setNewProduct({
                                  name: product.name,
                                  description: product.description || '',
                                  price: product.price.toString(),
                                  category: product.category,
                                  image: product.image || ''
                                });
                                setIsModalOpen(true);
                              }} className={styles.btnEdit}>
                                <Edit size={18} />
                              </button>
                              <button onClick={() => deleteProduct(product.id)} className={styles.btnDelete}>
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}

            {isModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                  <div className={styles.modalHeader}>
                    <h4>{editingProduct ? 'Editar Item' : 'Cadastrar Novo Item'}</h4>
                    <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }}>X</button>
                  </div>
                  <form onSubmit={saveProduct} className={styles.modalForm}>
                    <div className={styles.inputGroup}>
                      <label>Nome do Prato</label>
                      <input 
                        type="text" 
                        required 
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      />
                    </div>
                    <div className={styles.grid2}>
                      <div className={styles.inputGroup}>
                        <label>Preço (R$)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          required 
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Categoria</label>
                        <select 
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                        >
                          <option>Pratos</option>
                          <option>Bebidas</option>
                          <option>Sobremesas</option>
                          <option>Combos</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Descrição</label>
                      <textarea 
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                      ></textarea>
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Link da Foto (URL)</label>
                      <div className={styles.imageInputWrapper}>
                        <input 
                          type="text" 
                          value={newProduct.image}
                          placeholder="https://exemplo.com/foto.jpg"
                          onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                        />
                        {newProduct.image && (
                          <button 
                            type="button" 
                            className={styles.btnRemovePhoto}
                            onClick={() => setNewProduct({...newProduct, image: ''})}
                          >
                            Remover Foto
                          </button>
                        )}
                      </div>
                      {newProduct.image && (
                        <div className={styles.photoPreview}>
                          <img src={newProduct.image} alt="Preview" />
                        </div>
                      )}
                    </div>
                    <button type="submit" className={styles.btnSave}>
                      {editingProduct ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'clients' && (
          <div className={styles.orderContainer}>
            <div className={styles.searchBar}>
              <Search size={20} />
              <input 
                type="text" 
                placeholder="Buscar cliente por nome ou telefone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Resumo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)).map((client, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className={styles.clientIdentity}>
                        <div className={styles.avatar}>{client.name?.charAt(0) || 'C'}</div>
                        <strong>{client.name}</strong>
                      </div>
                    </td>
                    <td>{client.phone}</td>
                    <td>
                      <div className={styles.clientSummary}>
                        <span className={styles.itemCount}>{client.totalOrders} pedidos</span>
                        <small>Último: {new Date(client.lastOrder).toLocaleDateString('pt-BR')}</small>
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button 
                          className={styles.btnDetails}
                          onClick={() => {
                            setSelectedClient(client);
                            setIsClientModalOpen(true);
                          }}
                        >
                          Ver Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {isClientModalOpen && selectedClient && (
              <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                  <div className={styles.modalHeader}>
                    <div className={styles.clientTitle}>
                      <div className={styles.largeAvatar}>{selectedClient.name?.charAt(0)}</div>
                      <div>
                        <h4>{selectedClient.name}</h4>
                        <p>{selectedClient.phone}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsClientModalOpen(false)}>X</button>
                  </div>
                  
                  <div className={styles.clientDetailsContent}>
                    <div className={styles.detailBox}>
                      <label><MapPin size={14} /> Endereço Frequente</label>
                      <p>{selectedClient.address}</p>
                    </div>

                    <div className={styles.statsRow}>
                      <div className={styles.statItem}>
                        <span>Total de Pedidos</span>
                        <strong>{selectedClient.totalOrders}</strong>
                      </div>
                      <div className={styles.statItem}>
                        <span>Primeiro Pedido</span>
                        <strong>{new Date(orders.filter(o => o.customer_phone === selectedClient.phone).reverse()[0]?.created_at).toLocaleDateString('pt-BR')}</strong>
                      </div>
                    </div>

                    <div className={styles.orderHistoryList}>
                      <h5>Histórico Recente</h5>
                      {orders.filter(o => o.customer_phone === selectedClient.phone).slice(0, 5).map(order => (
                        <div key={order.id} className={styles.historyItem}>
                          <div className={styles.historyMain}>
                            <span>#{order.id.slice(0, 5)}</span>
                            <small>{new Date(order.created_at).toLocaleDateString('pt-BR')}</small>
                          </div>
                          <div className={styles.historyValue}>
                             {order.items?.length} itens
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      className={styles.btnWhatsappLarge}
                      onClick={() => {
                        const cleanPhone = selectedClient.phone.replace(/\D/g, '');
                        const message = encodeURIComponent("Olá " + selectedClient.name + "!");
                        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
                      }}
                    >
                      <MessageCircle size={20} />
                      Enviar Mensagem no WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'fees' && (
          <div className={styles.orderContainer}>
            <div className={styles.storeAddressConfig}>
              <div className={styles.storeAddressHeader}>
                <div>
                  <label>Endereço da Loja (Ponto de Partida)</label>
                  <p className={styles.currentAddress}>
                    {storeAddress || 'Nenhum endereço configurado.'}
                  </p>
                </div>
                <button className={styles.btnAddItemMain} onClick={() => setIsAddressModalOpen(true)}>
                  <MapPin size={18} /> Configurar Endereço
                </button>
              </div>
            </div>

            {isAddressModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                  <div className={styles.modalHeader}>
                    <h4>Configurar Endereço da Loja</h4>
                    <button onClick={() => setIsAddressModalOpen(false)}>X</button>
                  </div>
                  <div className={styles.modalForm}>
                    <div className={styles.grid2}>
                      <div className={styles.inputGroup}>
                        <label>CEP</label>
                        <input 
                          type="text" 
                          value={storeAddressData.cep}
                          onChange={(e) => setStoreAddressData({...storeAddressData, cep: e.target.value})}
                          onBlur={handleStoreCEPBlur}
                          placeholder="00000-000"
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Cidade</label>
                        <input 
                          type="text" 
                          value={storeAddressData.city}
                          onChange={(e) => setStoreAddressData({...storeAddressData, city: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Rua / Avenida</label>
                      <input 
                        type="text" 
                        value={storeAddressData.street}
                        onChange={(e) => setStoreAddressData({...storeAddressData, street: e.target.value})}
                      />
                    </div>
                    <div className={styles.grid2}>
                      <div className={styles.inputGroup}>
                        <label>Número</label>
                        <input 
                          type="text" 
                          value={storeAddressData.number}
                          onChange={(e) => setStoreAddressData({...storeAddressData, number: e.target.value})}
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Bairro</label>
                        <input 
                          type="text" 
                          value={storeAddressData.neighborhood}
                          onChange={(e) => setStoreAddressData({...storeAddressData, neighborhood: e.target.value})}
                        />
                      </div>
                    </div>
                    <button className={styles.btnSave} onClick={saveStoreAddress}>
                      Salvar Endereço da Loja
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.feeForm}>
              <div className={styles.inputGroup}>
                <label>Distância Máxima (km)</label>
                <input 
                  type="number" 
                  value={newDistanceFee.maxKm}
                  onChange={(e) => setNewDistanceFee({...newDistanceFee, maxKm: e.target.value})}
                  placeholder="Ex: 5"
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Valor da Taxa (R$)</label>
                <input 
                  type="number" 
                  value={newDistanceFee.price}
                  onChange={(e) => setNewDistanceFee({...newDistanceFee, price: e.target.value})}
                  placeholder="Ex: 7.00"
                />
              </div>
              <button className={styles.btnSaveRule} onClick={addDistanceFee}>
                <Plus size={20} /> Adicionar Regra
              </button>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Raio de Distância</th>
                  <th>Valor da Taxa</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {distanceFees.map((fee, idx) => (
                  <tr key={idx}>
                    <td><strong>Até {fee.maxKm} Km</strong></td>
                    <td>R$ {fee.price.toFixed(2)}</td>
                    <td>
                      <button className={styles.btnDelete} onClick={() => removeDistanceFee(idx)}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {distanceFees.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                      Nenhuma regra de distância configurada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === 'drivers' && (
          <>
            <div className={styles.driversContainer}>
               <div className={styles.adminActionHeader}>
                <button className={styles.btnAddItemMain} onClick={() => setIsDriverModalOpen(true)}>
                  <Plus size={20} /> Novo Motoboy
                </button>
              </div>

              <div className={styles.driversList}>
                {drivers.map(driver => (
                  <div key={driver.id} className={styles.driverCard}>
                    <div className={styles.driverHeader}>
                      <div className={styles.driverInfoMain}>
                        <strong className={styles.driverName}>{driver.name}</strong>
                        <span className={styles.driverPhone}>{driver.phone}</span>
                      </div>
                      <button 
                        onClick={() => toggleDriverStatus(driver.id, driver.active)}
                        className={`${styles.statusToggle} ${driver.active ? styles.active : styles.inactive}`}
                      >
                        {driver.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                    
                    <div className={styles.driverActions}>
                      <button 
                        onClick={() => copyDriverLink(driver.id)} 
                        className={styles.btnCopyLink}
                      >
                        <Link size={18} /> Copiar Link de Acesso
                      </button>
                      <button 
                        onClick={() => {
                          setEditingDriver(driver);
                          setNewDriver({ name: driver.name, phone: driver.phone || '', pin: driver.pin || '' });
                          setIsDriverModalOpen(true);
                        }} 
                        className={styles.btnEditDriver}
                      >
                        <Edit size={18} />
                      </button>
                      <button onClick={() => deleteDriver(driver.id)} className={styles.btnDeleteDriver}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isDriverModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                  <div className={styles.modalHeader}>
                    <h4>{editingDriver ? 'Editar Motoboy' : 'Cadastrar Motoboy'}</h4>
                    <button onClick={() => { setIsDriverModalOpen(false); setEditingDriver(null); setNewDriver({ name: '', phone: '', pin: '' }); }}>X</button>
                  </div>
                  <form onSubmit={saveDriver} className={styles.modalForm}>
                    <div className={styles.inputGroup}>
                      <label>Nome do Motoboy</label>
                      <input 
                        type="text" 
                        required 
                        value={newDriver.name}
                        onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        placeholder="(00) 00000-0000"
                        value={newDriver.phone}
                        onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>PIN de Acesso (4 dígitos)</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        placeholder="Ex: 1234"
                        required 
                        value={newDriver.pin}
                        onChange={(e) => setNewDriver({...newDriver, pin: e.target.value.replace(/\D/g, '')})}
                      />
                    </div>
                    <button type="submit" className={styles.btnSave}>Salvar Motoboy</button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
