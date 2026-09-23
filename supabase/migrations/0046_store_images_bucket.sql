-- Somewhere to put her own photographs.
--
-- There is no image storage on this project at all. Every one of the 78
-- products carries an eBay CDN URL that arrived with the seed, and those are
-- 300 to 800 pixels, which the store design document names as the largest
-- single quality problem on the shop. A product she photographs on her own
-- table has nowhere to go, so "add a product" is not a form problem, it is
-- this.
--
-- Worth saying plainly: her own photographs will be better than the seeded
-- ones. A phone camera in daylight beats a bulk lister's thumbnail, so this is
-- not only an admin gap, it is the cheapest improvement available to how the
-- shop looks.

-- Public read, because these are shop photographs.
--
-- Signed URLs would mean a product image that expires, which breaks a page
-- cached by a CDN, breaks an image in a confirmation email, and breaks a
-- Google Shopping feed. The privacy question does not arise: the whole point
-- of the file is that strangers look at it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

/*
 * Writing is for a signed in session.
 *
 * The five megabyte ceiling and the mime type list are on the bucket rather
 * than in the front end, because a limit the browser enforces is a limit that
 * holds until somebody opens the network tab. The upload resizes before
 * sending, so a phone photograph arrives at a few hundred kilobytes and the
 * ceiling is only there for the case where resizing failed.
 *
 * Same `to authenticated using (true)` shape as store_products and orders. It
 * is looser than it should be for the same reason: there is no membership
 * mechanism tying an auth user to a tenant. Paths are written as
 * {tenant_id}/{product_id}/{uuid}.{ext} so tightening this later is a
 * predicate on the first path segment rather than a migration of every file.
 */
drop policy if exists store_images_read on storage.objects;
create policy store_images_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store-images');

drop policy if exists store_images_write on storage.objects;
create policy store_images_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-images');

drop policy if exists store_images_update on storage.objects;
create policy store_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'store-images');

-- Removing a photograph from a product removes the file. Nothing else in this
-- application deletes anything, and this is the exception because an orphaned
-- image is storage nobody can ever find again to clear.
drop policy if exists store_images_delete on storage.objects;
create policy store_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-images');
