const formidable = require("formidable")
const _ = require("lodash")
const fs = require("fs")
const Product = require("../models/product")
const { Order } = require("../models/order")
const { errorHandler } = require("../helpers/dbErrorHandler")

// 新增产品
const create = (req, res) => {
  // 创建上传表单对象
  // formidable用于解析表单数据的 Node.js 模块，尤其是文件上传
  // https://github.com/node-formidable/formidable
  let form = new formidable.IncomingForm()
  // 保留原有文件后缀
  form.keepExtensions = true
  // 解析上传表单对象
  form.parse(req, (err, fields, files) => {
    // 上传失败
    if (err) return res.status(400).json({ error: "图片上传失败" })
    // 获取产品字段
    const { name, description, price, category, quantity, shipping } = fields
    // 如果某一个字段值不存在
    if (
      !name ||
      !description ||
      !price ||
      !category ||
      !quantity ||
      !shipping
    ) {
      // 响应
      return res.status(400).json({ error: "所有字段都是必填的" })
    }

    // 创建产品
    let product = new Product(fields)

    // 1kb = 1000
    // 1mb = 1000000

    // 如果上传了图像
    if (files.photo) {
      // 如果图像大小超过了 1mb
      if (files.photo.size > 1000000) {
        // 响应
        return res.status(400).json({ error: "图片大于了1mb" })
      }
      product.photo.data = fs.readFileSync(files.photo.path)
      product.photo.contentType = files.photo.type
    }
    // 将产品插入数据库
    product.save((err, result) => {
      // 如果插入失败
      if (err) {
        // 响应错误
        return res.status(400).json({ error: errorHandler(err) })
      }
      // 响应产品
      res.json(result)
    })
  })
}

// 通过id获取product，将product存储到req中，在接下来的中间件使用
const productById = (req, res, next, id) => {
  Product.findById(id)
    .populate("category")
    .exec((err, product) => {
      if (err || !product)
        return res.status(400).json({ error: "产品未找到" })
      req.product = product
      next()
    })
}

// 根据id读取产品，排除photo属性
const read = (req, res) => {
  req.product.photo = undefined
  return res.json(req.product)
}
// 删除商品
const remove = (req, res) => {
  let product = req.product
  product.remove((err, deletedProduct) => {
    if (err) return res.status(400).json({ error: errorHandler(err) })
    res.json({
      deletedProduct,
      message: "产品删除成功"
    })
  })
}
// 更新商品
const update = (req, res) => {
  let form = new formidable.IncomingForm()
  form.keepExtensions = true
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(400).json({ error: "图片上传失败" })
    let product = req.product
    product = _.extend(product, fields)

    if (files.photo) {
      if (files.photo.size > 1000000) {
        return res.status(400).json({ error: "图片大小不能超过1mb" })
      }
      product.photo.data = fs.readFileSync(files.photo.path)
      product.photo.contentType = files.photo.type
    }

    product.save((error, result) => {
      if (error) {
        return res.status(400).json({ error: errorHandler(error) })
      }
      res.json(result)
    })
  })
}

/**
 * 获取商品列表, 可以通过销量和发布时间进行排序
 * 通过销量 => /products?sortBy=sold&order=desc&limit=4
 * 通过发布时间 = > /products?sortBy=createdAt&order=desc&limit=4
 * 如果没有传递任何参数, 返回所有商品
 * asc 升序 desc 降序
 */

const list = (req, res) => {
  let order = req.query.order ? req.query.order : "asc"
  let sortBy = req.query.sortBy ? req.query.sortBy : "_id"
  let limit = req.query.limit ? parseInt(req.query.limit) : 6
  let allowOrderValue = ["desc", "asc"]

  if (!allowOrderValue.includes(order))
    return res.status(400).json({ error: "请检查升降序参数" })
  
  Product.find()
    // 排除图片数据，通过单独连接获取
    .select("-photo")
    .populate("category")
    .sort([[sortBy, order]])
    .limit(limit)
    .exec((error, products) => {
      if (error) return res.status(400).json({ error: "商品没有找到" })
      res.json(products)
    })
}

