const { getConfig } = require('./backend/config');
const { createApp } = require('./backend/app');

const config = getConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Server listening on http://0.0.0.0:${config.port}`);
});
