const { handleTranslateRequest } = require("../lib/ai-core");

module.exports = async function translate(request, response) {
  await handleTranslateRequest(request, response, process.env);
};
