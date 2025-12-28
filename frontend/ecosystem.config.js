module.exports = {
  apps: [
    {
      name: "frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "C:/Projects/ai-agent-automation/frontend",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};