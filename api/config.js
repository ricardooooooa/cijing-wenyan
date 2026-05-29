const { handleConfigRequest } = require("../lib/ai-core");

module.exports = async function config(request, response) {
  await handleConfigRequest(request, response, process.env);
};
