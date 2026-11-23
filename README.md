# App do Condomínio Parque Bello Solare

Aplicativo web instalável no celular (PWA) para moradores, portaria, síndico, subsíndicos e Conselho do
Condomínio Parque Bello Solare (Valparaíso de Goiás). Projeto voluntário.

**O que ele faz:**

| Módulo | Morador | Portaria | Síndico / Subsíndico | Conselho |
| --- | --- | --- | --- | --- |
| Cadastro | Vincula a conta com o código de convite; cadastra moradores, contato de emergência, veículos e pets | Consulta placa/unidade (sem telefone, LGPD) | Valida cadastros, define papéis, gera e imprime convites | — |
| Encomendas | Recebe aviso e código de retirada | Registra (com foto) e entrega conferindo o código | Acompanha pendentes | — |
| Manutenção | Abre chamado (com foto) e vê os já reportados | Pode abrir | Atualiza status e responde; subsíndico vê o próprio bloco | — |
| Ocorrências e multas | Vê notificação/multa, dá ciência, recorre em 10 dias | Registra ocorrência | Decide com a **penalidade sugerida pelo RI Art. 82** (notificação → 100% → dobro, até 5x; multa direta nos casos do artigo); registra testemunhas | Julga recursos |
| Reservas | Salão, churrasqueira e gourmet com as regras do Regimento | — | Confirma ou cancela | — |
| Prestação de contas | Vê receitas, despesas, fundo de reserva, inadimplência, documentos; envia dúvidas | — | Lança o balancete, anexa documentos, publica, responde dúvidas | Registra parecer |
| Avisos | Sino com avisos de tudo acima | | | |

O banco já vem **carregado com os 10 blocos, as 368 unidades e as 406 vagas** com o vínculo vaga → apartamento
do quadro do Art. 6.1 da Convenção (`supabase/dados/`), conferido vaga a vaga.

**Tecnologia:** Next.js 15 (App Router, server actions) + Supabase (PostgreSQL, Auth, Storage) + Tailwind.
Toda a permissão é feita **no banco** (Row Level Security e funções), não só na tela.

---

## Publicar (cerca de 30 minutos, plano gratuito)

### 1. Banco no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo. Região: **South America (São Paulo)**.
   Guarde a senha do banco.
2. No projeto, abra **SQL Editor** e rode, **um de cada vez e nesta ordem**, o conteúdo dos arquivos de
   `supabase/migrations/`:
   1. `20261119000001_esquema.sql`
   2. `20261119000002_seguranca_e_regras.sql`
   3. `20261119000003_carga_unidades_vagas.sql`
   4. `20261119000004_regras_regimento.sql`
   5. `20261120000005_permissoes_authenticated.sql`
   6. `20261123000006_corrige_gen_random_bytes.sql`

   (Quem usa a linha de comando pode fazer `npx supabase link` e `npx supabase db push`.)
3. Confira a carga:
   ```sql
   select (select count(*) from blocos) blocos, (select count(*) from unidades) unidades, (select count(*) from vagas) vagas;
   -- esperado: 10 | 368 | 406
   ```
4. Em **Project Settings › API**, copie a **Project URL** e a chave **anon public**.
   Nunca coloque a chave `service_role` no app.

