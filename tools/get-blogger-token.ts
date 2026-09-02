import * as http from 'node:http';
import * as url from 'node:url';

const CLIENT_ID = process.env.BLOGGER_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.BLOGGER_CLIENT_SECRET?.trim();
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`
Usage:
  $env:BLOGGER_CLIENT_ID="your_client_id.apps.googleusercontent.com"
  $env:BLOGGER_CLIENT_SECRET="your_client_secret"
  npx tsx tools/get-blogger-token.ts
`);
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/blogger',
  access_type: 'offline',
  prompt: 'consent'
}).toString();

console.log('\n=== Blogger OAuth Token Generator ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in and grant Blogger permissions.');
console.log('3. Waiting for authorization callback on localhost:3000...\n');

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url || '', true);
  if (reqUrl.pathname === '/oauth2callback') {
    const code = reqUrl.query.code as string;
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing auth code.');
      return;
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json() as any;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success!</h1><p>You can close this window now. Return to your terminal to copy the refresh token.</p>');

      console.log('\n🎉 SUCCESS! Generated OAuth Credentials:\n');
      console.log(`BLOGGER_REFRESH_TOKEN: ${tokenData.refresh_token}`);
      console.log('\nAdd this secret to your GitHub Repository (Settings -> Secrets and variables -> Actions)!\n');
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error exchanging code: ${err.message}`);
    } finally {
      server.close();
      process.exit(0);
    }
  }
});

server.listen(PORT);
