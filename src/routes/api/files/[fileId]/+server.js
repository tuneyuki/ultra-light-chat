import { env } from '$env/dynamic/private';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const { fileId } = params;
	const filename = url.searchParams.get('filename') || 'download';
	const containerId = url.searchParams.get('container_id');

	// Container files (cfile_*) use the containers API endpoint
	const apiUrl = containerId
		? `https://api.openai.com/v1/containers/${containerId}/files/${fileId}/content`
		: `https://api.openai.com/v1/files/${fileId}/content`;

	const upstream = await fetch(apiUrl, {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});

	if (!upstream.ok) {
		const text = await upstream.text();
		return new Response(text, {
			status: upstream.status,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';

	return new Response(upstream.body, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
}
