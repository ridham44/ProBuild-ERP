import { ApiError } from '@probuild/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const refresh = vi.fn();
const post = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@/lib/api/browser', () => ({ api: { POST: (...args: unknown[]) => post(...args) } }));

import { LoginForm, loginErrorMessage } from './login-form';

function renderForm(next = '/') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm next={next} notice={null} />
    </QueryClientProvider>,
  );
}

function sessionUser(mustChangePassword = false) {
  return {
    id: 'u1',
    email: 'a@b.test',
    name: 'A',
    companyId: 'c',
    userType: 'INTERNAL',
    isSuperAdmin: false,
    mustChangePassword,
    roles: [],
    grants: [],
  };
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  post.mockReset();
});

describe('LoginForm', () => {
  it('validates before calling the API', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('signs in and goes to the requested page', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: sessionUser(), response: new Response(null, { status: 200 }) });
    renderForm('/approvals');
    await user.type(screen.getByLabelText('Email'), 'A@B.test');
    await user.type(screen.getByLabelText('Password'), 'a-long-passphrase-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/approvals'));
    expect(post).toHaveBeenCalledWith('/v1/auth/login', {
      body: { email: 'a@b.test', password: 'a-long-passphrase-1' },
    });
  });

  it('sends users who must change their password to the change-password screen', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      data: sessionUser(true),
      response: new Response(null, { status: 200 }),
    });
    renderForm('/approvals');
    await user.type(screen.getByLabelText('Email'), 'a@b.test');
    await user.type(screen.getByLabelText('Password'), 'temporary-pass-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/change-password'));
  });

  it('shows one generic message for failed credentials and re-enables the form', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      error: {
        type: 'about:blank#401',
        title: 'UNAUTHORIZED',
        status: 401,
        detail: 'Invalid email or password',
      },
      response: new Response(null, { status: 401 }),
    });
    renderForm();
    await user.type(screen.getByLabelText('Email'), 'a@b.test');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email or password is incorrect/i);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('prevents double submits while the request is pending', async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => undefined;
    post.mockReturnValue(new Promise((done) => (resolve = done)));
    renderForm();
    await user.type(screen.getByLabelText('Email'), 'a@b.test');
    await user.type(screen.getByLabelText('Password'), 'secret-1234567');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('button', { name: 'Signing in' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Signing in' }));
    expect(post).toHaveBeenCalledTimes(1);
    resolve({ data: sessionUser(), response: new Response(null, { status: 200 }) });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderForm();
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
  });
});

describe('loginErrorMessage', () => {
  it('does not distinguish locked, unknown or wrong-password cases', () => {
    const unauthorized = new ApiError({
      type: 'x',
      title: 'UNAUTHORIZED',
      status: 401,
      detail: 'Invalid email or password',
    });
    expect(loginErrorMessage(unauthorized)).not.toMatch(/lock/i);
    expect(loginErrorMessage(unauthorized)).toMatch(/incorrect/i);
  });

  it('explains rate limiting and outages without internals', () => {
    expect(
      loginErrorMessage(new ApiError({ type: 'x', title: 'Too Many Requests', status: 429 })),
    ).toMatch(/wait a minute/i);
    expect(
      loginErrorMessage(
        new ApiError({ type: 'x', title: 'Internal', status: 500, detail: 'secret stack' }),
      ),
    ).not.toMatch(/secret/);
    expect(loginErrorMessage(new TypeError('fetch failed'))).toMatch(/cannot reach/i);
  });
});
