var mongoose = require('mongoose'),
    bcrypt = require('bcrypt'),
    Permission = require('./permission');

var inviteSchema = new mongoose.Schema({
  app: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'App',
    required: true
  },
  environment: String,
  email: {
    type: String
  },
  token: {
    type: String,
    required: true
  },
  tokenId: {
    type: String,
    required: true,
    unique: true
  }
});

inviteSchema.virtual('status')
  .get(function () {
    return 'pending';
  });

inviteSchema.statics.forEnv = function (appId, envName, callback) {
  Invite.find({
    app: appId,
    environment: envName
  })
  .exec(function (err, invites) {
    if(err) return callback(err);

    callback(null, invites);
  });
};

inviteSchema.statics.create = function (email, appId, envName, callback) {
  var Invite = this,
      invite,
      token;

  invite = new Invite({
    app: appId,
    environment: envName
  });

  token = invite.generateToken();

  invite.save(function (err) {
    if(err) return callback(err);

    callback(null, token, invite);
  });
};

inviteSchema.statics.findByToken = function (token, callback) {
  var Invite = this;

  if(token.length !== 10) {
    return callback(new Error("Invalid invite"));
  }

  Invite.findOne({
    tokenId: splitToken(token).id
  }).exec(function (err, invite) {
    if(err) return callback(err);
    if(!invite || !invite.validToken(splitToken(token).key)) return callback(new Error("Invalid invite"));

    callback(null, invite);
  });
};

inviteSchema.statics.redeemToken = function (user, token, callback) {
  var Invite = this;

  Invite.findByToken(token, function (err, invite) {
    if(err) return callback(err);

    user.verifyEmail(email, function (err, user) {
      Permission.ensureForEnv(user._id, invite.app, invite.environment, function (err) {
        if(err) return callback(err);

        invite.remove(callback);
      });
    });
  });
};

inviteSchema.methods.generateToken = function () {
  var token = randomStr(10);

  this.token = this.generateHash(splitToken(token).key);
  this.tokenId = splitToken(token).id;

  return token;
};

inviteSchema.methods.generateHash = function(str) {
  return bcrypt.hashSync(str, 8);
};

inviteSchema.methods.validToken = function (token) {
  return this.token && bcrypt.compareSync(token, this.token);
};

function splitToken(token) {
  return {
    id: token.substr(0, 5),
    key: token.slice(5)
  };
}

var Invite = mongoose.model('Invite', inviteSchema);

module.exports = Invite;