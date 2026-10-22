import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const key = "sopra-mesin-last-google-account";
const account = { subject: "verified-subject", email: "operator@example.com", name: "Operator" };
// Test fixture only: the API response is mocked; no claim of signature validity.
const googleCredential = (claims) => [
  Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify(claims)).toString("base64url"),
  "test-signature",
].join(".");
let moduleNumber = 0;

async function client({ success = true, googleAccount = account, blockedPreference = false, email = "operator@factory.example", role = "Admin" } = {}) {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (name, value) => {
      if (blockedPreference && name === key) throw new Error("Storage quota exceeded");
      values.set(name, value);
    },
  };
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, ...init });
    return new Response(JSON.stringify({ success, data: { token: "app-session", username: "operator", email, role, googleAccount } }), {
      status: success ? 200 : 403,
      headers: { "Content-Type": "application/json" },
    });
  };
  const source = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");
  // Stub only UI notification transport and Vite's environment injection.
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/import \{ queueWarning \} from [^;]+;/, "const queueWarning = () => {};")
    .replaceAll("import.meta.env", "({})");
  const api = await import(`data:text/javascript;base64,${Buffer.from(js + `\n// test ${moduleNumber++}`).toString("base64")}`);
  return { api, values, requests };
}

test("Successful Google login remembers only verified account metadata, not the credential", async () => {
  const { api, values, requests } = await client();
  await api.loginWithGoogle("google-id-token");
  assert.deepEqual(api.lastGoogleAccount(), account);
  assert.equal(values.get("sopra-mesin-token"), "app-session");
  assert.equal(api.currentEmail(), "operator@factory.example");
  assert.equal(api.currentRole(), "Admin");
  assert.deepEqual(JSON.parse(requests[0].body), { credential: "google-id-token" });
  assert.equal([...values.values()].some((v) => v.includes("google-id-token")), false);
});

test("Logout clears the application session but retains the account suggestion", async () => {
  const { api, values } = await client();
  await api.loginWithGoogle("google-id-token");
  api.logout();
  assert.equal(api.hasToken(), false);
  assert.equal(values.has("sopra-mesin-user"), false);
  assert.equal(api.currentEmail(), "");
  assert.equal(api.currentRole(), "");
  assert.deepEqual(api.lastGoogleAccount(), account);
});

test("Switching account forgets the suggestion", async () => {
  const { api } = await client();
  await api.loginWithGoogle("google-id-token");
  api.logout();
  api.forgetGoogleAccount();
  assert.equal(api.lastGoogleAccount(), null);
});

test("Rejected Google login does not create a session or remember an account", async () => {
  const { api, values } = await client({ success: false });
  await assert.rejects(api.loginWithGoogle("rejected-id-token"));
  assert.equal(values.size, 0);
});

test("Malformed or inaccessible saved preference is ignored", async () => {
  const { api, values } = await client();
  for (const bad of ["{invalid", "null", "{}", JSON.stringify({ subject: 42, email: "x", name: "X" })]) {
    values.set(key, bad);
    assert.equal(api.lastGoogleAccount(), null);
  }
  globalThis.localStorage.getItem = () => { throw new Error("Blocked"); };
  assert.equal(api.lastGoogleAccount(), null);
});

test("Failed preference write does not reject a successful Google login", async () => {
  const { api } = await client({ blockedPreference: true });
  const result = await api.loginWithGoogle("google-id-token");
  assert.equal(result.accountRemembered, false);
  assert.equal(api.hasToken(), true);
  assert.equal(api.lastGoogleAccount(), null);
});

test("Missing API identity and malformed credential clear an obsolete hint without breaking authentication", async () => {
  const { api, values } = await client({ googleAccount: null });
  values.set(key, JSON.stringify(account));
  const result = await api.loginWithGoogle("google-id-token");
  assert.equal(result.accountRemembered, false);
  assert.equal(api.hasToken(), true);
  assert.equal(api.lastGoogleAccount(), null);
});

