const allowedOrigins = [
  "https://shopantik.com"
];

export function handleCors(req, res) {
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return true; // Stop further execution
    }
    
    return false; // Continue to the main logic
  } else {
    res.status(403).json({ message: "CORS policy: Origin not allowed" });
    return true; // Stop further execution
  }
}