### 2. Site na Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. **Add New › Project** › importe `marcdag/app-bello-solare`.
3. Em **Environment Variables**, cadastre (modelo em `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon public
   - `NEXT_PUBLIC_SITE_URL` = o endereço que a Vercel der (ex.: `https://app-bello-solare.vercel.app`)
4. Clique em **Deploy**. Cada novo commit no GitHub publica sozinho.

### 3. Login por e-mail

No Supabase, **Authentication › URL Configuration**:
- **Site URL**: o endereço da Vercel.
- **Redirect URLs**: adicione `https://SEU-ENDERECO/auth/callback`.

> **Importante para 368 unidades:** o envio de e-mail embutido do Supabase é limitado a poucos e-mails por hora,
> o que trava cadastros em massa. Antes de distribuir os convites, configure um SMTP próprio em
> **Authentication › Emails › SMTP Settings** (ex.: Brevo, Resend ou o e-mail do condomínio). Os textos dos e-mails
> podem ser traduzidos em **Email Templates**.

### 4. Primeiro síndico

1. Abra o app, clique em **Criar conta** e cadastre-se.
2. No **SQL Editor** do Supabase, troque o e-mail e rode:
   ```sql
   update public.perfis set papeis = '{sindico,admin}'
    where id = (select id from auth.users where email = 'email-do-sindico@exemplo.com');
   ```
3. Saia e entre de novo: aparece o menu **Gestão**.

### 5. Colocar para funcionar

1. **Configurações:** informe a menor e a maior taxa condominial (base das multas).
2. **Pessoas e papéis:** os porteiros criam conta; marque o papel **Portaria**. Marque **Conselho** e
   **Subsíndico**; escolha o subsíndico de cada bloco.
3. **Unidades e convites › Imprimir bilhetes:** imprima e entregue um bilhete por apartamento (ou baixe o CSV).
   Comece por um bloco piloto.
4. **Cadastros a validar:** aprove os pedidos (confira com a portaria ou documentos).
5. Divulgue: no celular, abra o endereço e use **Adicionar à tela inicial**.

---

## Desenvolver

```bash
npm install
cp .env.example .env.local   # preencha com um projeto Supabase de testes
npm run dev                  # http://localhost:3000
```

### Testes

`supabase/testes/` tem três camadas, todas rodando sem conta no Supabase:

- `rodar_testes.sh`: aplica as migrações num PostgreSQL local (com uma simulação mínima do Supabase) e roda
  `01_fluxos.sql`, que verifica permissões e regras: um morador não vê dados de outra unidade; a portaria não lê o
  código de retirada; um morador não se autoaprova nem muda o próprio papel; penalidades do Art. 82;
  recurso → Conselho; contas em rascunho invisíveis; auditoria.
  ```bash
  PGHOST=/caminho/do/socket PGPORT=5432 supabase/testes/rodar_testes.sh
  ```
- `02_consultas_api.mjs`: executa as consultas reais das telas, com o token de cada perfil, contra um PostgREST
  local (o mesmo motor de API do Supabase). Rode logo depois do script acima, com o banco recém-criado.
- `supabase_falso.mjs`: simula login, API e arquivos para abrir o app no navegador sem projeto real.

---

## Regras de negócio e pontos em aberto

- **Multas:** o Regimento (AGE 14/04/2019, Art. 82) permite ao síndico notificar e multar, com recurso ao
  Conselho em 10 dias. A Convenção (Art. 16) exige assembleia para multas de certas infrações. O app segue o
  Regimento, e os enquadramentos e a opção "multa direta" ficam editáveis em Configurações.
  **Valide com o jurídico da administradora antes de aplicar multas pelo app.**
- **Cobrança:** o app registra a multa; a cobrança continua no boleto da administradora (lista mensal).
- **Adimplência nas reservas:** o Regimento só permite reserva para unidade em dia. O app ainda não sabe quem está
  em dia; o síndico confere antes de **Confirmar**.
- **Mudanças:** a Convenção diz seg–sex e o Regimento seg–sáb, 8h às 18h.
- **Fração ideal:** o campo existe, mas não foi carregado (tabela do Art. 5º digitalizada com baixa qualidade).
- **Avisos:** ficam no sino do app. Notificação push no celular e por WhatsApp são próximos passos.
- **Fotos:** o bucket `fotos` é privado e os links expiram em 1 hora. Falta uma rotina para apagar fotos antigas
  de encomendas.
- **LGPD:** o condomínio é o controlador dos dados. Formalize o uso do app em assembleia e publique o aviso de
  privacidade (há um resumo em **Meu perfil**).