/**
 * 根据产品 id 获取相关产品列表
 * 相同分类下的产品将会被返回
 */

const listRelated = (req, res) => {
  let limit = req.query.limit ? parseInt(req.query.limit) : 6
  // $ne为查询运算符 匹配所有不等于指定值的值 https://docs.mongoing.com/can-kao/yun-suan-fu/query-and-projection-operators
  // 查找相同category分类下其他产品
  Product.find({ _id: { $ne: req.product }, category: req.product.category })
    .select('-photo')
    .limit(limit)
    .populate("category", "_id name")
    .exec((error, products) => {
      if (error) return res.status(400).json({ error: "没有相关产品" })
      res.json(products)
    })
}

// 获取产品用到的分类集合
const listCategories = (req, res) => {
  // 获取集合中指定字段的不重复值，并以数组的形式返回
  // db.collection_name.distinct(field,query,options)
  Product.distinct("category", {}, (err, categories) => {
    if (err) res.status(400).json({ error: "没找到分类" })
    res.json(categories)
  })
}

// 商品列表筛选
const listByFilter = (req, res) => {
  let order = req.body.order ? req.body.order : "desc"
  let sortBy = req.body.sortBy ? req.body.sortBy : "_id"
  let limit = req.body.limit ? parseInt(req.body.limit) : 4
  let skip = parseInt(req.body.skip)
  let findArgs = {}
  let allowOrderValue = ["desc", "asc"]

  if (!allowOrderValue.includes(order))
    return res.status(400).json({ error: "请检查升降序参数" })

  for (let key in req.body.filters) {
    if (req.body.filters[key].length > 0) {
      if (key === "price") {
        findArgs[key] = {
          // 判断价格区间
          $gte: req.body.filters[key][0],
          $lte: req.body.filters[key][1]
        }
      } else {
        findArgs[key] = req.body.filters[key]
      }
    }
  }

  Product.find(findArgs)
    .select("-photo")
    .populate("category")
    .sort([[sortBy, order]])
    .skip(skip)
    .limit(limit)
    .exec((err, data) => {
      if (err) return res.status(400).json({ error: "暂无商品" })
      res.json({ size: data.length, data })
    })
}

// 获取封面，直接返回图片
const photo = (req, res, next) => {
  if (req.product.photo.data) {
    res.set("Content-Type", req.product.photo.contentType)
    return res.send(req.product.photo.data)
  }
  next()
}

// 通过name和category搜索产品
const listSearch = (req, res) => {
  const query = {}
  if (req.query.search) {
    // ​选择值与指定的正则表达式匹配的文档, $options: "i"表示不区分大小写 。
    // https://www.mongodb.com/docs/manual/reference/operator/query/regex/
    query.name = { $regex: req.query.search, $options: "i" }
    if (req.query.category && req.query.category != "All") {
      query.category = req.query.category
    }
    Product.find(query, (err, products) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err)
        })
      }
      res.json(products)
    }).select("-photo")
  }
}

const decreaseQuantity = orderId => {
  Order.findOne({ _id: orderId })
    .populate("products.product")
    .then(order => {
      let bulkOps = order.products.map(item => {
        return {
          updateOne: {
            filter: { _id: item.product._id },
            update: {
              // $inc 字段更新运算符, 将字段的值增加指定的数量。
              $inc: {
                // 库存减少，销量增加
                quantity: -item.count,
                sold: +item.count
              }
            }
          }
        }
      })
      // bulkWrite为批量写入操作，将Order内的product数值变化，写入Product
      Product.bulkWrite(bulkOps, {}, error => {
        if (error) console.log("商品数量更新失败", error)
      })
    })
}

module.exports = {
  create,
  productById,
  read,
  remove,
  update,
  list,
  listRelated,
  listCategories,
  listByFilter,
  photo,
  listSearch,
  decreaseQuantity
}
