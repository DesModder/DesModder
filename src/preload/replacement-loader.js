const path = require("path");

module.exports = function (content, map, meta) {
  return (
    "export default " +
    JSON.stringify({
      file: content,
      filename: path.basename(this.resourcePath),
    })
  );
};
