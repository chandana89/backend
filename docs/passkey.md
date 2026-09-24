# Passkeys

Users can register a passkey and then sign in with it **without typing an email or password**. A passkey is a WebAuthn credential that the user unlocks with touch, facial recognition, a device password or a PIN. On the login page, the user clicks **Sign in with passkey** and picks their passkey; the backend works out which account it belongs to.

## Using passkeys

1. **Register once:** sign in with your email and password, open **Passkey** in the top nav and click **Add Passkey**. Confirm with your fingerprint, face, PIN or device password.
2. **Sign in:** on the login page, leave the email and password fields empty and click **Sign in with passkey**. Choose your passkey in the prompt and confirm. You're signed in to the account the passkey belongs to.

A passkey is saved on the device (or synced by its password manager, such as iCloud Keychain or Google Password Manager). To sign in on another device, register a passkey there too.

| Where | Code |
| --- | --- |
| Endpoints | [`src/modules/passkey/passkey.controller.ts`](../src/modules/passkey/passkey.controller.ts) |
| Logic | [`src/modules/passkey/passkey.service.ts`](../src/modules/passkey/passkey.service.ts), using [`@simplewebauthn/server`](https://simplewebauthn.dev/docs/packages/server) v13 |
| Data | [`src/entities/passkey.entity.ts`](../src/entities/passkey.entity.ts), `currentChallenge` in [`src/entities/user.entity.ts`](../src/entities/user.entity.ts) |
| Client | The frontend repo: `src/pages/passkey` (register), `src/pages/login` (sign in), `src/api.ts`, using `@simplewebauthn/browser`. Its `docs/passkey.md` mirrors this file. |

Both registration and sign-in take two requests. The first returns options with a fresh challenge. The second sends back the browser's signed response for the backend to verify. Registration identifies the account by `userName` (the user's email). Sign-in needs no email: the browser offers the passkeys it has saved for this site, and the backend finds the account from the one the user picks.

## Registration flow

Signed-in users start from the **Passkey** link in the top nav (`/passkey`).

1. The user clicks **Add Passkey**.
2. `api.GetPasskeyRegistrationOptions(userName)` calls `POST /passkey`. The backend:
   - looks up the user by email (`400 Invalid user` if not found);
   - generates registration options and lists the user's existing passkeys in `excludeCredentials`, so the same authenticator can't be registered twice;
   - saves the challenge in `user.currentChallenge`.
3. `startRegistration({ optionsJSON })` asks the device to create the credential.
4. `api.VerifyPasskeyRegistration(userName, authResp)` calls `POST /passkey/verify`. The backend checks the response against the saved challenge, `ORIGIN` and `RP_ID`. It then saves a `Passkey` row, clears the challenge and returns `{ verified: true }`.

Registration options the backend uses:

| Option | Value | Effect |
| --- | --- | --- |
| `authenticatorAttachment` | `platform` | Only the device's built-in authenticator (Touch ID, Face ID, Windows Hello, Android screen lock). You can't use security keys or a phone scanned by QR code. |
| `residentKey` | `required` | The device must store a discoverable passkey, one it can offer without being told the account. Sign-in without an email depends on this. |
| `userVerification` | `preferred` | The device asks for a biometric or PIN when it can. |
| `attestationType` | `none` | No attestation certificate is requested or checked. |

## Sign-in flow

The login page shows **Sign in with passkey** only when the browser supports WebAuthn. The email field isn't needed.

1. The user clicks **Sign in with passkey**.
2. `api.GetPasskeyLoginOptions()` calls `POST /passkey/login`. The backend generates options with an empty `allowCredentials`, so the browser can offer any passkey saved for this site. It remembers the challenge in memory for 5 minutes.
3. `startAuthentication({ optionsJSON })` shows the device's passkey picker, and the chosen passkey signs the challenge.
4. `api.VerifyPasskeyLogin(authResp)` calls `POST /passkey/login/verify`. The backend:
   - reads the challenge out of the response's `clientDataJSON` and checks that it issued it, that it hasn't expired and that it hasn't been used, then discards it;
   - finds the passkey, and with it the user, by the credential ID in `authResp.id`;
   - verifies the signature with the stored public key, and the challenge, `ORIGIN` and `RP_ID`;
   - saves the new signature counter and returns `{ user }` (the email), the same response as password login.
5. The frontend stores the user in session storage and redirects, exactly as after password login.

## Endpoints

All four are `POST` requests with a JSON body, served on `PORT` (default `8001`).

