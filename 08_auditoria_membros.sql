-- V25 - Auditoria de cadastros de membros
-- Não altera registros. Apenas lista cadastros suspeitos.

select
    id,
    nome_completo,
    whatsapp
from public.membros
where ativo = true
  and (
       nome_completo like '%@%'
       or nome_completo ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
       or nome_completo ~ '[0-9]{4,}'
       or length(nome_completo) > 80
  )
order by nome_completo;

select count(*) as total_cadastros_suspeitos
from public.membros
where ativo = true
  and (
       nome_completo like '%@%'
       or nome_completo ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
       or nome_completo ~ '[0-9]{4,}'
       or length(nome_completo) > 80
  );

-- Revise os resultados antes de qualquer UPDATE.
