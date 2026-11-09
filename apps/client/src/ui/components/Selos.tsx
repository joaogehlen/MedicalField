import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { SyncStatus } from '../../data/db';

export function SeloSync({ status, erro }: { status: SyncStatus; erro?: string | null }) {
  if (status === 'SINCRONIZADO') {
    return (
      <span className="selo selo-ok">
        <CheckCircle2 aria-hidden /> Na central
      </span>
    );
  }
  if (status === 'ERRO') {
    return (
      <span className="selo selo-erro" title={erro ?? undefined}>
        <AlertTriangle aria-hidden /> Recusado
      </span>
    );
  }
  return (
    <span className="selo selo-pendente">
      <Clock aria-hidden /> Só no aparelho
    </span>
  );
}

export function SeloOffline() {
  return <span className="selo selo-offline">Registrado offline</span>;
}
