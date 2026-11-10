import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { medicamentoDeLinha } from '../common/mappers';

/** Cadastro de apoio: medicamentos (somente leitura; inserções direto no banco). */
@Controller('medicamento')
export class CatalogoController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async listar() {
    return (await this.db.query('SELECT * FROM medicamento WHERE ativo ORDER BY nome')).map(medicamentoDeLinha);
  }
}
