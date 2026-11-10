# 07 — Implantação na VM da Univates

Execução direta no sistema operacional, sem contêineres (RNF03). Tudo o que está aqui foi automatizado em `infra/scripts/deploy-vm.sh`.

## 1. Processos e portas

| Processo | Porta | Escuta | Unit |
|---|---|---|---|
| Nginx (gateway + SPAs) | 80 | todas | `nginx.service` |
| identity-service (Java) | 8081 | 127.0.0.1 | `medicalfield-identity.service` |
| clinical-service (TypeScript) | 3001 | 127.0.0.1 | `medicalfield-clinical.service` |
| document-service (Python) | 8000 | 127.0.0.1 | `medicalfield-document.service` |
| PostgreSQL 16 | 5432 | 127.0.0.1 | `postgresql.service` |

Só o Nginx fica exposto.

## 2. Pré-requisitos (Ubuntu)

```bash
sudo apt update
sudo apt install -y nginx postgresql openjdk-21-jdk maven python3 python3-venv rsync \
                    libpango-1.0-0 libpangoft2-1.0-0   # WeasyPrint (PDF)
# Node.js 22 LTS (NodeSource):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

## 3. Implantar

```bash
git clone <repositório> medicalfield && cd medicalfield
sudo infra/scripts/deploy-vm.sh
```

O script, de forma idempotente:
1. cria o usuário de sistema `medicalfield` e as pastas `/opt/medicalfield`, `/etc/medicalfield`, `/var/www/medicalfield` e `/var/lib/medicalfield/{fichas,mail}`;
2. gera senhas e cria banco, usuários e *schemas* (`infra/db/init.sql`);
3. gera o par de chaves JWT (`/etc/medicalfield/jwt-*.pem`);
4. escreve `/etc/medicalfield/{identity,clinical,document}.env` (só na primeira vez);
5. compila tudo (`npm run build`, `mvn package`) e copia os artefatos;
6. instala os *units* do systemd (`infra/systemd/`) e o site do Nginx (gerado de `infra/nginx/medicalfield.conf.template`);
7. reinicia os serviços. Na primeira subida, as migrações criam as tabelas e os dados de demonstração.

Acesso: `http://<ip-da-vm>/portal/` e `http://<ip-da-vm>/app/`. API para o Postman: `http://<ip-da-vm>/api`.

## 4. Estrutura na VM

```
/opt/medicalfield/
  identity-service/identity-service.jar
  clinical-service/{dist,migrations,seeds,node_modules}
  document-service/{app,migrations,.venv}
/etc/medicalfield/   identity.env clinical.env document.env db-passwords jwt-private.pem jwt-public.pem
/var/www/medicalfield/{app,portal}
/var/lib/medicalfield/{fichas,mail}
```

## 5. E-mail

Sem `SMTP_HOST`, o document-service grava cada e-mail completo, com o PDF anexo, em `/var/lib/medicalfield/mail/*.eml` (abre em qualquer cliente de e-mail). Para envio real, preencha em `/etc/medicalfield/document.env`:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=conta.demo@gmail.com
SMTP_PASSWORD=<senha de app>
SMTP_FROM="MedicalField <conta.demo@gmail.com>"
```
e `sudo systemctl restart medicalfield-document`. Teste isso cedo: algumas redes bloqueiam a porta 587.

## 6. Operação

| Tarefa | Comando |
|---|---|
| Situação | `systemctl status 'medicalfield-*'` |
| Logs (inclui log de acesso em JSON) | `journalctl -u medicalfield-clinical -f` |
| Reiniciar | `sudo systemctl restart medicalfield-identity medicalfield-clinical medicalfield-document` |
| Zerar para ensaiar o roteiro | `sudo -u postgres psql -d medicalfield -c 'DROP SCHEMA identity, clinical, document CASCADE'` → `sudo infra/scripts/deploy-vm.sh` |
| Passo 9 do roteiro | `sudo -u postgres psql -d medicalfield -f infra/db/roteiro/passo-09-novos-medicamentos.sql` |

## 7. Riscos de ambiente

| Risco | Mitigação |
|---|---|
| Porta SMTP bloqueada | Use o modo arquivo (`.eml`) na apresentação. |
| Pouca memória | A JVM é limitada a `-Xmx384m`; o resto ocupa ~250 MB. |
| Firewall só libera a 80 | Tudo passa pelo Nginx. |

## 8. Ambiente local (desenvolvimento)

O mesmo arranjo roda numa máquina de desenvolvimento, com o Nginx na porta 8080:

```bash
infra/scripts/start-all.sh    # setup + build + serviços + nginx → http://localhost:8080
infra/scripts/stop-all.sh
infra/scripts/reset-db.sh     # zera os três schemas
```
