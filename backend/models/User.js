const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email']
      }
    ]
  });

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    return values;
  };

  // Class methods
  User.hashPassword = async function(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  };

  User.findByEmail = async function(email) {
    return await this.findOne({
      where: { email: email.toLowerCase() }
    });
  };

  // Hooks
  User.beforeCreate(async (user) => {
    user.email = user.email.toLowerCase();
    if (user.password_hash) {
      user.password_hash = await User.hashPassword(user.password_hash);
    }
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('email')) {
      user.email = user.email.toLowerCase();
    }
    if (user.changed('password_hash')) {
      user.password_hash = await User.hashPassword(user.password_hash);
    }
  });

  return User;
}; 