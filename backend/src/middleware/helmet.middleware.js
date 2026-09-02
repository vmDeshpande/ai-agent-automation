const helmet = require('helmet');

const hstsMaxAge = Number(process.env.HSTS_MAX_AGE);

function buildContentSecurityPolicy() {
  const directives = {
    'default-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
  };

  return directives;
}

function permissionsPolicy() {
  return (req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  };
}

const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,

  contentSecurityPolicy: {
    useDefaults: false,
    directives: buildContentSecurityPolicy(),
  },

  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  xFrameOptions: {
    action: 'deny',
  },

  xContentTypeOptions: true,

  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },

  hsts:
    typeof hstsMaxAge === 'number' && hstsMaxAge > 0
      ? {
          maxAge: hstsMaxAge,
          includeSubDomains: false,
          preload: false,
        }
      : false,
});

module.exports = [helmetMiddleware, permissionsPolicy()];
