export function toMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (!err || typeof err !== 'object') return 'Something went wrong';
  const anyErr = err as any;
  if (anyErr.message && typeof anyErr.message === 'string') return anyErr.message;
  const z = anyErr;
  const form = Array.isArray(z.formErrors) ? z.formErrors : [];
  const field = z.fieldErrors && typeof z.fieldErrors === 'object'
    ? Object.values(z.fieldErrors).flat().filter(Boolean) as string[]
    : [];
  const msgs = [...form, ...field].filter(Boolean);
  if (msgs.length) return msgs.join(', ');
  try { return JSON.stringify(err); } catch { return 'Unexpected error'; }
}

