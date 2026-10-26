const handleRequest = require('../server.js');

module.exports = (req, res) => {
  req.url = '/api/sto';
  return handleRequest(req, res);
};
