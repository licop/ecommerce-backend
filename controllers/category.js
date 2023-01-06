const Category = require("../models/category")
const Product = require("../models/product")
const { errorHandler } = require("../helpers/dbErrorHandler")

// 根据id获取分类
const categoryById = (req, res, next, id) => {
  Category.findById(id).exec((err, category) => {
    if (err || !category) return res.status(400).json({ error: "分类不存在" })
    req.category = category
    next()
  })
}

// 创建分类 
const create = (req, res) => {
  const category = new Category(req.body)
  category.save((error, data) => {
    if (error) {
      return res.status(400).json({
        error: errorHandler(error)
      })
    }
    res.json(data)
  })
}

// 读取分类
const read = (req, res) => {
  return res.json(req.category)
}

// 更新分类
const update = (req, res) => {
  const category = req.category
  category.name = req.body.name
  category.save((err, data) => {
    if (err) return res.status(400).json({ error: errorHandler(err) })
    res.json(data)
  })
}

// 删除分类
const remove = (req, res) => {
  const category = req.category
  Product.find({ category }).exec((err, data) => {
    if (data.length >= 1) {
      return res.status(400).json({
        message: `抱歉. 不能删除 ${category.name} 分类. 此分类中还有 ${data.length} 条相关产品`
      })
    } else {
      category.remove((error, data) => {
        if (error) return res.status(400).json({ error: errorHandler(error) })
        res.json({ message: "分类删除成功" })
      })
    }
  })
}
// 返回所有分类
const list = (req, res) => {
  Category.find().exec((err, data) => {
    if (err) return res.status(400).json({ error: errorHandler(err) })
    res.json(data)
  })
}

module.exports = { create, categoryById, read, update, remove, list }
