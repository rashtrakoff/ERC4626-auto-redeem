module.exports = {
  apps : [{
    name   : "erc4626-auto-redeem",
    script : "pnpm start",
    env: {
      NODE_ENV: "production",
    },
    autorestart: true,
  }]
}
