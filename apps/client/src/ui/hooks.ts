import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { sessao } from '../auth/session';
import { db } from '../data/db';
import { syncEngine, type EstadoSync } from '../sync/engine';
import { network } from '../sync/network';

export function useSessao() {
  return useSyncExternalStore(sessao.subscribe, sessao.get);
}

export interface EstadoRede {
  online: boolean;
  simulador: boolean;
  redeReal: boolean;
}

const lerRede = (): EstadoRede => ({ online: network.isOnline(), simulador: network.simulador, redeReal: network.redeReal });

export function useRede(): EstadoRede {
  const [estado, setEstado] = useState(lerRede);
  useEffect(() => network.subscribe({ onNetworkChange: () => setEstado(lerRede()) }), []);
  return estado;
}

export function useSync(): EstadoSync {
  const [estado, setEstado] = useState(syncEngine.atual);
  useEffect(() => syncEngine.subscribe(setEstado), []);
  return estado;
}

/** Operações ainda não confirmadas pela central. */
export function usePendentes() {
  return (
    useLiveQuery(async () => {
      const ops = await db.outbox.where('status').anyOf('PENDENTE', 'ENVIANDO', 'ERRO').toArray();
      return { total: ops.length, erros: ops.filter((o) => o.status === 'ERRO').length };
    }) ?? { total: 0, erros: 0 }
  );
}
