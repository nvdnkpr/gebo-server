'use strict';

var config = require('../config/config'),
    mongo = require('mongodb'),
    utils = require('../lib/utils'),
    q = require('q'),
    fs = require('fs'),
    mv = require('mv'),
    mkdirp = require('mkdirp'),
    agentSchema = require('../schemata/agent'),
    geboSchema = require('../schemata/gebo');

module.exports = function(email) {

    // Turn the email into a mongo-friend database name
    var dbName = utils.ensureDbName(email);

    // Global DB, because at some point I should
    // close the connection.
    var _db;

    /**
     * Determine if the database exists. To do this,
     * a database is opened and the number of 
     * collections is counted. If the number is zero,
     * this is a new database that did not previously
     * exist.
     *
     * @param verified
     *
     * @return bool
     */
    var _dbExists = function(verified) {
        var deferred = q.defer();

        if (verified.admin || verified.read || verified.write || verified.execute) { 
          var server = new mongo.Server(
                          config.mongo.host,
                          config.mongo.port,
                          config.mongo.serverOptions);
          _db = new mongo.Db(verified.dbName, server, config.mongo.clientOptions);

          _db.open(function (err, client) {
                  if (err) {
                    console.log('ERROR! What is happening here?');
                    console.log('Check ulimit -n??');
                    console.log(err);
                    throw(err);
                  }
                  client.collectionNames(function(err, names) {
                      if (err) {
                        console.log(err);
                        throw(err);
                      }
    
                      if (names.length === 0) {
                        deferred.reject(
                                new Error('Database: ' + verified.dbName + ' does not exist'));
                        _db.dropDatabase(function(err) {
                          if (err) {
                            deferred.reject(new Error('Database: ' +
                                            verified.dbName + ' was not dropped'));
                          }
                        });
                      }
                      else {
                        deferred.resolve(client);
                      }
                    });
                });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
 
        return deferred.promise;
      };
    exports.dbExists = _dbExists;

    /**
     * Get the app's collection
     *
     * @param Object
     *
     * @return promise
     */
    var _getCollection = function(verified) {
        var deferred = q.defer();
        if (verified.admin || verified.read || verified.write || verified.execute) { 
          _dbExists(verified).
              then(function(client) {
                  var collection = new mongo.Collection(client, verified.collectionName);
                  deferred.resolve(collection);
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
    exports.getCollection = _getCollection;
    
    /**
     * Save JSON to user's profile
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    var _save = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.write) { 
          _getCollection(verified).
              then(function(collection) {
                    utils.saveFilesToAgentDirectory(message.files, verified).
                        then(function() {
                            if (message.content && message.content.data) {
                              if (message.content.data._id) {
                                message.content.data._id = new mongo.ObjectID(message.content.data._id + '');
                              }
      
                              collection.save(message.content.data, { safe: true },
                                      function(err, ack) {
                                          if (err) {
                                            deferred.reject(err);
                                          }
                                          else {
                                            deferred.resolve(ack);
                                          }
                                          _db.close();
                                        });
                            }
                            else {
                              deferred.resolve();
                              _db.close();
                            }
                          }).
                        catch(function(err) {
                            deferred.reject(err);
                            _db.close();
                          });
                    }).
                  catch(function(err) {
                      deferred.reject(err);
                      _db.close();
                    }).
                  done();
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise;
      };
    exports.save = _save;

    /**
     * Copy JSON from a user's profile
     *
     * @param Object
     * @param Object
     */
    var _cp = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.read) { 
          _getCollection(verified).
              then(function(collection) {
                      collection.find({ '_id': new mongo.ObjectID(message.content.id) }).toArray(
                              function(err, docs) {
                                      if (err) {
                                        deferred.reject(err);
                                      }
                                      else {
                                        // Should I check for multiple matches?
                                        deferred.resolve(docs[0]);
                                      }
                                      _db.close();
                                    });
                    }).
                  catch(function(err) {
                          deferred.reject(err);
                          _db.close();
                        });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise;
      };
    exports.cp = _cp;

    /**
     * Remove a doc from a user's profile
     *
     * @param Object
     * @param Object
     */
    var _rm = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.write) { 
          _getCollection(verified).
              then(function(collection) {
                      // Does this collection exist?
                      collection.count(function(err, count) {
                          if (count === 0) {
                            deferred.reject(
                                    new Error('Collection: ' +
                                            verified.collectionName + ' does not exist'));
                          }
                          else {
                            collection.remove({ _id: new mongo.ObjectID(message.content.id) },
                            function(err, ack) {
                                if (err || ack === 0) {
                                  deferred.reject(
                                          new Error('Could not delete document: ' +
                                                  message.content.id));
                                }
                                else {
                                  deferred.resolve();
                                }
                                _db.close();
                              });
                          }
                        });
                    }).
                  catch(function(err) {
                          deferred.reject(err);
                          _db.close();
                        }).
                  done();
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
 
        return deferred.promise;
      };
    exports.rm = _rm;

    /**
     * Remove a collection from the user's profile
     *
     * @param Object
     *
     * @return promise
     */
    var _rmdir = function(verified) {
        var deferred = q.defer();

        if (verified.admin || verified.execute) { 
          _getCollection(verified).
              then(function(collection) {
                      // Does this collection exist?
                      collection.count(function(err, count) {
                          if (count === 0) {
                            deferred.reject(
                              new Error('Collection: ' +
                                      verified.collectionName + ' does not exist'));
                          }
                          else {
                            collection.drop(
                                function(err, ack) {
                                    if (err || ack === 0) {
                                      deferred.reject(
                                              new Error('Could not delete collection: ' +
                                                      verified.collectionName));
                                    }
                                    else {
                                      deferred.resolve();
                                    }
                                  });
                          }
                        });
                    }).
              catch(function(err) {
                      deferred.reject(err);
                    }).
              done();
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise;
      };
    exports.rmdir = _rmdir;

    /**
     * Return a list of documents contained in the app's collection
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    var _ls = function(verified, message) {
        var deferred = q.defer();
        if (verified.admin || verified.read) { 
          _getCollection(verified).
              then(function(collection) { 
                    /**
                     * Get search parameters
                     */
                    var criteria = {};
                    if (message && message.content.criteria) {
                      criteria = message.content.criteria;
                    }

                    var fields = ['name', '_id'];
                    if (message && message.content.fields) {
                      fields = message.content.fields;
                    }

                    var cursor = collection.find(criteria, fields);

                    // Were any options set?
                    if (message && message.content.options) {

                      if (message.content.options.sort) {
                        cursor = cursor.sort(message.content.options.sort);
                      }
 
                      if(message.content.options.skip) {
                        cursor = cursor.skip(message.content.options.skip);
                      }

                      if(message.content.options.limit) {
                        cursor = cursor.limit(message.content.options.limit);
                      }
                    }

                    cursor.toArray(
                        function(err, docs) {
                            if (err) {
                              deferred.reject(err);
                            }
                            else {
                              deferred.resolve(docs);
                            }
                            _db.close();
                          });
                }).
              catch(function(err) {
                      deferred.reject(err);
                      _db.close();
                });
        }
        else {
          deferred.reject('You are not allowed access to that resource');
        }
        return deferred.promise;
      };
    exports.ls = _ls;
    
    /**
     * Create a new database
     *
     * @param string
     * @param Object - The user's public profile
     *
     * @return promise
     */
    var _createDatabase = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.execute) {
          _dbExists(verified).
                  then(function() {
                      deferred.reject();
                      _db.close();
                    }).
                  catch(function() {
                          var server = new mongo.Server(config.mongo.host,
                                           config.mongo.port,
                                           config.mongo.serverOptions);
                          var db = new mongo.Db(
  				verified.dbName, server, config.mongo.clientOptions);
  
                          db.open(function (err, client) {
                              if (err) {
                                deferred.reject(err);
                              }
                              else {
                                var collection = new mongo.Collection(client, 'profile');
                                collection.save(message.content.profile.toObject(), { safe: true },
                                        function(err, ack) {
                                            if (err) {
                                              deferred.reject(err);
                                            }
                                            else {
                                              deferred.resolve(ack);
                                            }
                                            db.close();
                                          });
                              }
                            });
                        });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }

        return deferred.promise;
      };
    exports.createDatabase = _createDatabase;

    /**
     * Drop a database
     * 
     * @param Object
     *
     * @return promise
     */
    var _dropDatabase = function(verified) {
        var deferred = q.defer();

        if (verified.admin || verified.execute) {
        _dbExists(verified).
                then(function() {
                    var server = new mongo.Server(config.mongo.host,
                                     config.mongo.port,
                                     config.mongo.serverOptions);
                    var db = new mongo.Db(verified.dbName, server, config.mongo.clientOptions);

                    db.open(function (err) {
                        if (err) {
                          deferred.reject(err);
                          _db.close();
                        }
                        else {
                          db.dropDatabase(function(err) {
                              if (err) {
                                deferred.reject(new Error('Database: ' +
                                                dbName + ' was not dropped'));
                              }
                              else {
                                deferred.resolve();
                              }
                              _db.close();
                            });
                        }
                      });
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
    exports.dropDatabase = _dropDatabase;

    /**
     * This adds a new agent for this gebo to represent
     *
     * @param Object
     * @param Object
     */
    var _registerAgent = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.execute) {
          var db = new geboSchema(dbName);

          db.registrantModel.findOne({ email: message.content.newAgent.email }, function(err, registrant) {
              if (registrant) {
                deferred.reject('That email address has already been registered');
              }
              else {
                var agent = new db.registrantModel(message.content.newAgent);
                agent.save(function(err, agent) {
                    if (err) {
                      deferred.reject(err);
                    }
                    else {
                      deferred.resolve(agent);
                    }
                  });
              }
            });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise; 
      };
    exports.registerAgent = _registerAgent;

    /**
     * Remove an agent from the gebo agent's database
     *
     * @param Object
     * @param Object
     */
    var _deregisterAgent = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.execute) {
          var db = new geboSchema(dbName);
          db.registrantModel.remove({ email: message.content.email }, function(err, ack) {
                  if (err) {
                    deferred.reject(err);
                  }
                  else {
                    deferred.resolve(ack);
                  }
                });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise; 
      };
    exports.deregisterAgent = _deregisterAgent;

    /**
     * This adds a new friend to the registrant's
     * database
     *
     * @param Object
     * @param Object
     */
    var _friend = function(verified, message) {
        var deferred = q.defer();

        if (verified.admin || verified.write) {
          var db = new agentSchema(verified.dbName);
          db.friendModel.findOneAndUpdate(
                          { email: message.content.email }, message.content, { upsert: true },
                          function(err, friend) {
                                  db.connection.db.close();
                                  if (err) {
                                    deferred.reject(err);
                                  }
                                  else {
                                    deferred.resolve(friend);
                                  }
                            });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise; 
      };
    exports.friend = _friend;

    /**
     * Remove a friend from this registrant's database
     *
     * @param Object
     * @param Object
     */
    var _defriend = function(verified, message) {
        var deferred = q.defer();

        if (verified.write) {
          var db = new agentSchema(verified.dbName);
          db.friendModel.remove({ email: message.content.email }, function(err, ack) {
                  db.connection.db.close();
                  if (err) {
                    deferred.reject(err);
                  }
                  else {
                    deferred.resolve(ack);
                  }
                });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
        return deferred.promise; 
      };
    exports.defriend = _defriend;

    /**
     * Change the access level to the requested
     * resource
     *
     * @param Object
     * @param Object
     *
     * @return promise
     */
    exports.grantAccess = function(verified, message) {
        var deferred = q.defer();
        if (verified.admin || verified.write) {
          var db = new agentSchema(verified.dbName);
          db.friendModel.findOne({ email: message.content.friend }, function(err, friend) {
                  if (err) {
                    deferred.reject(err);
                  }
                  else {
                    var index = utils.getIndexOfObject(friend.hisPermissions, 'email', message.content.permission.email);
                    if (index > -1) {
                      friend.hisPermissions.splice(index, 1);
                    }

                    friend.hisPermissions.push({
                            email: message.content.permission.email,
                            read: message.content.permission.read,
                            write: message.content.permission.write,
                            execute: message.content.permission.execute,
                        });

                    friend.save(function(err, savedFriend) {
                            db.connection.db.close();
                            if (err) {
                              deferred.reject(err);
                            }
                            else {
                              deferred.resolve(savedFriend);
                            }
                      });
                  }
            });
        }
        else {
          deferred.reject('You are not permitted to request or propose that action');
        }
 
        return deferred.promise;
      };

    /**
     * certificate
     */
    exports.certificate = function(verified, message) {
        var deferred = q.defer();
        if (verified.admin || verified.write) {
          utils.getPrivateKeyAndCertificate().
            then(function(pair) {
                var data = {
                        public: pair.certificate,
                        private: pair.privateKey,
                        email: message.content.email
                    };

                var db = new agentSchema(verified.dbName);
                db.keyModel.findOneAndUpdate({ email: message.content.email }, data, { upsert: true },
                    function(err, key) {
                        db.connection.db.close();
                        if (err) {
                          deferred.reject(err);
                        }
                        else {
                          _friend(verified, message).
                                then(function(friend) {
                                    deferred.resolve(key.public);
                                  }).
                                catch(function(err) {
                                    deferred.reject(err);
                                  });
                        }
                      });
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

    return exports;
  };

