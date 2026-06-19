module.exports = {

  apps: [

    {

      name: 'trendupp-api',

      script: './dist/src/main.js',

      instances: 'max',      // Utilizes all CPU cores for clustering

      exec_mode: 'cluster',   // Zero-downtime cluster mode

      autorestart: true,

      watch: false,

      max_memory_restart: '1G',

      env_production: {

        NODE_ENV: 'production',

        PORT: 3000 // Your backend port

      }

    }

  ]

};