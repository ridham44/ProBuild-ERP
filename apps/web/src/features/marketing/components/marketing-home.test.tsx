import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MarketingHome } from './marketing-home';

/** Every route a home page link may point at. A new link to anything else must be a real page first. */
const APP_ROUTES = [
  '/',
  '/home',
  '/login',
  '/reset-password',
  '/projects',
  '/procurement/requests',
  '/inventory/receipts',
  '/inventory/stock',
  '/approvals',
  '/finance/accounting-periods',
];

function hrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((link) => link.getAttribute('href') ?? '');
}

describe('MarketingHome', () => {
  it('only links to sections that exist on the page or to real routes', () => {
    const { container } = render(<MarketingHome signedIn={false} />);
    const links = hrefs(container);

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      if (href.startsWith('#')) {
        expect(container.querySelector(href), `missing section for ${href}`).not.toBeNull();
      } else {
        expect(APP_ROUTES, `unexpected route ${href}`).toContain(href);
      }
    }
  });

  it('sends Request a Demo to the live demo section and offers sign-in when signed out', () => {
    render(<MarketingHome signedIn={false} />);
    const banner = screen.getByRole('banner');

    expect(within(banner).getByRole('link', { name: 'Request a Demo' })).toHaveAttribute('href', '#demo');
    expect(within(banner).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'One ledger from the first purchase request to the project cost.',
    );
  });

  it('offers the dashboard instead of sign-in when signed in', () => {
    render(<MarketingHome signedIn />);
    const banner = screen.getByRole('banner');

    expect(within(banner).getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/');
    expect(within(banner).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('labels partly built modules and the roadmap honestly', () => {
    render(<MarketingHome signedIn={false} />);

    expect(screen.getAllByText('Partly available')).toHaveLength(1);
    expect(screen.getByText('Planned, not yet available')).toBeInTheDocument();
  });

  it('opens the section menu on small screens', async () => {
    const user = userEvent.setup();
    render(<MarketingHome signedIn={false} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });

    expect(within(menu).getByRole('link', { name: 'Modules' })).toHaveAttribute('href', '#modules');
    expect(within(menu).getByRole('link', { name: /Request a Demo/ })).toHaveAttribute('href', '#demo');
  });
});
