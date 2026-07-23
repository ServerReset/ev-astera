/** Generate a VAPID key pair for Web Push. Paste both into server .env and the public key into client .env. */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\nVAPID keys generated. Add to your env files:\n');
console.log('# server/.env');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\n# client/.env');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
