import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const logoutKey = 'muzklub.loggedOut';
const profile = {
  first_name: 'Test musician',
  specialization: 'guitar',
  bio: 'Plays guitar',
  fee: '500.00',
};
const user = { id: 1, username: 'test-musician', profile };
let moduleNumber = 0;

beforeEach(() => {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(String(key)) ?? null,
      setItem: (key, value) => { values.set(String(key), String(value)); },
      removeItem: (key) => { values.delete(String(key)); },
      clear: () => { values.clear(); },
    },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalStorageDescriptor);
  } else {
    delete globalThis.localStorage;
  }
});

async function freshApi() {
  return import(`../src/api/index.ts?case=${++moduleNumber}`);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(url.origin, 'https://inai-col3.fishrungames.com');
    assert.equal(init.credentials, 'include');
    const call = {
      path: url.pathname,
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: init.body,
    };
    calls.push(call);
    return handler(call, calls.length);
  };
  return calls;
}

function unauthorized() {
  return json({ detail: 'Token expired', code: 'token_not_valid' }, 401);
}

test('login sends credentials and uses the returned access token for the profile', async () => {
  const { api } = await freshApi();
  const calls = mockFetch((call) => {
    if (call.path === '/api/login/') {
      assert.equal(call.method, 'POST');
      assert.equal(call.headers.has('Authorization'), false);
      assert.equal(call.headers.get('Content-Type'), 'application/json');
      assert.deepEqual(JSON.parse(call.body), { username: 'musician', password: 'secret123' });
      return json({ access: 'login-access', user });
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer login-access');
    return json(user);
  });

  await api.login('musician', 'secret123');
  assert.deepEqual(await api.profile(), user);
  assert.equal(calls.length, 2);
});

test('registration saves its access token without requiring a second login', async () => {
  localStorage.setItem(logoutKey, '1');
  const { api } = await freshApi();
  const calls = mockFetch((call) => {
    if (call.path === '/api/register/') {
      assert.equal(call.method, 'POST');
      assert.equal(call.headers.has('Authorization'), false);
      assert.deepEqual(JSON.parse(call.body), { username: 'new-musician', password: 'secret123' });
      return json({ access: 'registration-access', user }, 201);
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer registration-access');
    return json(user);
  });

  await api.register('new-musician', 'secret123');
  assert.equal(localStorage.getItem(logoutKey), null);
  assert.deepEqual(await api.profile(), user);
  assert.equal(calls.length, 2);
});

test('a fresh page restores access from the HttpOnly refresh cookie before loading a profile', async () => {
  const { api } = await freshApi();
  const calls = mockFetch((call) => {
    if (call.path === '/api/token/refresh/') {
      assert.equal(call.method, 'POST');
      assert.equal(call.headers.has('Authorization'), false);
      assert.equal(call.body, undefined);
      return json({ access: 'restored-access' });
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer restored-access');
    return json(user);
  });

  assert.deepEqual(await api.profile(), user);
  assert.deepEqual(calls.map((call) => call.path), ['/api/token/refresh/', '/api/profile/']);
});

test('an expired access token is refreshed and the failed request is retried once', async () => {
  const { api } = await freshApi();
  const calls = mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'expired-access' });
    if (call.path === '/api/token/refresh/') {
      assert.equal(call.headers.has('Authorization'), false);
      assert.equal(call.body, undefined);
      return json({ access: 'renewed-access' });
    }
    assert.equal(call.path, '/api/profile/');
    if (call.headers.get('Authorization') === 'Bearer expired-access') return unauthorized();
    assert.equal(call.headers.get('Authorization'), 'Bearer renewed-access');
    return json(user);
  });

  await api.login('musician', 'secret123');
  assert.deepEqual(await api.profile(), user);
  assert.deepEqual(calls.map((call) => call.path), [
    '/api/login/', '/api/profile/', '/api/token/refresh/', '/api/profile/',
  ]);
});

