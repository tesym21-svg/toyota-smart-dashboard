const handleRequest = require('../../server.js');

module.exports = (req, res) => {
  req.url = '/api/kpi-teknisi/sync-sheet';
  return handleRequest(req, res);
};
