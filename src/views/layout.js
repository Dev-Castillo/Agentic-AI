'use strict';

const { escapeHtml } = require('../lib/html');

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
${body}
  </main>
</body>
</html>
`;
}

module.exports = { layout };
