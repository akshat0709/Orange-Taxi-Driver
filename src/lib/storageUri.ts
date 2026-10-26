import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Resolves `storage://<bucket>/<path>` (private driver_kyc bucket) to a short-lived signed URL.
 * KYC photos are stored as storage references, which <Image> cannot load directly.
 */
export function useSignedImageUri(src?: string | null): string | undefined {
  const [uri, setUri] = useState<string | undefined>(src && !src.startsWith('storage://') ? src : undefined);
  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setUri(undefined);
      return;
    }
    if (!src.startsWith('storage://')) {
      setUri(src);
      return;
    }
    const rest = src.slice('storage://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return;
    supabase.storage
      .from(rest.slice(0, slash))
      .createSignedUrl(rest.slice(slash + 1), 3600)
      .then(({ data }) => {
        if (!cancelled) setUri(data?.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return uri;
}
