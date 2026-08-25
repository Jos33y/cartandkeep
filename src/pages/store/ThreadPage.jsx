import { Link, useParams, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { Conversation } from '@components/ui/store/Conversation';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/thread-page.module.css';

// Reached only by the token in the email. Nothing links here and nothing lists them.
// Order conversations render on the order page instead.
export function ThreadPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  return (
    <section className={styles.page}>
      {/* A search engine that finds this is a search engine holding the token. */}
      <Head title="Your question" description="Your question." path="/thread" noindex />

      <Conversation lookup={{ threadId: id, token }} />

      <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
    </section>
  );
}
