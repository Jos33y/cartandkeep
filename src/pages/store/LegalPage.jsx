import { useParams } from 'react-router';
import { LEGAL_PAGES } from '@utils/constants';

export function LegalPage() {
  const { slug } = useParams();
  const known = LEGAL_PAGES.includes(slug);

  return (
    <section style={{ padding: 'var(--s-7) var(--s-4)', maxWidth: '68ch', margin: '0 auto' }}>
      <h1>{known ? slug : 'Not found'}</h1>
      {known && <p>Copy pending. Needs business address, VAT status and delivery coverage.</p>}
    </section>
  );
}
