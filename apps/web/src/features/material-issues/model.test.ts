import { describe, expect, it } from 'vitest';
import { availableMiActions } from './model';

describe('availableMiActions', () => {
  it('offers post and cancel on a draft', () => {
    expect(availableMiActions('DRAFT', { post: true, cancel: true })).toEqual({ post: true, cancel: true });
  });

  it('offers only reversal once posted', () => {
    expect(availableMiActions('POSTED', { post: true, cancel: true })).toEqual({ post: false, cancel: true });
  });

  it('offers nothing when cancelled or without permission', () => {
    expect(availableMiActions('CANCELLED', { post: true, cancel: true })).toEqual({ post: false, cancel: false });
    expect(availableMiActions('DRAFT', { post: false, cancel: false })).toEqual({ post: false, cancel: false });
  });
});
