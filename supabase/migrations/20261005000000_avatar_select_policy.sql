-- O upload com upsert (trocar a foto) exige SELECT além de INSERT/UPDATE na pasta do próprio usuário.
create policy "avatars: dono lista" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
