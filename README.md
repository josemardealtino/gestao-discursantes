# Gestão Sacramental — V21

Ajustes mobile após teste no iPhone:

- Secretário:
  - botão verde "Enviar programação" com ícone do WhatsApp;
  - botão "Copiar mensagem" logo abaixo;
  - ambos em largura total no mobile.
- Rodapé da programação:
  - Cancelar e Salvar ficam lado a lado;
  - no mobile, o botão usa o texto curto "Salvar" para não quebrar linha;
  - no desktop continua "Salvar programação".
- Safari/iPhone:
  - inputs, selects e textareas passam a 16px no mobile;
  - isso evita o zoom automático do Safari ao focar campos;
  - botões usam `touch-action: manipulation` para reduzir zoom/gestos acidentais.
- Nenhuma alteração no Supabase.
