module.exports = {
  apps: [
    {
      name: "uyen-nhi-bot",
      script: "bot.js",
      cwd: "d:/Content-Creation-Template/telegram-bot",
      node_args: "--use-system-ca",
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 50,
      min_uptime: "10s",
      log_file: "d:/Content-Creation-Template/telegram-bot/logs/combined.log",
      out_file: "d:/Content-Creation-Template/telegram-bot/logs/out.log",
      error_file: "d:/Content-Creation-Template/telegram-bot/logs/error.log",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
