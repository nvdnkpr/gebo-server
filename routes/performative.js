'use strict';

var passport = require('passport'),
    nconf = require('nconf'),
    utils = require('../lib/utils'),
    sc = require('../lib/sc'),
    geboSchema = require('../schemata/gebo'),
    agentSchema = require('../schemata/agent'),
    extend = require('extend'),
    q = require('q');

module.exports = function(email) {

    // Turn the email into a mongo-friend database name
    var dbName = utils.ensureDbName(email);
    var action = require('../actions')(dbName);

    /**
     * Receive a request for consideration
     */
    exports.request = [
        function(req, res, next) {
            if (req.user) {
              return next();
            }
            passport.authenticate(['bearer'], { session: false })(req, res, next);
        },
        function(req, res) {

            var message = req.body;

            // Form a social commitment
            sc.form(req.user, 'request', message).
                then(function(sc) {
                    console.log('\n---------------------------- SC ---------------------------');
                    console.log(sc);
                    _verify(req.user, message).
                        then(function(verified) {

                                // There might be files attached to the request.
                                // They are included here, because it seems 
                                // silly to attach them to the social commitment.
                                extend(true, message, req.files);

                                console.log('request');
                                console.log(req.user);
                                console.log(req.authInfo);
                                console.log('message');
                                console.log(message);
                                console.log('verified');
                                console.log(verified);
                    
                                action[message.action](verified, message).
                                    then(function(data) {
//                                        console.log('data');
//                                        console.log(data);
                                        sc.fulfil(message.recipient, sc._id).
                                            then(function(sc) {
                                                res.send(data);
                                              }).
                                            catch(function(err) {
                                                console.log(err);       
                                                res.send(401, err);
                                              });
                                      }).
                                    catch(function(err) {
                                        console.log('action error');
                                        console.log(err);
                                        res.send(404, err);
                                      });
                              }).
                        catch(function(err) {
                            console.log('verification error');
                            console.log(err);
                            res.send(401, err);
                          });
                  }).
                catch(function(err) {
                    console.log('Cannot commit');
                    console.log(err);
                    res.send(401, err);
                  });
           }
      ];

    /**
     * Determine what permissions an agent has on a
     * given object
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    function _verify(agent, message) {
        var deferred = q.defer();

	var verified = {
                collectionName: utils.getMongoCollectionName(message.resource),
                admin: agent.admin,
                dbName: utils.getMongoDbName(message.recipient)
            };

        if (!verified.dbName) {
          verified.dbName = utils.getMongoDbName(agent.email);
        }

        if (utils.getMongoDbName(agent.email) !== verified.dbName && !verified.admin) {
          var agentDb = new agentSchema(verified.dbName);
  
          agentDb.friendModel.findOne({ email: agent.email}, function(err, friend) {
                agentDb.connection.db.close();
                if (err) {
                  deferred.reject(err);
                }
                if (!friend) {
                  deferred.reject('I don\'t know you');
                }
                else { 
                  // Search the array for requested resource
                  var index = utils.getIndexOfObject(friend.hisPermissions, 'email', verified.collectionName);

                  if (index > -1) {
                    verified.read = friend.hisPermissions[index].read;
                    verified.write = friend.hisPermissions[index].write;
                    verified.execute = friend.hisPermissions[index].execute;
                    deferred.resolve(verified);
                  }
                  else {
                    deferred.reject('You don\'t have access to that resource');
                  }
                }
              });
        }
        // This agent is requesting access to his own resources
        else {
          verified.read = true;
          verified.write = true;
          verified.execute = true;
          deferred.resolve(verified);
        }

        return deferred.promise;
      };
    exports.verify = _verify;
    
    return exports;
  };


