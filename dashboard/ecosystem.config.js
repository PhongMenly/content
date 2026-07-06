module.exports = {
  apps: [
    {
      name: "phong-cron",
      script: "cron-runner.js",
      cwd: "d:/Content-Creation-Template/dashboard",
      autorestart: true,
      restart_delay: 5000,
      out_file: "logs/cron-out.log",
      error_file: "logs/cron-error.log",
    },
    {
      name: "phong-dashboard",
      script: "server.js",
      cwd: "d:/Content-Creation-Template/dashboard",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 50,
      min_uptime: "10s",
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
