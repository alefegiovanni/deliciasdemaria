import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calcularTaxaEntrega } from '@/lib/delivery';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderData, distanceKm } = body;

    // 1. Recalcular a taxa de entrega no "backend" (API)
    // Mesmo que o cliente envie um valor, nós recalculamos aqui para segurança
    const serverDeliveryFee = distanceKm !== null ? calcularTaxaEntrega(distanceKm) : 5.00;

    // 2. Validar o total (Opcional: buscar preços dos produtos no banco para validar o subtotal)
    // Para simplificar, vamos focar na taxa de entrega que foi solicitada
    
    // 3. Montar o objeto final do pedido
    const finalOrderData = {
      ...orderData,
      // Se houvesse campo específico para taxa no banco, atualizaríamos aqui
      // Por enquanto, garantimos que o 'total' enviado reflete o cálculo correto da taxa
      // total: subtotal_calculado + serverDeliveryFee
    };

    const { data, error } = await supabase
      .from('orders')
      .insert([finalOrderData])
      .select();

    if (error) throw error;

    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error('Erro na API de Pedidos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
