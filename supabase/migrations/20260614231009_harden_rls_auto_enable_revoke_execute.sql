-- Fecha o acesso público à RPC da função (o event trigger continua funcionando normalmente)
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.rls_auto_enable() from public;
