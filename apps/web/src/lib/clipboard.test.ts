import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

function setClipboard(writeText: ((text: string) => Promise<void>) | undefined, secure: boolean): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
}

function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  return execCommand;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses the Clipboard API on a secure page', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard(writeText, true);
    const execCommand = stubExecCommand(true);
    await expect(copyToClipboard('admin@probuild.local')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('admin@probuild.local');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a selection copy when Safari hides the Clipboard API on a non-HTTPS page', async () => {
    setClipboard(undefined, false);
    const execCommand = stubExecCommand(true);
    await expect(copyToClipboard('Demo@Pass1234')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the Clipboard API rejects, and reports a refused copy', async () => {
    setClipboard(() => Promise.reject(new Error('NotAllowedError')), true);
    stubExecCommand(false);
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });
});
