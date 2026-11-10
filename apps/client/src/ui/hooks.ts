import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { sessao } from '../auth/session';
import { db } from '../data/db';
import { syncEngine, type EstadoSync } from '../sync/engine';
import { network } from '../sync/network';

export const useSessao = () => useSyncExternalStore(sessao.subscribe, sessao.get);

export function useRede() {
  const ler = () => ({ online: network.isOnline(), simulador: network.simulador });
  const [estado, setEstado] = useState(ler);
  useEffect(() => network.subscribe({ onNetworkChange: () => setEstado(ler()) }), []);
  return estado;
}

export function useSync(): EstadoSync {
  const [estado, setEstado] = useState(syncEngine.atual);
  useEffect(() => syncEngine.subscribe(setEstado), []);
  return estado;
}

/** Quantas operações ainda não chegaram à central. */
export const usePendentes = () => useLiveQuery(() => db.outbox.where('status').equals('PENDENTE').count()) ?? 0;
