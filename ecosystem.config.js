module.exports = {
  apps : [{
    name   : "erc4626-auto-redeem",
    script : "pnpm start",
    env: {
      NODE_ENV: "production",
    },
    autorestart: true,
    eror_file: "./logs/err.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",
    time: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }]
}
