import express from 'express';
import { execSync } from 'child_process';

export const debugRouter = express.Router();

// DEBUG: ping a host to check connectivity from the server
debugRouter.get('/ping', (req, res) => {
  const host = String(req.query.host ?? 'localhost');
  const output = execSync(`ping -c 1 ${host}`).toString();
  res.type('text/plain').send(output);
});
