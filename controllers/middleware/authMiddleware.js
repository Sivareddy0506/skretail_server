// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImlhdCI6MTcyMDc2MTI0MywiZXhwIjoxNzIwNzY0ODQzfQ.eEHBDfkfWW6bUgbRTFMSzA5OjeHxWyxVLxbdz5BTf8s'; // Replace with your secret key for JWT


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification error:', err);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
