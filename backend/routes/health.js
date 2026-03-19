const express = require('express');

function createHealthRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createHealthRouter };
