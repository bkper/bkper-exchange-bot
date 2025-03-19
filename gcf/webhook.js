import ngrok from '@ngrok/ngrok';
import { Bkper } from 'bkper-js';
import { getOAuthToken } from 'bkper';
import { App } from 'bkper-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Ensure env at right location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

process.env.NODE_ENV = 'development';

Bkper.setConfig({
  oauthTokenProvider: () => getOAuthToken(),
  apiKeyProvider: () => process.env.BKPER_API_KEY
})

const app = new App();

(async function () {
  try {
    const webhookListener = await ngrok.forward({ port: 3003, authtoken_from_env: true });
    const url = webhookListener.url();
    console.log(`Started ngrok at ${url}`);
    await app.setWebhookUrlDev(url).patch();
  } catch (err) {
    console.log(err);
  }
})();

async function exit() {
  try {
    await app.setWebhookUrlDev(null).patch();
    console.log(' \nRemoved webhook.');
  } catch (err) {
    console.log(err);
  }
  process.exit();
}

process.on('exit', exit);
process.on('SIGINT', exit);
process.on('SIGUSR1', exit);
process.on('SIGUSR2', exit);
process.on('uncaughtException', exit);
