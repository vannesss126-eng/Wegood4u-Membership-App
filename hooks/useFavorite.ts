import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface UseFavoriteReturn {
  isFavorited: boolean;
  isLoading: boolean;
  isToggling: boolean;
  error: string | null;
  /** Flips the favorite state via the toggle_favorite RPC. Returns the new state, or null on failure. */
  toggle: () => Promise<boolean | null>;
}

/**
 * Tracks and toggles whether the given partner store is favorited by the user.
 * No-ops gracefully when storeId or userId is missing (guest / not loaded yet).
 */
export function useFavorite(
  storeId: string | undefined,
  userId: string | undefined
): UseFavoriteReturn {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Load the initial favorited state. RLS scopes the row to the caller.
  useEffect(() => {
    let active = true;
    if (!storeId || !userId) {
      setIsFavorited(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('user_favorite_stores')
      .select('partner_store_id')
      .eq('user_id', userId)
      .eq('partner_store_id', storeId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active || !mountedRef.current) return;
        if (fetchError) {
          console.error('[useFavorite] fetch failed:', fetchError);
          setError(fetchError.message ?? 'Failed to load favorite');
        } else {
          setIsFavorited(!!data);
        }
        setIsLoading(false);
      });
    return () => { active = false; };
  }, [storeId, userId]);

  const toggle = useCallback(async (): Promise<boolean | null> => {
    if (!storeId || !userId || isToggling) return null;
    setIsToggling(true);
    setError(null);

    // Optimistic flip — revert if the RPC fails.
    const previous = isFavorited;
    setIsFavorited(!previous);

    try {
      const { data, error: rpcError } = await supabase.rpc('toggle_favorite', {
        p_partner_store_id: storeId,
      });
      if (rpcError) throw rpcError;
      const next = data as boolean;
      if (mountedRef.current) setIsFavorited(next);
      return next;
    } catch (err: any) {
      console.error('[useFavorite] toggle failed:', err);
      if (mountedRef.current) {
        setIsFavorited(previous); // revert
        setError(err.message ?? 'Failed to update favorite');
      }
      return null;
    } finally {
      if (mountedRef.current) setIsToggling(false);
    }
  }, [storeId, userId, isFavorited, isToggling]);

  return { isFavorited, isLoading, isToggling, error, toggle };
}

export interface FavoriteStore {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  image: string;
  priceRange?: string;
  favoritedAt: string;
}

type FavoriteRow = {
  id: string;
  name: string;
  type: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image: string | null;
  price_range: string | null;
  favorited_at: string;
};

export interface UseFavoritesReturn {
  favorites: FavoriteStore[];
  count: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the calling user's favorited stores (with details) via get_user_favorites.
 * Powers both the Favorites page and the profile stat count.
 */
export function useFavorites(userId: string | undefined): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_user_favorites');
      if (rpcError) throw rpcError;
      const mapped: FavoriteStore[] = ((data ?? []) as FavoriteRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type ?? '',
        city: row.city,
        address: row.address ?? '',
        latitude: row.latitude ?? 0,
        longitude: row.longitude ?? 0,
        rating: row.rating ?? 0,
        image: row.image ?? '',
        priceRange: row.price_range ?? undefined,
        favoritedAt: row.favorited_at,
      }));
      if (mountedRef.current) setFavorites(mapped);
    } catch (err: any) {
      console.error('[useFavorites] fetch failed:', err);
      if (mountedRef.current) setError(err.message ?? 'Failed to load favorites');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refetch whenever this user's favorites change (add or remove).
  // user_favorite_stores is in the supabase_realtime publication, and both
  // columns are in the PK (replica identity), so the user_id filter works for
  // DELETE events too. Keeps the profile count + list live without a refocus.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`favorites:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_favorite_stores',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  return { favorites, count: favorites.length, isLoading, error, refresh };
}
