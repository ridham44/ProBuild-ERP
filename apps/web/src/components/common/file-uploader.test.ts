import { describe, expect, it } from 'vitest';
import { validateFiles } from './file-uploader';

const rule = { accept: ['application/pdf', 'image/png'], maxSizeBytes: 1024 };
const file = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe('validateFiles', () => {
  it('accepts allowed types within the size limit', () => {
    const result = validateFiles([file('plan.pdf', 'application/pdf', 100)], rule);
    expect(result.accepted).toHaveLength(1);
    expect(result.problems).toHaveLength(0);
  });

  it('rejects disallowed types, oversized and empty files with a reason each', () => {
    const result = validateFiles(
      [
        file('run.exe', 'application/x-msdownload', 10),
        file('big.png', 'image/png', 2048),
        file('empty.pdf', 'application/pdf', 0),
      ],
      rule,
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.problems.map((problem) => problem.reason)).toEqual([
      'This file type is not allowed',
      'Larger than 1.0 KB',
      'The file is empty',
    ]);
  });
});
