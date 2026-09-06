# Gestão Sacramental — V19

Nova funcionalidade: lembrete de discurso.

## Configurações
- Nova seção `Lembretes`.
- Template personalizável.
- Variáveis:
  - {primeiro_nome}
  - {data}
  - {ordem}
  - {tema}
- Botão para restaurar o modelo padrão.

## Programação
- Cada orador agora possui um botão `Enviar lembrete`.
- O lembrete usa o WhatsApp cadastrado do membro.
- Usa o mesmo mecanismo de URL do WhatsApp já validado na V18.
- Não altera o status do convite.
- Caso o membro não tenha WhatsApp, o app avisa.

## Banco
Execute uma única vez o arquivo:
`07_template_lembrete.sql`

Ele adiciona o campo `template_lembrete` na tabela `configuracoes`.

As demais funcionalidades da V18 foram mantidas.
