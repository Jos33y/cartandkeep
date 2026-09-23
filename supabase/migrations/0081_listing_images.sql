-- Photographs she takes or chooses, for listings.
-- Public read because eBay fetches them by URL at publish time. Writes are
-- scoped to the tenant's own folder: the first path segment is the tenant id.

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists listing_images_read on storage.objects;
create policy listing_images_read on storage.objects
  for select
  using (bucket_id = 'listing-images');

drop policy if exists listing_images_write on storage.objects;
create policy listing_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and has_tenant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists listing_images_delete on storage.objects;
create policy listing_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and has_tenant(((storage.foldername(name))[1])::uuid)
  );
