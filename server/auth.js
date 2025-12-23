import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Issuer, Strategy as OIDCStrategy } from 'openid-client';
import jwt from 'jsonwebtoken';

// Configuration from environment variables
const AUTH_CONFIG = {
  disabled: process.env.AUTH_DISABLED === 'true' || process.env.AUTH_DISABLED === '1',
  sessionSecret: process.env.SESSION_SECRET || 'shellsight-secret-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'shellsight-jwt-secret-change-in-production',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Google OAuth
  google: {
    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  // GitHub OAuth
  github: {
    enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  },

  // Microsoft OAuth
  microsoft: {
    enabled: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  },

  // Generic OIDC
  oidc: {
    enabled: !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    displayName: process.env.OIDC_DISPLAY_NAME || 'SSO',
  },
};

// User store (in production, use a database)
const users = new Map();

function findOrCreateUser(profile, provider) {
  const id = `${provider}:${profile.id}`;
  let user = users.get(id);

  if (!user) {
    user = {
      id,
      provider,
      providerId: profile.id,
      email: profile.emails?.[0]?.value || profile.email || '',
      name: profile.displayName || profile.name || profile.username || '',
      avatar: profile.photos?.[0]?.value || profile.picture || '',
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
  }

  return user;
}

// Serialize/deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user || null);
});

// Configure Google Strategy
if (AUTH_CONFIG.google.enabled) {
  passport.use(new GoogleStrategy({
    clientID: AUTH_CONFIG.google.clientId,
    clientSecret: AUTH_CONFIG.google.clientSecret,
    callbackURL: `${AUTH_CONFIG.baseUrl}/auth/google/callback`,
    scope: ['profile', 'email'],
  }, (accessToken, refreshToken, profile, done) => {
    const user = findOrCreateUser(profile, 'google');
    done(null, user);
  }));
}

// Configure GitHub Strategy
if (AUTH_CONFIG.github.enabled) {
  passport.use(new GitHubStrategy({
    clientID: AUTH_CONFIG.github.clientId,
    clientSecret: AUTH_CONFIG.github.clientSecret,
    callbackURL: `${AUTH_CONFIG.baseUrl}/auth/github/callback`,
    scope: ['user:email'],
  }, (accessToken, refreshToken, profile, done) => {
    const user = findOrCreateUser(profile, 'github');
    done(null, user);
  }));
}

// Configure Microsoft Strategy
if (AUTH_CONFIG.microsoft.enabled) {
  passport.use(new MicrosoftStrategy({
    clientID: AUTH_CONFIG.microsoft.clientId,
    clientSecret: AUTH_CONFIG.microsoft.clientSecret,
    callbackURL: `${AUTH_CONFIG.baseUrl}/auth/microsoft/callback`,
    tenant: AUTH_CONFIG.microsoft.tenantId,
    scope: ['user.read'],
  }, (accessToken, refreshToken, profile, done) => {
    const user = findOrCreateUser(profile, 'microsoft');
    done(null, user);
  }));
}

// Configure OIDC Strategy (async setup)
async function setupOIDC() {
  if (!AUTH_CONFIG.oidc.enabled) return;

  try {
    const issuer = await Issuer.discover(AUTH_CONFIG.oidc.issuer);
    const client = new issuer.Client({
      client_id: AUTH_CONFIG.oidc.clientId,
      client_secret: AUTH_CONFIG.oidc.clientSecret,
      redirect_uris: [`${AUTH_CONFIG.baseUrl}/auth/oidc/callback`],
      response_types: ['code'],
    });

    passport.use('oidc', new OIDCStrategy({
      client,
      params: {
        scope: 'openid profile email',
      },
    }, (tokenSet, userinfo, done) => {
      const profile = {
        id: userinfo.sub,
        displayName: userinfo.name || userinfo.preferred_username,
        email: userinfo.email,
        picture: userinfo.picture,
      };
      const user = findOrCreateUser(profile, 'oidc');
      done(null, user);
    }));

    console.log('OIDC strategy configured successfully');
  } catch (error) {
    console.error('Failed to configure OIDC:', error.message);
  }
}

// Generate JWT token for user
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    AUTH_CONFIG.jwtSecret,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, AUTH_CONFIG.jwtSecret);
  } catch (error) {
    return null;
  }
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  // Skip auth if disabled
  if (AUTH_CONFIG.disabled) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@localhost',
      name: 'Anonymous User',
      provider: 'none',
    };
    return next();
  }

  // Check session
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = users.get(decoded.id) || decoded;
      return next();
    }
  }

  res.status(401).json({ error: 'Authentication required' });
}

// Check if auth is disabled
function isAuthDisabled() {
  return AUTH_CONFIG.disabled;
}

// Get available auth providers
function getAvailableProviders() {
  const providers = [];

  if (AUTH_CONFIG.google.enabled) {
    providers.push({ id: 'google', name: 'Google', icon: 'google' });
  }
  if (AUTH_CONFIG.github.enabled) {
    providers.push({ id: 'github', name: 'GitHub', icon: 'github' });
  }
  if (AUTH_CONFIG.microsoft.enabled) {
    providers.push({ id: 'microsoft', name: 'Microsoft', icon: 'microsoft' });
  }
  if (AUTH_CONFIG.oidc.enabled) {
    providers.push({ id: 'oidc', name: AUTH_CONFIG.oidc.displayName, icon: 'key' });
  }

  return providers;
}

export {
  passport,
  AUTH_CONFIG,
  setupOIDC,
  generateToken,
  verifyToken,
  requireAuth,
  getAvailableProviders,
  findOrCreateUser,
  isAuthDisabled,
};
