# Procedimento T.I. - Coonagro Business Intelligence

## 1. Identificacao do Sistema

Nome do sistema: Coonagro Business Intelligence

Objetivo: sistema web para cadastro, acompanhamento, aprovacao e relatorio de pedidos comerciais, com controle de usuarios, perfis, permissoes, cadastros auxiliares, painel de vendas e autenticacao com codigo enviado por e-mail.

Dominio de producao:

```text
https://coobi.coonagro.com.br
```

IP publico da VPS:

```text
129.121.33.50
```

Servidor:

```text
HostGator VPS
Ubuntu Linux
Docker + Docker Compose
```

Acesso SSH:

```bash
ssh -p 22022 root@129.121.33.50
```

Diretorio da aplicacao no servidor:

```text
/root/pedidos_comercial
```

## 2. Arquitetura em Producao

O sistema roda em containers Docker pelo arquivo:

```text
/root/pedidos_comercial/docker-compose.prod.yml
```

Containers principais:

```text
pedidos-comercial-app        Aplicacao Next.js
pedidos-comercial-caddy      Proxy reverso e HTTPS automatico
pedidos-comercial-postgres   Banco PostgreSQL
```

Portas publicadas:

```text
80/tcp    HTTP, redirecionado para HTTPS
443/tcp   HTTPS
```

O container `app` escuta internamente na porta `3000`. O Caddy recebe o acesso externo e encaminha para `app:3000`.

O banco PostgreSQL nao fica exposto publicamente. Ele e acessado pela aplicacao usando o host interno Docker `postgres`.

## 3. DNS e HTTPS

Registro DNS esperado:

```text
coobi.coonagro.com.br A 129.121.33.50
```

Validacao:

```bash
dig +short coobi.coonagro.com.br
```

Resultado esperado:

```text
129.121.33.50
```

O HTTPS e emitido automaticamente pelo Caddy via Let's Encrypt. O arquivo de configuracao fica em:

```text
/root/pedidos_comercial/docker/Caddyfile
```

Conteudo esperado:

```caddy
{$APP_DOMAIN} {
  encode gzip
  reverse_proxy app:3000
}
```

## 4. Variaveis de Ambiente

Arquivo real de producao:

```text
/root/pedidos_comercial/.env.production
```

Nao versionar e nao compartilhar esse arquivo, pois contem senhas e segredos.

Variaveis principais esperadas:

```env
APP_DOMAIN="coobi.coonagro.com.br"
AUTH_BASE_URL="https://coobi.coonagro.com.br"
SESSION_COOKIE_SECURE="true"
NEXT_PUBLIC_APP_NAME="Coonagro Business Intelligence"

POSTGRES_DB="comercial_pedidos"
POSTGRES_USER="..."
POSTGRES_PASSWORD="..."
DATABASE_URL="postgresql://...@postgres:5432/comercial_pedidos?schema=public"

SESSION_SECRET="..."
ADMIN_INITIAL_PASSWORD="..."

SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_STARTTLS="true"
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM="Coonagro Business Intelligence <...>"
SMTP_HELO="coonagro.coop.br"
```

Para verificar as variaveis sem abrir editor:

```bash
cd /root/pedidos_comercial
grep -E '^(APP_DOMAIN|AUTH_BASE_URL|SESSION_COOKIE_SECURE|NEXT_PUBLIC_APP_NAME|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_FROM|SMTP_HELO)=' .env.production
```

Nao exibir `SMTP_PASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL` ou `SESSION_SECRET` em canais abertos.

## 5. Comandos Operacionais

Entrar no diretorio:

```bash
cd /root/pedidos_comercial
```

Ver status dos containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

Subir ou atualizar com rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Rebuild sem cache, quando houver suspeita de build antigo:

```bash
docker compose -f docker-compose.prod.yml build --no-cache app
docker compose -f docker-compose.prod.yml up -d
```

Parar a aplicacao:

