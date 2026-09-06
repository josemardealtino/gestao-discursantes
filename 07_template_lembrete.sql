-- V19 - template de lembrete
alter table public.configuracoes
add column if not exists template_lembrete text;

-- O front-end usa um modelo padrão quando o campo está vazio.
