import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

export interface Product {
  id: number;
  title: string;
  description: string | null;
  category: 'Horoscope' | 'Zodiac';
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseProductsReturn {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refetch: (showRefreshIndicator?: boolean) => Promise<void>;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (showRefreshIndicator = false) => {
    if (!showRefreshIndicator) {
      setIsLoading(true);
    }

    try {
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('product')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching products:', fetchError);
        throw new Error('Failed to fetch products');
      }

      setProducts(data || []);
    } catch (err: any) {
      console.error('Error in fetchProducts:', err);
      setError(err.message);
      if (!showRefreshIndicator) {
        Alert.alert('Error', 'Failed to fetch products');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    refetch: fetchProducts,
  };
}