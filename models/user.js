const mongoose = require("mongoose")
const crypto = require("crypto")
const { v1: uuidv1 } = require("uuid")
const uniqueValidator = require("mongoose-unique-validator")

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [4, "昵称长度不能大于4"],
      required: [true, "请填写昵称"]
    },
    email: {
      type: String,
      trim: true,
      // 唯一索引确保索引字段不存储重复值
      unique: true,
      required: [true, "请填写邮件地址"]
    },
    hashed_password: {
      type: String,
      required: true
    },
    about: {
      type: String,
      trim: true
    },
    salt: String,
    role: {
      type: Number,
      default: 0
    },
    history: {
      type: Array,
      default: []
    }
  },
  // timestamps是设置Schema的option选项
  // 告诉 mongoose 将 createdAt 和 updatedAt 字段分配给您的Schema。分配的类型是日期
  // https://mongoosejs.com/docs/5.x/docs/guide.html#timestamps
  { timestamps: true }
)

// 添加虚拟属性 password, 可以设置、获取，但是不会持久保存到MongoDB
// https://mongoosejs.com/docs/5.x/docs/guide.html#virtuals
userSchema
  .virtual("password")
  .set(function (password) {
    this._password = password
    this.salt = uuidv1()
    this.hashed_password = this.encryptPassword(password)
  })
  .get(function () {
    return this._password
  })

// 添加和用户相关的实例方法，User的实例可以使用这些方法
// https://mongoosejs.com/docs/5.x/docs/guide.html#methods
userSchema.methods = {
  // 验证密码
  authenticate: function (plainText) {
    return this.encryptPassword(plainText) === this.hashed_password
  },
  // 密码加密
  encryptPassword: function (password) {
    if (!password) return ""
    try {
      return crypto.createHmac("sha1", this.salt).update(password).digest("hex")
    } catch (err) {
      return ""
    }
  }
}
// 用于验证唯一索引，当存储的值重复时，给出提示，如上述email
userSchema.plugin(uniqueValidator, { message: "{VALUE} 已经存在, 请更换" })

module.exports = mongoose.model("User", userSchema)