test("Legacy API without googleAccount still remembers the Google identity after API success and logout", async () => {
  const { api, values } = await client({ googleAccount: null });
  const credential = googleCredential({ sub: account.subject, email: account.email, name: account.name });
  const result = await api.loginWithGoogle(credential);
  assert.equal(result.accountRemembered, true);
  api.logout();
  assert.deepEqual(api.lastGoogleAccount(), account);
  assert.equal([...values.values()].some((value) => value.includes(credential)), false);
});

test("Rejected login never remembers even a readable Google credential", async () => {
  const { api, values } = await client({ success: false, googleAccount: null });
  await assert.rejects(api.loginWithGoogle(googleCredential({ sub: account.subject, email: account.email, name: account.name })));
  assert.equal(values.size, 0);
});

test("Legacy Google identity handles Unicode names and a missing optional name", async () => {
  const { api } = await client({ googleAccount: null });
  await api.loginWithGoogle(googleCredential({ sub: account.subject, email: account.email, name: "Nadír 日本" }));
  assert.equal(api.lastGoogleAccount()?.name, "Nadír 日本");
  await api.loginWithGoogle(googleCredential({ sub: account.subject, email: account.email }));
  assert.equal(api.lastGoogleAccount()?.name, account.email);
});

test("Server-provided Google identity takes precedence over decoded display metadata", async () => {
  const { api } = await client();
  await api.loginWithGoogle(googleCredential({ sub: "different-subject", email: "other@example.com", name: "Other" }));
  assert.deepEqual(api.lastGoogleAccount(), account);
});

test("Password login does not overwrite remembered Google identity", async () => {
  const { api, values, requests } = await client({ googleAccount: null });
  values.set(key, JSON.stringify(account));
  await api.login("operator", "test-password");
  assert.deepEqual(api.lastGoogleAccount(), account);
  assert.ok(requests[0].url.endsWith("/auth/login"));
  assert.equal(api.currentEmail(), "operator@factory.example");
  assert.equal(api.currentRole(), "Admin");
});

test("Missing email and role clear stale profile data instead of inventing an email", async () => {
  const { api, values } = await client({ email: null, role: null });
  values.set("sopra-mesin-email", "previous@example.com");
  values.set("sopra-mesin-role", "Admin");
  await api.login("operator", "test-password");
  assert.equal(api.currentEmail(), "");
  assert.equal(api.currentRole(), "");
  assert.equal(api.currentUsername(), "operator");
});

test("Changing a password sends only password fields and renews the app session without losing the Google hint", async () => {
  const { api, values, requests } = await client();
  values.set(key, JSON.stringify(account));
  values.set("sopra-mesin-token", "old-session");
  const passwords = { currentPassword: "current password", newPassword: "new long passphrase", confirmPassword: "new long passphrase" };
  await api.changePassword(passwords);
  assert.ok(requests[0].url.endsWith("/auth/change-password"));
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].headers.Authorization, "Bearer old-session");
  assert.deepEqual(JSON.parse(requests[0].body), passwords);
  assert.equal(values.get("sopra-mesin-token"), "app-session");
  assert.deepEqual(api.lastGoogleAccount(), account);
  for (const password of Object.values(passwords)) assert.equal([...values.values()].includes(password), false);
});

test("Rejected password change leaves the session and account suggestion intact", async () => {
  const { api, values } = await client({ success: false });
  values.set("sopra-mesin-token", "existing-session");
  values.set(key, JSON.stringify(account));
  await assert.rejects(api.changePassword({ currentPassword: "wrong", newPassword: "new long passphrase", confirmPassword: "new long passphrase" }));
  assert.equal(values.get("sopra-mesin-token"), "existing-session");
  assert.deepEqual(api.lastGoogleAccount(), account);
});

test("A delayed 401 from an old token does not clear a renewed session", async () => {
  const { api, values } = await client();
  values.set("sopra-mesin-token", "old-session");
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const pending = api.api("/orders");
  values.set("sopra-mesin-token", "new-session");
  finish(new Response(null, { status: 401 }));
  await assert.rejects(pending, /Sesi telah diperbarui/);
  assert.equal(values.get("sopra-mesin-token"), "new-session");
});
