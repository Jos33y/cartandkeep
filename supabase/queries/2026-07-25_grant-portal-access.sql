-- Run after inviting a user from Authentication > Users in the dashboard.
-- Signup is disabled in the app, so the user must exist before they can sign in.

-- 1. Studio access, cross-tenant
insert into platform_admins (user_id)
select id from auth.users where email = 'josephlagbalu@thebrickdev.com'
on conflict (user_id) do nothing;

-- 2. Client access, scoped to her tenant
insert into memberships (user_id, tenant_id, role)
select u.id, t.id, 'operator'
from auth.users u
cross join tenants t
where u.email = 'sowande@cartandkeep.com'
  and t.slug = 'cart-and-keep'
on conflict (user_id, tenant_id) do nothing;

-- 3. Verify
select u.email, m.role, t.slug, (pa.user_id is not null) as platform_admin
from auth.users u
left join memberships m on m.user_id = u.id
left join tenants t on t.id = m.tenant_id
left join platform_admins pa on pa.user_id = u.id
order by u.created_at;