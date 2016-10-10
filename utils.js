const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const marked = require('marked');
const winston = require('winston');

exports.queryDictsMatch = function(dict1, dict2) {
  var keys = _.keys(dict1);
  if (_.xor(keys, _.keys(dict2)).length !== 0) return false;
  return _.every(keys, function (key) {
    if (_.isArray(dict1[key]) && _.isArray(dict2[key])) {
      return (_.xor(dict1[key], dict2[key]).length === 0);
    } else {
      return dict1[key] === dict2[key];
    }
  });
};

exports.displayReadme = function (res) {
    fs.readFile(
        path.resolve(__dirname, 'README.md'), 'utf8', function (err, data) {
            if (err) {
                winston.error(err.message);
                return res.status(500).end(err.message);
            }
            var html = [
                '<html><head>',
                '<style>.markdown-body {',
                '  box-sizing: border-box;',
                '  min-width: 200px;',
                '  max-width: 980px;',
                '  margin: 0 auto;',
                '  padding: 45px;',
                '}</style>',
                '<link rel="stylesheet" href="theme.css">',
                '</head>',
                '<body><main class="markdown-body">',
                marked(data),
                '</main></body>',
            ].join('\n');
            res.end(html);
        }
    );
};
