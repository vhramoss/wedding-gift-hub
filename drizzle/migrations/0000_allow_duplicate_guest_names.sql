-- Convidados com o mesmo nome passam a ser permitidos; o convite/CPF continua único por CPF.
DROP INDEX IF EXISTS public.wedding_guests_unique_name;