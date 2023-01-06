const mongoose = require("mongoose")
const config = require("config")

// 使用config包，可以获取config文件夹下的值
// https://github.com/node-config/node-config
const { host, port, user, pass, name } = config.get("db_config")

// 连接数据库
// https://mongoosejs.com/docs/5.x/docs/connections.html
mongoose
  .connect(`mongodb://${host}:${port}/${name}`, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    user: user,
    pass: pass
  })
  .then(() => console.log("数据库连接成功"))
  .catch(() => console.log("数据库连接失败"))
