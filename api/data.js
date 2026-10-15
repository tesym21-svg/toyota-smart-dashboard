const handleRequest = require('../server.js');

module.exports = (req, res) => {
  req.url = '/api/data';
  return handleRequest(req, res);
};