test('concurrent unauthorized profile requests share one refresh operation', async () => {
  const { api } = await freshApi();
  let releaseRefresh;
  let markRefreshStarted;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const refreshStarted = new Promise((resolve) => { markRefreshStarted = resolve; });
  let refreshCount = 0;
  let expiredRequestCount = 0;
  mockFetch(async (call) => {
    if (call.path === '/api/login/') return json({ access: 'expired-access' });
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      markRefreshStarted();
      await refreshGate;
      return json({ access: 'shared-access' });
    }
    assert.equal(call.path, '/api/profile/');
    if (call.method === 'PATCH') {
      assert.equal(call.headers.get('Content-Type'), 'application/json');
      assert.deepEqual(JSON.parse(call.body), profile);
    }
    if (call.headers.get('Authorization') === 'Bearer expired-access') {
      expiredRequestCount += 1;
      return unauthorized();
    }
    assert.equal(call.headers.get('Authorization'), 'Bearer shared-access');
    return json(user);
  });

  await api.login('musician', 'secret123');
  const pendingRequests = [api.profile(), api.updateProfile(profile)];
  await refreshStarted;
  await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.equal(expiredRequestCount, 2);
    assert.equal(refreshCount, 1);
  } finally {
    releaseRefresh();
  }
  assert.deepEqual(await Promise.all(pendingRequests), [user, user]);
  assert.equal(refreshCount, 1);
});

test('a late concurrent 401 reuses the token refreshed by an earlier request', async () => {
  const { api } = await freshApi();
  let releaseLateResponse;
  const lateResponse = new Promise((resolve) => { releaseLateResponse = resolve; });
  let refreshCount = 0;
  mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'expired-access' });
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      return json({ access: 'renewed-access' });
    }
    assert.equal(call.path, '/api/profile/');
    if (call.headers.get('Authorization') === 'Bearer expired-access') {
      return call.method === 'PATCH' ? lateResponse : unauthorized();
    }
    assert.equal(call.headers.get('Authorization'), 'Bearer renewed-access');
    return json(user);
  });

  await api.login('musician', 'secret123');
  const firstRequest = api.profile();
  const lateRequest = api.updateProfile(profile);
  try {
    assert.deepEqual(await firstRequest, user);
  } finally {
    releaseLateResponse(unauthorized());
  }
  assert.deepEqual(await lateRequest, user);
  assert.equal(refreshCount, 1);
});

test('a refresh finishing after logout cannot restore the previous session', async () => {
  const { api, ApiError } = await freshApi();
  let releaseRefresh;
  let markRefreshStarted;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const refreshStarted = new Promise((resolve) => { markRefreshStarted = resolve; });
  let refreshCount = 0;
  let profileCount = 0;
  mockFetch(async (call) => {
    if (call.path === '/api/login/') return json({ access: 'expired-access' });
    if (call.path === '/api/logout/') return json({ detail: 'Logged out' });
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      if (refreshCount > 1) return unauthorized();
      markRefreshStarted();
      await refreshGate;
      return json({ access: 'stale-refresh-access' });
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer expired-access');
    profileCount += 1;
    return unauthorized();
  });

  await api.login('musician', 'secret123');
  const pendingProfile = assert.rejects(api.profile(),
    (error) => error instanceof ApiError && error.status === 401);
  await refreshStarted;
  try {
    await api.logout();
  } finally {
    releaseRefresh();
  }
  await pendingProfile;
  await assert.rejects(api.profile(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(profileCount, 1);
  assert.equal(refreshCount, 1);
});

test('a second unauthorized response stops retrying instead of entering a refresh loop', async () => {
  const { api, ApiError } = await freshApi();
  let refreshCount = 0;
  let profileCount = 0;
  mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'initial-access' });
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      return json({ access: 'also-rejected-access' });
    }
    assert.equal(call.path, '/api/profile/');
    profileCount += 1;
    return unauthorized();
  });

  await api.login('musician', 'secret123');
  await assert.rejects(api.profile(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(refreshCount, 1);
  assert.equal(profileCount, 2);
});

test('an expired or missing refresh cookie rejects session restoration', async () => {
  const { api, ApiError } = await freshApi();
  const calls = mockFetch((call) => {
    assert.equal(call.path, '/api/token/refresh/');
    return json({ detail: 'Refresh cookie missing or expired' }, 401);
  });

  await assert.rejects(api.profile(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(calls.length, 1);
});

test('invalid login and public endpoint errors never trigger a token refresh', async () => {
  const { api, ApiError } = await freshApi();
  const calls = mockFetch((call) => {
    assert.ok(['/api/login/', '/api/specializations/'].includes(call.path));
    assert.equal(call.headers.has('Authorization'), false);
    return unauthorized();
  });

  await assert.rejects(api.login('musician', 'wrong-password'),
    (error) => error instanceof ApiError && error.status === 401);
  await assert.rejects(api.specializations(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(calls.length, 2);
});

test('a temporary refresh network failure preserves access for a later request', async () => {
  const { api } = await freshApi();
  let profileCount = 0;
  let refreshCount = 0;
  mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'existing-access' });
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      throw new TypeError('Network unavailable');
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer existing-access');
    profileCount += 1;
    return profileCount === 1 ? unauthorized() : json(user);
  });

  await api.login('musician', 'secret123');
  await assert.rejects(api.profile());
  assert.deepEqual(await api.profile(), user);
  assert.equal(refreshCount, 1);
});

