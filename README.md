# Painel de Repactuações de Locação — Cena Empreendimentos

Painel interno para planejar, acompanhar e simular as repactuações dos contratos de locação
da Cena / Du Lac. Roda no navegador, sem servidor, com os dados no **Supabase** e o site
publicado no **GitHub Pages**.

- **Consolidado** — todas as repactuações, separadas por ano, no layout da planilha de controle.
- **Visão geral** — totais da carteira e um cartão por ano, de 2026 a 2032.
- **Tela do ano** — contratos agrupados por empreendimento, ficha completa e simulador de reajuste.
- **Acompanhamento** — etapa da tratativa, responsável, próximo contato e histórico de anotações.
- **Relatórios** — PDF, Excel ou CSV, com filtros de ano, empreendimento, seções e colunas, e o logo da empresa.

---

## 1. Criar o banco no Supabase

1. Acesse [supabase.com](https://supabase.com), entre com a conta da empresa e clique em **New project**.
   - Nome: `cena-repactuacoes`
   - Região: **South America (São Paulo)** — mantém os dados no Brasil, o que ajuda na LGPD.
   - Guarde a senha do banco que ele gerar.
2. Com o projeto criado, abra **SQL Editor → New query**, cole o conteúdo de
   [`schema.sql`](schema.sql) e clique em **Run**.
3. Abra outra query, cole [`seed.sql`](seed.sql) e rode.
   Isso carrega os 11 empreendimentos, as 73 repactuações de 2026 a 2032 e os 7 contratos
   sem previsão.
4. Confira em **Table Editor → repactuacoes** se as linhas apareceram.

## 2. Criar os usuários

1. **Authentication → Users → Add user → Create new user**.
   Preencha e-mail e senha e marque **Auto Confirm User**.
2. Repita para cada pessoa que vai acessar.
3. Volte ao **SQL Editor** e defina quem pode editar:

```sql
-- quem altera simulações, etapas e anotações
update public.perfis set papel = 'editor'
where email in ('adm@cenaempreendimentos.com.br');

-- os demais ficam como 'leitor' automaticamente
select email, papel from public.perfis order by papel, email;
```

> Sem login ninguém lê nada: todas as tabelas estão com *Row Level Security* ligada.
> Leitores enxergam tudo, mas o banco recusa qualquer gravação vinda deles.

## 3. Pegar as chaves

Em **Settings → API**, copie:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public** — a chave pública

A chave `anon` pode ficar no repositório sem risco: ela só permite falar com a API, e quem
decide o que cada um lê ou grava são as políticas RLS.

## 4. Publicação

O site é servido pelo **GitHub Pages**, direto do branch `main`
(*Settings → Pages → Source: Deploy from a branch → main / (root)*).
Qualquer `git push` no `main` atualiza o painel em alguns segundos.

O arquivo `config.js` fica versionado com a URL e a chave `anon` do Supabase. Isso é
seguro: a chave `anon` é pública por natureza e quem decide o que cada pessoa lê ou grava são
as políticas RLS do banco. As senhas dos usuários nunca passam por aqui.

## 5. Uso no dia a dia

- Entre com e-mail e senha. A sessão fica salva no navegador.
- Quem é **editor** vê os campos liberados; quem é **leitor** vê tudo em cinza, sem poder alterar.
- Toda alteração de simulação, etapa ou valor repactuado fica registrada em `historico`,
  com autor e data.

---

## Modo local (opcional)

O repositório é público, então a cópia dos dados **não é versionada** — nada de contrato ou
locatário fica exposto aqui. Se quiser rodar o painel sem conexão, gere `dados-iniciais.js`
com um `window.DADOS_INICIAIS = {...}` no formato retornado pelo banco e volte a incluir a linha
`<script src="dados-iniciais.js"></script>` no `index.html`. Nesse modo aparece o selo
"modo local" e as alterações ficam só naquele computador.

## Estrutura

```
index.html          estrutura e estilos do painel
config.js           URL e chave pública do Supabase
db.js               autenticação, leitura e gravação no Supabase
app.js              telas, cálculos e interação
relatorio.js        gerador de relatórios em PDF, Excel e CSV
schema.sql          tabelas, RLS, trigger de histórico
seed.sql            carga inicial dos dados
logo.png            marca da Cena
```

## Regra de cálculo

Repactuação a cada três anos, contada da última ou da próxima renegociação registrada no
controle de locações, projetada até o fim da vigência de cada contrato. Contratos com vigência
vencida e prorrogada por prazo indeterminado aparecem como "Indet." e têm dois ciclos projetados.

O **valor previsto** é, nesta ordem: o valor efetivamente repactuado, a simulação registrada no
painel, o valor alvo definido pelo Comercial ou — na falta de todos — o próprio valor atual.
Hoje só o plano de 2026 tem valor alvo definido; nos anos seguintes o campo fica em branco até
que o Comercial fixe a meta.

## Atualizar os dados

A base veio da planilha `Controle Contratos de Locação 2023 2024 2025 e 2026.xlsx`, aba
*Consolidado - Imóveis*, e do plano de repactuação de 2026. Para incluir um contrato novo ou
corrigir um valor, edite direto em **Table Editor → repactuacoes** no Supabase, ou rode um
`update`/`insert` no SQL Editor. O painel lê do banco a cada carregamento.

---

Documento e sistema internos da Cena Empreendimentos. Contém dados de locatários protegidos
pela LGPD — não distribuir a terceiros. Alterações societárias, de garantia ou de fiança devem
ser validadas com a Diretoria.
