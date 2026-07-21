import { CenteredLayout, Card } from '@masar/design-system';

export function NotFound() {
  return (
    <CenteredLayout>
      <Card>
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--text-strong)' }}>Not found</h1>
        <p style={{ color: 'var(--text-muted)' }}>This page does not exist.</p>
      </Card>
    </CenteredLayout>
  );
}
