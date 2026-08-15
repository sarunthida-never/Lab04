import express from 'express';
import { execFile } from 'child_process';

export const debugRouter = express.Router();

// DEBUG: ping a host to check connectivity from the server
debugRouter.get('/ping', (req, res, next) => {
  const host = String(req.query.host ?? 'localhost');

  // Allowlist: hostnames / IPs only — reject anything with shell metacharacters.
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return res.status(400).json({ error: 'invalid host' });
  }

  // execFile passes args as an array — no shell, so no command injection.
  execFile('ping', ['-c', '1', host], (err, stdout) => {
    if (err) return next(err);
    res.type('text/plain').send(stdout);
  });
});