test('failed logout preserves the session and successful logout prevents silent restoration', async () => {
  const { api, ApiError } = await freshApi();
  let logoutCount = 0;
  let refreshCount = 0;
  const calls = mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'existing-access' });
    if (call.path === '/api/logout/') {
      assert.equal(call.method, 'POST');
      assert.equal(call.headers.has('Authorization'), false);
      logoutCount += 1;
      return logoutCount === 1 ? json({ detail: 'Temporarily unavailable' }, 503) : json({ detail: 'Logged out' });
    }
    if (call.path === '/api/token/refresh/') {
      refreshCount += 1;
      return json({ access: 'restored-after-logout' });
    }
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'),
      logoutCount === 1 ? 'Bearer existing-access' : 'Bearer restored-after-logout');
    return json(user);
  });

  await api.login('musician', 'secret123');
  await assert.rejects(api.logout(), (error) => error instanceof ApiError && error.status === 503);
  assert.equal(localStorage.getItem(logoutKey), null);
  assert.deepEqual(await api.profile(), user);
  assert.equal(refreshCount, 0);
  await api.logout();
  assert.equal(localStorage.getItem(logoutKey), '1');
  await assert.rejects(api.profile(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(refreshCount, 0);
  assert.equal(calls.at(-1).path, '/api/logout/');
});

test('a page reload respects explicit logout until a successful login clears the marker', async () => {
  const firstModule = await freshApi();
  const calls = mockFetch((call) => {
    if (call.path === '/api/login/') return json({ access: 'login-access' });
    if (call.path === '/api/logout/') return json({ detail: 'Logged out' });
    assert.equal(call.path, '/api/profile/');
    assert.equal(call.headers.get('Authorization'), 'Bearer login-access');
    return json(user);
  });

  await firstModule.api.login('musician', 'secret123');
  await firstModule.api.logout();
  assert.equal(localStorage.getItem(logoutKey), '1');
  const reloadedModule = await freshApi();
  await assert.rejects(reloadedModule.api.profile(),
    (error) => error instanceof reloadedModule.ApiError && error.status === 401);
  assert.equal(calls.length, 2);

  await reloadedModule.api.login('musician', 'secret123');
  assert.equal(localStorage.getItem(logoutKey), null);
  assert.deepEqual(await reloadedModule.api.profile(), user);
  assert.equal(calls.length, 4);
});

test('an already open tab respects a logout marker written by another tab', async () => {
  const { api, ApiError } = await freshApi();
  const calls = mockFetch((call) => {
    assert.equal(call.path, '/api/login/');
    return json({ access: 'existing-access' });
  });

  await api.login('musician', 'secret123');
  localStorage.setItem(logoutKey, '1');
  await assert.rejects(api.profile(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(calls.length, 1);
});

test('a logout marker written during refresh prevents retrying the protected request', async () => {
  const { api, ApiError } = await freshApi();
  let releaseRefresh;
  let markRefreshStarted;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const refreshStarted = new Promise((resolve) => { markRefreshStarted = resolve; });
  let profileCount = 0;
  mockFetch(async (call) => {
    if (call.path === '/api/login/') return json({ access: 'expired-access' });
    if (call.path === '/api/token/refresh/') {
      markRefreshStarted();
      await refreshGate;
      return json({ access: 'late-access' });
    }
    assert.equal(call.path, '/api/profile/');
    profileCount += 1;
    return call.headers.get('Authorization') === 'Bearer expired-access' ? unauthorized() : json(user);
  });

  await api.login('musician', 'secret123');
  const pendingProfile = assert.rejects(api.profile(),
    (error) => error instanceof ApiError && error.status === 401);
  await refreshStarted;
  localStorage.setItem(logoutKey, '1');
  releaseRefresh();
  await pendingProfile;
  assert.equal(profileCount, 1);
});
