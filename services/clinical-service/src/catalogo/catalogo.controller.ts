import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { ApiError } from '../common/errors';
import { hospitalDeLinha, medicamentoDeLinha, viaturaDeLinha } from '../common/mappers';

/** Cadastros de apoio (somente leitura; inserções direto no banco). */
@Controller()
export class CatalogoController {
  constructor(private readonly db: DatabaseService) {}

  @Get('medicamento')
  async medicamentos(@Query('incluirInativos') incluirInativos?: string) {
    const linhas = await this.db.query(
      `SELECT * FROM medicamento WHERE ($1 OR ativo) ORDER BY nome`,
      [incluirInativos === 'true'],
    );
    return linhas.map(medicamentoDeLinha);
  }

  @Get('medicamento/:id')
  async medicamento(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.db.one('SELECT * FROM medicamento WHERE id = $1', [id]);
    if (!r) throw ApiError.naoEncontrado('Medicamento');
    return medicamentoDeLinha(r);
  }

  @Get('apoio/hospital')
  async hospitais() {
    return (await this.db.query('SELECT * FROM hospital ORDER BY nome')).map(hospitalDeLinha);
  }

  @Get('apoio/viatura')
  async viaturas() {
    return (await this.db.query('SELECT * FROM viatura ORDER BY prefixo')).map(viaturaDeLinha);
  }
}
