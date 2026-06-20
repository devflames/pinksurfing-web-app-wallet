export default () => ({
  port: parseInt(process.env.PORT ?? '8080', 10),
  appApiUrl: process.env.APP_API_URL ?? 'http://127.0.0.1:6003',
  walletApiUrl: process.env.WALLET_API_URL ?? 'http://127.0.0.1:3099',
  adminApiUrl: process.env.ADMIN_API_URL ?? 'http://127.0.0.1:6001',
  corsOrigins: process.env.CORS_ORIGINS ?? '',
});
