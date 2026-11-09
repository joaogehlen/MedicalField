import type { Request } from 'express';
import type { Papel } from '@medicalfield/shared';

export interface UsuarioToken {
  id: string;
  nome: string;
  papel: Papel;
  registro: string;
}

export interface MfRequest extends Request {
  usuario?: UsuarioToken;
  requestId?: string;
}
