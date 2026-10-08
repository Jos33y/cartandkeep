import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { supabase } from '@lib/supabase';
import { loadTenant } from '@lib/tenant';
import { loadEbayAccount, refreshEbayAccountIfOld } from '@lib/ebayAccountRead';
import { PortalShell } from './PortalShell';
import { portalPath } from '@utils/constants';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import styles from '@styles/layout/portal/no-access.module.css';

export function PortalProtected() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let live = true;

    async function resolve(session) {
      if (!session) {
        if (live) setStatus('out');
        return;
      }

      // A session alone is not access. Studio staff hold a platform_admins row
      // and no membership, so checking memberships alone locks them out.
      const [{ data: admin }, { data: membership }] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase.from('memberships').select('tenant_id').limit(1).maybeSingle(),
      ]);

      if (!live) return;

      if (!admin && !membership) {
        setStatus('no-access');
        return;
      }

      try {
        const tenant = await loadTenant();
        // The eBay account prices every card, so it is read before any page draws. It never fails the portal: with
        // nothing read, cards price as they always have. A read a day old is refreshed from eBay behind the page.
        await loadEbayAccount(tenant?.id);
        refreshEbayAccountIfOld(tenant?.id);
      } catch {
        // Signed in, entitled, and the tenant row will not load. Saying "no
        // access" here would be a lie that sends her to the wrong person.
        if (live) setStatus('error');
        return;
      }

      if (live) setStatus('in');
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      resolve(session);
    });

    return () => {
      live = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Returning null here left a blank frame between the splash coming down and
  // the first screen appearing, which is the most visible of the three loading
  // moments because something has already been on screen by then.
  if (status === 'checking') return <PageSkeleton />;
  if (status === 'out') return <Navigate to={portalPath('/login')} replace />;

  if (status === 'no-access' || status === 'error') {
    const problem = status === 'error';

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{problem ? 'Something is wrong our end' : 'No access'}</h1>
          <p className={styles.body}>
            {problem
              ? 'You are signed in, but the workspace did not load. Try again in a moment, and tell us if it keeps happening.'
              : 'This account is signed in but is not attached to a workspace.'}
          </p>
          <button className={styles.button} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <PortalShell>
      <Outlet />
    </PortalShell>
  );
}
