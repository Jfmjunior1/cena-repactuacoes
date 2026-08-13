# Sincronização automática com a planilha do Financeiro

Este documento descreve como o Painel de Repactuações passa a se atualizar sozinho a partir da
planilha mantida pelo Financeiro, sem ninguém redigitar nada.

**Planilha de origem**
`Controle Contratos de Locação 2023 , 2024 ,  2025 e 2026.xlsx`
SharePoint → site **Financeiro** → Documentos Compartilhados → **Controles financeiros diversos**
Aba lida: **Consolidado - Imóveis**

---

## Como funciona

```
Financeiro salva a planilha
        ↓
Power Automate detecta a alteração (gatilho "Quando um arquivo é modificado")
        ↓
Office Script "Extrair contratos de locacao" lê a aba e devolve JSON
        ↓
HTTP POST para o Supabase → função sincronizar_planilha()
        ↓
Painel atualizado — todo mundo que abrir já vê os valores novos
```

A leitura acontece **do lado da Microsoft**, com a credencial da própria empresa. Nenhum dado de
locatário trafega para fora do ambiente Cena + Supabase, e a planilha nunca é alterada pelo fluxo —
ele apenas lê.

---

## O que a sincronização atualiza e o que ela preserva

| Atualiza a partir da planilha | Nunca é sobrescrito |
|---|---|
| Valor do contrato, m², garagem | Valor efetivamente repactuado |
| Início, fim e vigência | Simulações registradas no painel |
| Última e próxima renegociação | Etapa da tratativa, responsável, próximo contato |
| Locador, administração, situação | Anotações e histórico de alterações |
| Criação dos ciclos futuros de três anos | Repactuações já concluídas |

Regras de segurança embutidas:

- Se a planilha devolver menos de 20 contratos, a sincronização é **abortada** — é o sinal de que a
  aba mudou de formato ou o arquivo foi aberto pela metade.
- Contrato que some da planilha **não é apagado**: fica marcado como inativo e seus ciclos futuros
  recebem a marca *revisar*.
- Cada execução grava uma linha em `sincronizacoes` com o que mudou, contrato a contrato.

---

## Passo 1 — Preparar o banco (feito uma única vez)

No Supabase, **SQL Editor → New query**, cole o conteúdo de [`sync.sql`](sync.sql) e clique em **Run**.

Depois troque o token pelo segredo definitivo:

```sql
update public.config_sync
   set valor = 'COLE-AQUI-UM-SEGREDO-FORTE'
 where chave = 'token_sync';
```

Guarde esse segredo — ele é o que autoriza o fluxo a gravar. Sem ele, a chamada é recusada.
Não o coloque em e-mail nem no repositório.

## Passo 2 — Instalar o Office Script

1. Abra a planilha no **Excel para a web** (pelo SharePoint, não pelo aplicativo instalado).
2. Guia **Automatizar → Novo script**.
3. Apague o conteúdo padrão, cole [`ExtrairContratosLocacao.ts`](ExtrairContratosLocacao.ts).
4. Salve com o nome exato **Extrair contratos de locacao**.
5. Clique em **Executar** uma vez para conferir: o painel de saída deve mostrar algo como
   `contratos: 57`.

O script não usa números de linha fixos — identifica cada empreendimento pela faixa de título.
Inserir ou apagar linhas na planilha não quebra a leitura. O que quebra é **renomear a aba,
renomear um empreendimento ou mudar a ordem das colunas**; nesses casos o fluxo falha e avisa,
em vez de gravar dado errado.

## Passo 3 — Criar o fluxo no Power Automate

Em [make.powerautomate.com](https://make.powerautomate.com) → **Criar → Fluxo de nuvem automatizado**.

1. **Gatilho:** SharePoint — *Quando um arquivo é modificado (somente propriedades)*
   - Endereço do site: `https://cenaempreendimentos.sharepoint.com/sites/financeiro`
   - Biblioteca: `Documentos Compartilhados`
   - Pasta: `Controles financeiros diversos`

2. **Condição:** continuar apenas se `Nome do arquivo` for igual a
   `Controle Contratos de Locação 2023 , 2024 ,  2025 e 2026.xlsx`

3. **Ação:** Excel Online (Business) — *Executar script*
   - Local: SharePoint · Biblioteca: Documentos Compartilhados
   - Arquivo: a planilha
   - Script: **Extrair contratos de locacao**

4. **Ação:** HTTP
   - Método: `POST`
   - URI: `https://ggdggcjbnhabgwsqepnk.supabase.co/rest/v1/rpc/sincronizar_planilha`
   - Cabeçalhos:
     - `apikey`: a chave **anon** do projeto (a mesma que já está no `config.js`)
     - `Authorization`: `Bearer` + a mesma chave anon
     - `Content-Type`: `application/json`
   - Corpo:
     ```json
     {
       "p_token": "O-SEGREDO-DO-PASSO-1",
       "p_dados": @{body('Executar_script')?['result']?['contratos']}
     }
     ```

5. **Ação (opcional):** Enviar e-mail de notificação para `adm@cenaempreendimentos.com.br`
   em caso de falha, usando *Configurar execução após → falhou*.

> **Licenciamento:** a ação **HTTP** é um conector premium. Se o plano atual do Microsoft 365 não
> incluir Power Automate Premium, o fluxo não poderá ser publicado — nesse caso a alternativa é
> uma licença Power Automate Premium por usuário para a conta que hospeda o fluxo. Confirmar com a
> Danielle antes de contratar.

## Passo 4 — Conferir

Depois da primeira execução, no SQL Editor:

```sql
select criado_em, recebidos, novos, alterados, ausentes, ciclos_criados
  from public.sincronizacoes
 order by criado_em desc
 limit 5;
```

E o detalhe do que mudou:

```sql
select criado_em, jsonb_pretty(mudancas)
  from public.sincronizacoes
 order by criado_em desc
 limit 1;
```

---

## Quem cuida do quê

| Responsabilidade | Quem |
|---|---|
| Manter a planilha e a estrutura da aba | Financeiro |
| Criar e manter o fluxo no Power Automate | Jair Fernando, com apoio da Danielle |
| Licença do conector premium | Diretoria / Danielle |
| Segredo `token_sync` e acessos ao painel | Jair Fernando |

---

Documento interno da Cena Empreendimentos. A planilha de origem contém dados de locatários
protegidos pela LGPD — o fluxo apenas lê o arquivo e não o expõe fora do ambiente corporativo.
