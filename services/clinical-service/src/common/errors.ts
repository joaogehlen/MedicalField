import { HttpStatus } from '@nestjs/common';

/** Erro de negócio convertido em Problem Details pelo filtro global. */
export class ApiError extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly codigo: string,
    readonly titulo: string,
    detalhe: string,
    readonly extras: Record<string, unknown> = {},
  ) {
    super(detalhe);
  }

  static naoEncontrado(oQue: string) {
    return new ApiError(HttpStatus.NOT_FOUND, 'NAO_ENCONTRADO', 'Não encontrado', `${oQue} não encontrado.`);
  }

  static dependenciaAusente(detalhe: string) {
    return new ApiError(HttpStatus.CONFLICT, 'DEPENDENCIA_AUSENTE', 'Dependência ausente', detalhe);
  }
}
