import { redirect } from '@sveltejs/kit';

const MCP_SERVER_URL = 'https://mcp.notion.com';

/**
 * Base64url-encode a buffer.
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
function base64URLEncode(buffer) {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	const str = btoa(String.fromCharCode(...bytes));
	return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	const state = url.searchParams.get('state') || '';
	const origin = url.origin;
	const redirectUri = `${origin}/api/auth/notion/callback`;

	try {
		// Step 1: OAuth Discovery
		const prRes = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-protected-resource`);
		if (!prRes.ok) {
			console.error('OAuth discovery failed (protected-resource):', prRes.status);
			return new Response('OAuth discovery failed', { status: 502 });
		}
		const prMeta = await prRes.json();
		const authServerUrl = prMeta.authorization_servers?.[0];
		if (!authServerUrl) {
			return new Response('No authorization server found', { status: 502 });
		}

		const asRes = await fetch(`${authServerUrl}/.well-known/oauth-authorization-server`);
		if (!asRes.ok) {
			console.error('OAuth discovery failed (auth-server):', asRes.status);
			return new Response('Authorization server metadata fetch failed', { status: 502 });
		}
		const metadata = await asRes.json();

		// Step 2: Dynamic Client Registration
		const regRes = await fetch(metadata.registration_endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify({
				client_name: 'Ultra Light Chat',
				redirect_uris: [redirectUri],
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
				token_endpoint_auth_method: 'none'
			})
		});
		if (!regRes.ok) {
			const text = await regRes.text();
			console.error('Client registration failed:', regRes.status, text);
			return new Response('Client registration failed', { status: 502 });
		}
		const regData = await regRes.json();

		// Step 3: PKCE
		const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
		const codeVerifier = base64URLEncode(verifierBytes);
		const challengeHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
		const codeChallenge = base64URLEncode(challengeHash);

		// Step 4: Store OAuth state in cookie
		const oauthData = JSON.stringify({
			code_verifier: codeVerifier,
			client_id: regData.client_id,
			client_secret: regData.client_secret || null,
			token_endpoint: metadata.token_endpoint,
			state
		});
		cookies.set('notion_mcp_oauth', oauthData, {
			path: '/api/auth/notion',
			httpOnly: true,
			sameSite: 'lax',
			secure: origin.startsWith('https'),
			maxAge: 600
		});

		// Step 5: Redirect to authorization endpoint
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: regData.client_id,
			redirect_uri: redirectUri,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
			state,
			prompt: 'consent'
		});

		redirect(302, `${metadata.authorization_endpoint}?${params}`);
	} catch (err) {
		if (/** @type {any} */ (err)?.status === 302) throw err; // re-throw SvelteKit redirect
		console.error('Notion MCP OAuth init error:', err);
		return new Response('OAuth initialization failed', { status: 500 });
	}
}