```bash
docker compose -f docker-compose.prod.yml stop
```

Subir novamente:

```bash
docker compose -f docker-compose.prod.yml start
```

Reiniciar somente a aplicacao:

```bash
docker compose -f docker-compose.prod.yml restart app
```

Reiniciar Caddy:

```bash
docker compose -f docker-compose.prod.yml restart caddy
```

Ver logs da aplicacao:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

Ver logs do Caddy:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 caddy
```

Ver logs em tempo real:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Importante: nao usar em producao:

```bash
docker compose -f docker-compose.prod.yml down -v
```

Esse comando remove volumes e pode apagar o banco de dados.

## 6. Atualizacao do Sistema

Fluxo recomendado para atualizar a VPS:

1. Gerar pacote `.tar.gz` da versao atual no ambiente de desenvolvimento, excluindo `.env`, `.next`, `node_modules`, backups e dados locais.
2. Enviar para o servidor via `scp`.
3. Fazer backup da pasta atual.
4. Extrair o pacote sobre `/root/pedidos_comercial`.
5. Conferir `.env.production`.
6. Executar rebuild dos containers.

Exemplo de envio:

```bash
scp -P 22022 release/ARQUIVO.tar.gz root@129.121.33.50:/root/
```

No VPS:

```bash
cd /root/pedidos_comercial
tar -czf /root/pedidos_comercial_backup_antes_update_$(date +%Y%m%d_%H%M%S).tar.gz .
tar -xzf /root/ARQUIVO.tar.gz -C /root/pedidos_comercial
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

O container `app` executa automaticamente antes de iniciar:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Nao criar migration para alteracoes visuais, menu, cor, logo ou textos.

## 7. Backup do Banco

Backup manual recomendado:

```bash
mkdir -p /root/backups/postgresql

docker compose -f /root/pedidos_comercial/docker-compose.prod.yml exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --file=/tmp/coobi.dump

docker cp pedidos-comercial-postgres:/tmp/coobi.dump /root/backups/postgresql/coobi-$(date +%Y%m%d-%H%M%S).dump
```

Se as variaveis do shell nao estiverem carregadas, consulte usuario e banco no `.env.production` e substitua no comando:

```bash
grep -E '^(POSTGRES_USER|POSTGRES_DB)=' /root/pedidos_comercial/.env.production
```

## 8. Restauracao do Banco

Antes de restaurar, parar a aplicacao para evitar gravacoes simultaneas:

```bash
cd /root/pedidos_comercial
docker compose -f docker-compose.prod.yml stop app
```

Copiar o dump para o container:

```bash
docker cp /root/backups/postgresql/ARQUIVO.dump pedidos-comercial-postgres:/tmp/restore.dump
```

Restaurar:

```bash
docker compose -f docker-compose.prod.yml exec postgres pg_restore \
  -U USUARIO_DO_BANCO \
  -d NOME_DO_BANCO \
  --clean \
  --if-exists \
  /tmp/restore.dump
```

Subir a aplicacao:

```bash
docker compose -f docker-compose.prod.yml start app
```

## 9. Funcionalidades do Sistema

Menu principal:

```text
Dashboard
Painel de Vendas
Novo Pedido
Meus Pedidos
Todos os Pedidos
Relatorio
Cadastro
Configuracao
```

Dashboard:

```text
Indicadores e contadores de pedidos conforme permissoes do usuario.
```

Painel de Vendas:

```text
Metas, realizado, evolucao mensal, share por cliente e filtros comerciais.
```

Pedidos:

```text
Novo Pedido
Meus Pedidos
Todos os Pedidos
Fluxo de cadastro, acompanhamento e mudanca de status dos pedidos.
```

Relatorios:

```text
Relatorio de Vendas
Relatorio da Lista Tecnica
Exportacoes e filtros conforme permissao do usuario.
```

Cadastros:

