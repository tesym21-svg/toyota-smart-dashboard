const handleRequest = require('../server.js');

module.exports = (req, res) => {
  req.url = '/api/targets';
  return handleRequest(req, res);
};
