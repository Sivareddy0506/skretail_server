const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = 'Mwx0uSd0fF5hGNDWZ3T+ohGZFhMOn+RwF30jO39n+5w='; // Replace with your secret key for JWT
 // Replace with your actual secret key for JWT
const REFRESH_SECRET = '1e+/kf4N21VEF9k+jWfFn/MsX0ZyEAueVGIsbrxkJhI='; // Replace with your actual secret key for refresh tokens

// Function to generate access tokens
const generateAccessToken = (user) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// Function to generate refresh tokens
const generateRefreshToken = (user) => {
  return jwt.sign(user, REFRESH_SECRET, { expiresIn: '7d' });
};

exports.signup = async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken({ userId: user.rows[0].id, email: user.rows[0].email });
    const refreshToken = generateRefreshToken({ userId: user.rows[0].id, email: user.rows[0].email });

    // Store the refresh token in a secure way, e.g., in the database
    // await pool.query('INSERT INTO refresh_tokens (token) VALUES ($1)', [refreshToken]);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Token refresh function
exports.refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);

  try {
    const user = jwt.verify(token, REFRESH_SECRET);
    const accessToken = generateAccessToken({ userId: user.userId, email: user.email });
    res.json({ accessToken });
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.sendStatus(403);
  }
};
