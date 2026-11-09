import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AccessLogService } from './common/access-log';
import { JwtAuthGuard } from './common/auth';
import { ProblemFilter } from './common/problem.filter';
import { DatabaseService } from './db/database.service';
import { AtendimentoController } from './atendimento/atendimento.controller';
import { AtendimentoService } from './atendimento/atendimento.service';
import { AuditoriaController } from './auditoria/auditoria.controller';
import { CatalogoController } from './catalogo/catalogo.controller';
import { PessoaController } from './pessoa/pessoa.controller';
import { PessoaService } from './pessoa/pessoa.service';
import { ProntuarioController } from './prontuario/prontuario.controller';
import { ProntuarioService } from './prontuario/prontuario.service';
import { SyncController } from './sync/sync.controller';
import { SyncSupport } from './sync/sync-support';

@Module({
  controllers: [
    PessoaController,
    ProntuarioController,
    AtendimentoController,
    CatalogoController,
    SyncController,
    AuditoriaController,
  ],
  providers: [
    DatabaseService,
    AccessLogService,
    SyncSupport,
    PessoaService,
    ProntuarioService,
    AtendimentoService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
