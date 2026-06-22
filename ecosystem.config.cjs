const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'ps-keyvault',
      cwd: `${root}/ps-wallet-backend-matt-created/python`,
      script: '.venv/bin/python3',
      args: '-m ps_keyvault.api',
      interpreter: 'none',
      autorestart: true,
      env: { KEYVAULT_PORT: '5002', CHIA_USE_REMOTE: 'true' },
    },
    {
      name: 'ps-wallet',
      cwd: `${root}/ps-wallet-backend-matt-created`,
      script: 'src/index.js',
      interpreter: 'node',
      autorestart: true,
      env: {
        PORT: '3099',
        KEYVAULT_PYTHON_URL: 'http://127.0.0.1:5002',
        CORS_ORIGINS: 'https://app.pinksurfing.com',
      },
    },
    {
      name: 'ps-gateway',
      cwd: `${root}/pinksurfing-platform`,
      script: 'npm',
      args: 'run start:prod -w @pinksurfing/api',
      interpreter: 'none',
      autorestart: true,
      env: {
        PORT: '8080',
        WALLET_API_URL: 'http://127.0.0.1:3099',
        APP_API_URL: 'https://coreapi.pinksurfing.com',
        CORS_ORIGINS: 'https://app.pinksurfing.com',
      },
    },
    {
      name: 'ps-web',
      cwd: `${root}/pinksurfing-platform`,
      script: 'npm',
      args: 'run start -w @pinksurfing/web',
      interpreter: 'none',
      autorestart: true,
      env: { PORT: '3000' },
    },
  ],
};