export default async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const secretKey = Netlify.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });

    const session = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: session.error?.message }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      metadata: session.metadata || {},
      amount_total: session.amount_total,
      customer_email: session.customer_details?.email
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/get-session'
};
