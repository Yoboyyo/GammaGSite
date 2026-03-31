export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secretKey = Netlify.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { lineItems, successUrl, cancelUrl, customerEmail, metadata } = body;

  if (!lineItems || !lineItems.length) {
    return new Response(JSON.stringify({ error: 'No line items provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const sessionPayload = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU']
      },
      metadata: metadata || {}
    };

    if (customerEmail) {
      sessionPayload.customer_email = customerEmail;
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(flattenForStripe(sessionPayload)).toString()
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session.error);
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Flatten nested object into Stripe's form-encoded format
function flattenForStripe(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenForStripe(item, `${fullKey}[${i}]`));
        } else {
          result[`${fullKey}[${i}]`] = item;
        }
      });
    } else if (typeof value === 'object') {
      Object.assign(result, flattenForStripe(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

export const config = {
  path: '/api/create-checkout'
};
