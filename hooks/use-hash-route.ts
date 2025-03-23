'use client'
import { useState, useEffect } from 'react';

export const useHash = () => {
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : undefined);
  useEffect(() => {
    const onHashChange = () => {
      if (typeof window !== 'undefined') {
        setHash(window.location.hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
};