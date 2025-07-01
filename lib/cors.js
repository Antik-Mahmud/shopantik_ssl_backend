export function setCorsHeaders(res) {
  // In production, replace '*' with your frontend domain
  const allowedOrigin = process.env.NODE_ENV === 'production' 
    ? 'https://shopantik.com' 
    : '*';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function handleOptionsRequest(res) {
  setCorsHeaders(res);
  res.status(204).end();
}