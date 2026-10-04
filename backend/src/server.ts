import { app } from './app.js';
import { config } from './config/env.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Field Service Dispatch Backend listening on port ${PORT}`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/api/health`);
});
