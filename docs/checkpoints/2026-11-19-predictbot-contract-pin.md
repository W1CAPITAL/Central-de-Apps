# PredictBot contract pin

The Central source called `OpenCodeAdapter.switchModel`, while `package.json` and `package-lock.json` still installed PredictBot commit `5e09212a`, which predates that method. The Windows workflow hid the mismatch by rewriting the dependency to the latest PredictBot `main` before packaging. A clean `npm ci` from the Central repository therefore did not reproduce the published build.

The regression test imports the adapter from the dependency actually installed by the lockfile and requires the session model operation used by the Central. It failed against the previous pin with `switchModel` undefined. The pin and lockfile now use verified PredictBot commit `306de7eb`, whose own 47 tests and syntax checks pass.

Local validation: clean `npm ci`, Central syntax checks and 83 tests passed. This change does not alter authentication, remote bridge scopes, RLS, updater policy or model execution. No real account, paid inference, customer data or external message was used. The Windows workflow remains responsible for packaging and must pass before merge.