```text
Clientes
Produtos
Tipos de Contrato
Tipos de MP
Materias-Primas
Embalagens
Moedas
Importacao em Massa
```

As telas de cadastro possuem pesquisa por texto contendo a palavra informada e paginacao de 50 registros por pagina.

Configuracao:

```text
Usuarios
Perfis e Permissoes
Meu Perfil
```

Controle de acesso:

```text
O menu e as telas respeitam as permissoes do perfil do usuario.
Itens sem permissao nao devem aparecer.
Grupos vazios nao devem aparecer.
```

Autenticacao:

```text
Login local com usuario/e-mail e senha.
Codigo de verificacao enviado por e-mail.
Suporte previsto para OAuth Google/Microsoft quando configurado.
Sessao por cookie HTTP-only.
```

## 10. Importacao em Massa

Tela:

```text
Cadastro > Importacao em Massa
```

Rota:

```text
/importacao-em-massa
```

Tipos suportados pelo servico:

```text
Clientes
Produtos
Materias-primas
```

A tela deve aparecer apenas para usuarios com permissao de criacao correspondente.

## 11. E-mail do Codigo de Login

O envio de codigo usa SMTP configurado no `.env.production`.

Para Office 365, a configuracao padrao esperada e:

```env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_STARTTLS="true"
```

Pontos de atencao:

```text
SMTP AUTH precisa estar habilitado na conta.
Usuario e senha SMTP precisam estar corretos.
SMTP_FROM deve preferencialmente usar o mesmo e-mail do SMTP_USER, salvo se houver permissao de "Send As".
```

Mensagem de erro comum na tela:

```text
Nao foi possivel enviar o codigo por e-mail. Verifique a configuracao SMTP.
```

Nesse caso, conferir logs:

```bash
cd /root/pedidos_comercial
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

## 12. Validacoes de Cadastro

O sistema bloqueia cadastros duplicados em telas de cadastro, conforme regras da aplicacao.

Exemplos:

```text
Produto nao deve ser duplicado com mesmo nome, unidade e descricao.
Moeda nao deve repetir codigo.
Cliente nao deve repetir CNPJ.
Cadastros simples nao devem repetir nome.
```

## 13. Testes e Validacao Antes de Publicar

Antes de subir alteracoes para producao, executar no ambiente de desenvolvimento:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Se houver alteracao visual, validar tambem no navegador.

## 14. Solucao de Problemas

Sistema fora do ar:

```bash
cd /root/pedidos_comercial
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 caddy
```

Certificado HTTPS nao emite:

```text
Confirmar DNS apontando para 129.121.33.50.
Confirmar portas 80 e 443 abertas.
Confirmar APP_DOMAIN no .env.production.
Ver logs do Caddy.
```

Tela sempre volta para login:

```text
Confirmar AUTH_BASE_URL com https://coobi.coonagro.com.br.
Confirmar SESSION_COOKIE_SECURE="true" em producao com HTTPS.
Confirmar horario do servidor.
```

Aplicacao sobe, mas erro de banco:

```text
Confirmar container postgres healthy.
Confirmar DATABASE_URL usando host postgres, nao localhost.
Confirmar POSTGRES_DB, POSTGRES_USER e POSTGRES_PASSWORD.
```

Atualizacao nao refletiu:

```bash
docker compose -f docker-compose.prod.yml build --no-cache app
docker compose -f docker-compose.prod.yml up -d
```

Limpeza de imagens antigas:

```bash
docker image prune -f
```

## 15. Observacoes de Seguranca

Nao compartilhar:

```text
.env.production
SESSION_SECRET
POSTGRES_PASSWORD
DATABASE_URL
SMTP_PASSWORD
Senha de usuarios
Backups de banco
```

Nao expor PostgreSQL na internet.

Manter backups periodicos fora da VPS quando possivel.

Usar senhas fortes para usuarios administrativos.

Revogar acessos de usuarios desligados ou que nao devem mais operar o sistema.