| Path | Body | Success | Errors |
| --- | --- | --- | --- |
| `/passkey` | `{ userName }` | Registration options (`PublicKeyCredentialCreationOptionsJSON`) | `400 Invalid user` |
| `/passkey/verify` | `{ userName, authResp }` | `{ verified: true }` | `400 No registration in progress`, `400 Registration verification failed`, `500` (see [Known limitations](#known-limitations)) |
| `/passkey/login` | none | Sign-in options (`PublicKeyCredentialRequestOptionsJSON`) | none |
| `/passkey/login/verify` | `{ authResp }` | `{ user }` | `401 Sign-in request expired, please try again`, `401 Passkey not recognised`, `401` with the library's verification error |

The frontend shows each error's `message` to the user.

## Data model

**`passkey` table** (`Passkey` entity). Each user can have many rows.

| Column | Type | Contents |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `credential_id` | bytea | The base64url credential ID, stored as UTF-8 bytes. A column transformer converts it back, so code always sees a string. |
| `public_key` | bytea | COSE public key used to verify sign-in signatures |
| `counter` | integer, nullable | Signature counter, updated after each sign-in. Many platform passkeys always report `0`. |
| `transports` | text[], nullable | How the browser can reach the authenticator (e.g. `internal`, `hybrid`). Sent back as a hint. |
| `user_id` | uuid, FK to `user` | Owner |

**`user.currentChallenge`** (varchar, nullable) holds the pending *registration* challenge. It is cleared after a successful registration.

**Sign-in challenges** aren't in the database, because the user isn't known when sign-in starts. `PasskeyService` keeps them in an in-memory map (`loginChallenges`), each valid for 5 minutes and removed once used. Expired entries are pruned whenever a new sign-in starts.

The schema is created by TypeORM `synchronize: true`; there are no migrations.

## Configuration

Backend `.env`:

| Variable | Current value | Meaning |
| --- | --- | --- |
| `RP_NAME` | `SimpleWebAuthn Example` | Name shown in the browser's passkey prompt. Still the library's example value. |
| `RP_ID` | `localhost` | Domain passkeys are bound to. Must be the frontend's host (or a parent domain of it). |
| `ORIGIN` | `http://localhost:5173` | Exact frontend origin, including scheme and port. Must match where the frontend is served. |

If any of these is unset, the service falls back to an empty string, and every registration and sign-in fails.

The frontend's `VITE_API_HOST` must point at this server.

WebAuthn only works in a secure context: HTTPS, or `localhost` during development.

## Known limitations

- **Anyone can register a passkey for any email.** `POST /passkey` and `/passkey/verify` trust the `userName` in the request body. The backend has no session or token to confirm who is calling, and password login only returns the email. So someone who knows a user's email can register their own passkey on that account and then sign in as that user. Registration must be tied to an authenticated session before this goes to production.
- **Registration verification errors return 500.** `verifyRegistrationResponse` throws on a mismatched challenge, origin or RP ID. `/passkey/verify` doesn't catch this, so the user sees "Internal server error". Sign-in catches the same kind of error and returns a `401`.
- **Passkeys registered before sign-in became usernameless may not show up.** Those were created with `residentKey: 'preferred'`, so some devices stored them as non-discoverable. Remove them from the device and register again. Most platform authenticators (Apple, Windows Hello, Google Password Manager) create discoverable passkeys anyway.
- **Sign-in challenges live in memory.** A backend restart cancels any sign-in in progress. If the backend runs on more than one instance, the challenge must be stored somewhere shared (a table or Redis), or verification fails whenever it lands on a different instance.
- **Only built-in authenticators** (see `authenticatorAttachment` above).
- **Debug logging:** the service logs the full verification result on every registration (`console.log` in `verifyPasskeyRegistration`).
- **Error messages reveal accounts:** registration's `Invalid user` tells a caller whether an email has an account.

## Troubleshooting

- **"Internal server error" when adding a passkey**: registration verification failed; usually `ORIGIN` or `RP_ID` doesn't match the frontend URL. The backend logs have the real error.
- **The passkey picker shows no passkeys, or "Passkey not recognised"**: no passkey for this site is saved on this device, or the saved one was deleted on the server. Register one from `/passkey` while signed in with a password.
- **"Sign-in request expired, please try again"**: more than 5 minutes passed, the backend restarted, or the request was already used. Click the button again.
- **"No registration in progress"**: the registration challenge was already used (for example, another tab registered first). Try again.
- **`SecurityError` / "The operation is insecure"**: the page isn't served over HTTPS or `localhost`, or `RP_ID` doesn't match the current domain.
- **`InvalidStateError` when registering**: this device already has a passkey for the account.
- **`NotAllowedError`**: the user cancelled the prompt or it timed out.
