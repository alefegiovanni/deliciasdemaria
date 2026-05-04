# Delícias de Maria - Sistema de Delivery

Sistema completo de delivery web com três perfis: Cliente, Cozinha e Motoboy.

## 🚀 Como Rodar

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Configure o Supabase (Opcional para persistência):**
    Crie um arquivo `.env.local` na raiz com suas credenciais:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
    ```

3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

## 📂 Estrutura de Rotas

-   `/` - **Cliente:** Menu, Carrinho e Checkout.
-   `/order/[id]` - **Cliente:** Acompanhamento de status (sem mapa).
-   `/admin` - **Cozinha:** Dashboard de pedidos e controle de status.
-   `/admin/tracking` - **Cozinha:** Mapa de rastreamento em tempo real (exclusivo).
-   `/driver` - **Motoboy:** Lista de entregas, navegação e confirmação.

## ✨ Tecnologias Utilizadas

-   **Next.js 15 (App Router)**
-   **TypeScript**
-   **Vanilla CSS (CSS Modules)** para um design premium e flexível.
-   **Framer Motion** para animações suaves.
-   **Lucide React** para ícones modernos.
-   **Supabase** (Preparado para Real-time e Autenticação).

## 🎨 Design System

-   **Primária:** `#D44E6D` (Berry/Rosa Intenso)
-   **Secundária:** `#FCE4EC` (Rosa Suave)
-   **Acento:** `#FFB300` (Âmbar/Mel)
-   **Tipografia:** Outfit (Sans) e Playfair Display (Serif)
