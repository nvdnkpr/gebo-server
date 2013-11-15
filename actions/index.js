var utils = require('../lib/utils'),
    q = require('q');

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

    /**
     * Agree to perform the requested action
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    exports.agree = function(verified, message) {
        var deferred = q.defer();
        if (verified.admin || (verified.read && verified.write && verified.execute)) { 
          console.log('message');
          console.log(message);
          exports[message.action](verified, message.data).
            then(function(data) {
                deferred.resolve(data);
              }).
            catch(function(err) {
                deferred.reject(err);
              });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
 
        return deferred.promise;
      };

    /**
     * Refuse to perform the requested action
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    exports.refuse = function(verified, message) {
        var deferred = q.defer();
        if (verified.admin || (verified.read && verified.write && verified.execute)) { 
          deferred.resolve();
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
 
        return deferred.promise;
      };

    return exports;
  };
