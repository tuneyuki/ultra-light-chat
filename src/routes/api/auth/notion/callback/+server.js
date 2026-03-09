/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state') || '';
	const error = url.searchParams.get('error');

	if (error) {
		return new Response(renderHTML(null, state, error), {
			headers: { 'Content-Type': 'text/html' }
		});
	}

	// Read stored OAuth data from cookie
	const oauthCookie = cookies.get('notion_mcp_oauth');
	if (!oauthCookie) {
		return new Response(renderHTML(null, state, 'session_expired'), {
			headers: { 'Content-Type': 'text/html' }
		});
	}

	/** @type {{ code_verifier: string, client_id: string, client_secret: string | null, token_endpoint: string, state: string }} */
	let oauthData;
	try {
		oauthData = JSON.parse(oauthCookie);
	} catch {
		return new Response(renderHTML(null, state, 'invalid_session'), {
			headers: { 'Content-Type': 'text/html' }
		});
	}

	// Validate state
	if (state !== oauthData.state) {
		return new Response(renderHTML(null, state, 'state_mismatch'), {
			headers: { 'Content-Type': 'text/html' }
		});
	}

	if (!code) {
		return new Response(renderHTML(null, state, 'no_code'), {
			headers: { 'Content-Type': 'text/html' }
		});
	}

	// Exchange code for token using PKCE code_verifier
	const redirectUri = `${url.origin}/api/auth/notion/callback`;
	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		client_id: oauthData.client_id,
		redirect_uri: redirectUri,
		code_verifier: oauthData.code_verifier
	});
	if (oauthData.client_secret) {
		params.append('client_secret', oauthData.client_secret);
	}

	try {
		const tokenRes = await fetch(oauthData.token_endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			},
			body: params
		});

		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			console.error('MCP token exchange failed:', tokenRes.status, text);
			return new Response(renderHTML(null, state, 'token_exchange_failed'), {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		const tokenData = await tokenRes.json();

		// Clean up cookie
		cookies.delete('notion_mcp_oauth', { path: '/api/auth/notion' });

		console.log('Notion MCP OAuth success');

		return new Response(renderHTML({
			token: tokenData.access_token,
			refreshToken: tokenData.refresh_token || null,
			expiresIn: tokenData.expires_in || 3600,
			clientId: oauthData.client_id,
			clientSecret: oauthData.client_secret,
			tokenEndpoint: oauthData.token_endpoint
		}, state, null), {
			headers: { 'Content-Type': 'text/html' }
		});
	} catch (err) {
		console.error('Notion MCP OAuth error:', err);
		return new Response(renderHTML(null, state, 'unexpected_error'), {
			headers: { 'Content-Type': 'text/html' }
		});
	}
}

/**
 * @param {{ token: string, refreshToken: string | null, expiresIn: number, clientId: string, clientSecret: string | null, tokenEndpoint: string } | null} result
 * @param {string} state
 * @param {string | null} error
 * @returns {string}
 */
function renderHTML(result, state, error) {
	const payload = {
		type: 'notion-oauth-callback',
		state,
		token: result?.token || null,
		refreshToken: result?.refreshToken || null,
		expiresIn: result?.expiresIn || null,
		clientId: result?.clientId || null,
		clientSecret: result?.clientSecret || null,
		tokenEndpoint: result?.tokenEndpoint || null,
		error: error || null
	};

	return `<!DOCTYPE html>
<html><head><title>Notion MCP連携</title></head>
<body>
<p>${error ? '接続に失敗しました。このウィンドウを閉じてください。' : '接続完了。このウィンドウは自動的に閉じます...'}</p>
<script>
if (window.opener) {
	window.opener.postMessage(JSON.parse(${JSON.stringify(JSON.stringify(payload))}), window.location.origin);
}
window.close();
</script>
</body></html>`;
}
