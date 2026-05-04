'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ChefHat, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './login.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (username === 'adminmaria' && password === 'maria1234') {
      localStorage.setItem('user_role', 'admin');
      router.push('/admin');
    } else if (username === 'motoca1' && password === 'motoca1234') {
      localStorage.setItem('user_role', 'driver');
      router.push('/driver');
    } else {
      setError('Usuário ou senha incorretos.');
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
          <p>Selecione seu perfil e faça login.</p>
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
                placeholder="Digite seu usuário"
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Senha</label>
            <div className={styles.inputWrapper}>
              <Lock size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
