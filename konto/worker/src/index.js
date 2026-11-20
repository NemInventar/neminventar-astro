// Worker ni-konto-backend (+ ni-konto-backend-staging). Kun service binding fra Pages-projektet ni-konto.
// Logikken står i app.js; reglerne i regler.js; testene i ../test/ (npm run test:konto).
import { haandter } from './app.js';

export default {
  fetch: (req, env, ctx) => haandter(req, env, ctx),
};
