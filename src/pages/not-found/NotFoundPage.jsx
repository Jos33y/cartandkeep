import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section style={{ padding: 'var(--s-8) var(--s-4)', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <Link to="/">Back to the shop</Link>
    </section>
  );
}
