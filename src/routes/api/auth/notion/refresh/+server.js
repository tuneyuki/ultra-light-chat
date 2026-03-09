/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const { refresh_token, client_id, client_secret, token_endpoint } = await request.json();

	if (!refresh_token || !client_id || !token_endpoint) {
		return new Response(JSON.stringify({ error: 'missing_params' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token,
		client_id
	});
	if (client_secret) {
		params.append('client_secret', client_secret);
	}

	try {
		const res = await fetch(token_endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			},
			body: params
		});

		if (!res.ok) {
			const text = await res.text();
			console.error('MCP token refresh failed:', res.status, text);
			return new Response(text, {
				status: res.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = await res.json();
		return new Response(JSON.stringify(data), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('MCP token refresh error:', err);
		return new Response(JSON.stringify({ error: 'refresh_failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
