import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

const ROLE_LABEL = { operator: 'Operator', viewer: 'Viewer' };

export function useAccount() {
  const [account, setAccount] = useState({ email: null, role: null, isStudio: false, loading: true });

  useEffect(() => {
    let live = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return live && setAccount({ email: null, role: null, isStudio: false, loading: false });

      // Reads through the policy helper rather than the table, which RLS keeps
      // closed. Falls back to the membership row if the function is not exposed.
      let role = null;
      let isStudio = false;
      const { data: isAdmin, error } = await supabase.rpc('is_platform_admin');

      if (!error && isAdmin) {
        role = 'Studio';
        isStudio = true;
      } else {
        const { data: m } = await supabase
          .from('memberships')
          .select('role')
          .limit(1)
          .maybeSingle();
        role = m ? ROLE_LABEL[m.role] ?? m.role : null;
      }

      if (live) setAccount({ email: user.email, role, isStudio, loading: false });
    })();

    return () => { live = false; };
  }, []);

  return account;
}
