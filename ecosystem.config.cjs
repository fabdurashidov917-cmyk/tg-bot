module.exports = {
  apps: [
    {
      name: 'kinobot',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,              // Telegram bot faqat BITTA instansda ishlashi kerak
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '20s',
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production', TZ: 'Asia/Tashkent' },
      error_file: __dirname + '/logs/err.log',
      out_file: __dirname + '/logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
