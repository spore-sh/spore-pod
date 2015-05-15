var mongoose = require('mongoose'),
    validate = require('mongoose-validate'),
    bcrypt = require('bcryptjs'),
    uuid = require('node-uuid').v4,
    App = require('./app'),
    Permission = require('./permission');

var userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [validate.email, "Invalid email address."]
  },
  password: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true
  },
  publicKey: {
    type: String
  }
});

userSchema.virtual('keys')
  .get(function () {
    return [this.get('key')];
  });

userSchema.statics.create = function (email, password, callback) {
  var user;

  user = new User({
    email: email
  });

  user.password = user.generateHash(password);

  // we throw this key away right now - they need to
  // hit the keys endpoint to retrieve it
  user.generateKey();

  user.save(function(err) {
    if (err) {
      if(err.name === 'ValidationError' && err.errors) {
        // do something here?
      } else if(err.code === 11000 && err.errmsg && err.errmsg.indexOf('email_1') > -1) {
        err = new Error("Account with that email already exists");
        err.status = 400;
      }
      return next(err);
    }

    callback(null, user);
  });
};

userSchema.statics.forEnv = function (appId, envName, callback) {
  Permission.find({
    app: appId,
    environment: envName
  })
  .populate('user')
  .exec(function (err, perms) {
    if(err) return callback(err);

    callback(null, perms.map(function (perm) {
      return perm.user;
    }));
  });
};

userSchema.statics.byEmail = function (email, callback) {
  User.findOne({
    email: email
  }).exec(callback);
};

userSchema.methods.generateKey = function () {
  var key = uuid();
  this.key = this.generateHash(key);

  return key;
};

userSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.methods.validKey = function (key) {
  return bcrypt.compareSync(key, this.key);
};

var User = mongoose.model('User', userSchema);

module.exports = User;
