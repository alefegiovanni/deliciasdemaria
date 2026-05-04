export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Marmita de Frango Grelhado',
    description: 'Peito de frango grelhado, arroz integral, legumes e purê de batata doce.',
    price: 24.90,
    image: '/images/fit_chicken.png',
    category: 'Executivo'
  },
  {
    id: '2',
    name: 'Marmita de Feijoada',
    description: 'Feijoada completa acompanhada de arroz, couve, farofa e laranja.',
    price: 28.00,
    image: '/images/feijoada.png',
    category: 'Especial'
  },
  {
    id: '3',
    name: 'Marmita de Salmão',
    description: 'Filé de salmão grelhado com espaguete de abobrinha e molho pesto.',
    price: 35.90,
    image: '/images/salmon_lowcarb.png',
    category: 'Premium'
  },
  {
    id: '4',
    name: 'Marmita Vegetariana',
    description: 'Risoto de cogumelos com parmesão e mix de folhas.',
    price: 26.50,
    image: '/images/veggie_risotto.png',
    category: 'Vegetariana'
  }
];
