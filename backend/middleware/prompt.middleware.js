import jwt from "jsonwebtoken";

export const isAuthenticated = async (req, res, next) => {
  try {
    console.log("=== MIDDLEWARE DEBUG ===");
    console.log("All headers:", req.headers);
    
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No auth header or wrong format");
      return res.status(401).json({ error: "Access denied. No token provided." });
    }
    
    const token = authHeader.split(" ")[1];
    console.log("Extracted token:", token);
    
    const decoded = jwt.verify(token, process.env.JWT_PASSWORD);
    console.log("Decoded token:", decoded);
    
    // Set req.user to match what the controller expects
    req.user = { id: decoded.id };
    console.log("Set req.user.id to:", req.user.id);
    console.log("=== MIDDLEWARE SUCCESS ===");
    
    next();
  } catch (error) {
    console.log("JWT verification error:", error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token has expired" });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token" });
    } else {
      return res.status(401).json({ error: "Invalid token or expired" });
    }
  }
};