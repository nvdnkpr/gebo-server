var utils = require('../lib/utils');

/**
 * Inspired by Greg Wang, 2013-11-5
 * http://stackoverflow.com/questions/5364928/node-js-require-all-files-in-a-folder
 *
 * Load `*.js` under current directory as properties
 * i.e., `User.js` will become `exports['User']` or `exports.User`
 */
module.exports = function(email) {

    // Turn the email into a mongo-friendly database name
    var dbName = utils.ensureDbName(email);

    require('fs').readdirSync(__dirname + '/').forEach(function(file) {
        if (file.match(/^\w+\.js/g) !== null && file !== 'index.js') {
          var actions = require('./' + file)(dbName);
          var keys = Object.keys(actions);

          for (var i = 0; i < keys.length; i++) {
            if (!exports[keys[i]]) {
              exports[keys[i]] = actions[keys[i]];
             // throw 'Two actions cannot have the same name';
            }
          }
        }
      });

    return exports;
  };