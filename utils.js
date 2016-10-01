const _ = require('lodash');

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