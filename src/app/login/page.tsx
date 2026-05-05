'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ChefHat, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import styles from './login.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

   const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Admin Login (Hardcoded)
    if (username === 'adminmaria' && password === 'maria1234') {
      localStorage.setItem('user_role', 'admin');
      router.push('/admin');
      return;
    }

    // Driver Login (Database check)
    try {
      const { data: driver, error: dbError } = await supabase
        .from('drivers')
        .select('*')
        .ilike('name', username)
        .eq('pin', password)
        .single();

      if (driver && !dbError) {
        if (!driver.active) {
          setError('Sua conta está bloqueada. Fale com a Maria.');
          return;
        }
        sessionStorage.setItem('user_role', 'driver');
        sessionStorage.setItem('delicias_driver', JSON.stringify(driver));
        router.push('/driver');
      } else {
        setError('Usuário ou PIN incorretos.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao conectar ao servidor.');
    }
  };

  return (
    <main className={styles.main}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={styles.loginCard}
      >
        <div className={styles.header}>
          <div className={styles.logo}>Delícias de Maria</div>
          <h1>Acesso Restrito</h1>
          <p>Digite seu usuário e senha para acessar.</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Usuário</label>
            <div className={styles.inputWrapper}>
              <User size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: adminmaria ou seu nome"
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Senha / PIN</label>
            <div className={styles.inputWrapper}>
              <Lock size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha ou PIN"
                required
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.loginBtn}>
            Entrar no Sistema
          </button>
        </form>

        <div className={styles.footer}>
          <div className={styles.hint}>
            <ChefHat size={16} /> <span>Acesso Cozinha</span>
          </div>
          <div className={styles.hint}>
            <Truck size={16} /> <span>Acesso Motoboy</span>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
