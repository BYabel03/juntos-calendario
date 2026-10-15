const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness({ admins = 'admin@example.test', emails = [], fail = false } = {}) {
  const env = { CALENDAR_ADMIN_EMAILS: admins };
  const permissions = {};
  const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(transpile('lib/calendarPermissions.ts'), { exports: permissions, process: { env } });
  let options, requests = 0;
  const modules = {
    'next-auth': config => { options = config; },
    'next-auth/providers/github': config => config,
    'next-auth/providers/google': config => config,
    'controllers/user': { register: async () => [] },
    'lib/calendarPermissions': permissions,
  };
  vm.runInNewContext(transpile('pages/api/auth/[...nextauth].ts'), {
    exports: {}, require: name => modules[name], process: { env }, console,
    fetch: async () => { requests++; if (fail) throw Error('Synthetic provider failure'); return { ok: true, json: async () => emails }; },
  });
  return { callbacks: options.callbacks, env, requests: () => requests };
}
test('Google administrator requires matching verified provider email', async () => {
  for (const [profile, expected] of [
    [{ email: 'admin@example.test', email_verified: true }, true],
    [{ email: 'admin@example.test', email_verified: false }, false],
    [{ email: 'other@example.test', email_verified: true }, false],
    [undefined, false],
  ]) {
    const h = harness();
    const token = await h.callbacks.jwt({ token: { email: 'admin@example.test', calendarEmailVerified: true }, account: { provider: 'google' }, profile });
    assert.equal(token.calendarEmailVerified, expected);
  }
});
test('GitHub administrator requires a verified email from provider API', async () => {
  for (const [config, expected] of [
    [{ emails: [{ email: 'ADMIN@example.test', verified: true }] }, true],
    [{ emails: [{ email: 'admin@example.test', verified: false }] }, false],
    [{ emails: [{ email: 'other@example.test', verified: true }] }, false],
    [{ fail: true }, false],
  ]) {
    const h = harness(config);
    const token = await h.callbacks.jwt({ token: { email: 'admin@example.test' }, account: { provider: 'github', access_token: 'synthetic-only' } });
    assert.equal(token.calendarEmailVerified, expected);
    assert.equal(h.requests(), 1);
  }
});
test('non-admin tokens never gain privileges or trigger extra verification calls', async () => {
  for (const admins of ['', 'other@example.test']) {
    const h = harness({ admins });
    const token = await h.callbacks.jwt({ token: { email: 'admin@example.test', calendarEmailVerified: true }, account: { provider: 'github', access_token: 'synthetic-only' } });
    assert.equal(token.calendarEmailVerified, false);
    assert.equal(h.requests(), 0);
  }
});
test('session privileges come from signed verified token and current server allowlist', async () => {
  const h = harness();
  const token = { email: 'admin@example.test', calendarEmailVerified: true };
  assert.equal((await h.callbacks.jwt({ token })).calendarEmailVerified, true);
  assert.equal((await h.callbacks.session({ session: {}, token })).isCalendarAdmin, true);
  assert.equal((await h.callbacks.session({ session: { isCalendarAdmin: true }, token: { email: 'admin@example.test' } })).isCalendarAdmin, false);
  h.env.CALENDAR_ADMIN_EMAILS = '';
  assert.equal((await h.callbacks.session({ session: { isCalendarAdmin: true }, token })).isCalendarAdmin, false);
});

test('only the single configured administrator can sign in', async () => {
  const h = harness();
  assert.equal(await h.callbacks.signIn({ user: { email: 'ADMIN@example.test' } }), true);
  for (const email of ['visitor@example.test', null, undefined])
    assert.equal(await h.callbacks.signIn({ user: { email } }), false);
  h.env.CALENDAR_ADMIN_EMAILS = 'admin@example.test,second@example.test';
  assert.equal(await h.callbacks.signIn({ user: { email: 'admin@example.test' } }), false);
});
