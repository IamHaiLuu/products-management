import Product from '../../models/product.model.js';
import ProductCategory from '../../models/product-category.model.js';
import Account from '../../models/account.model.js';
import Comment from '../../models/comment.model.js';
import User from '../../models/user.model.js';

import { prefixAdmin } from "../../config/system.js";

import filterStatusHelper from "../../helpers/filterStatus.js";
import searchHelper from "../../helpers/search.js";
import { searchProducts } from "../../helpers/fuzzySearch.js";
import paginationHelper from "../../helpers/pagination.js";
import { createTree } from "../../helpers/createTree.js";
import cloudinaryHelper from "../../helpers/uploadToCloudinary.js";

const { deleteFromCloudinary } = cloudinaryHelper;

// [GET] /admin/products
export async function index(req, res) {
    // Bộ lọc 
    const filterStatus = filterStatusHelper(req.query)

    let find = {
        deleted: false
    }

    if (req.query.status) {
        find.status = req.query.status
    }
    //

    //

    // Sort
    let sort = {}

    if (req.query.sortKey && req.query.sortValue) {
        sort[req.query.sortKey] = req.query.sortValue
    } else {
        sort["position"] = "desc"
    }
    //

    // Tìm kiếm
    const objectSearch = searchHelper(req.query)
    let products = []

    if (objectSearch.keyword) {
        // Sử dụng tìm kiếm mờ với Fuse.js
        const allProducts = await Product.find({
            deleted: false,
            ...(req.query.status && { status: req.query.status })
        }).sort(sort)

        const fuzzyResult = searchProducts(allProducts, objectSearch.keyword)
        products = fuzzyResult.results

        // Cập nhật pagination cho kết quả tìm kiếm mờ
        const countProducts = fuzzyResult.totalFound
        let objectPangination = paginationHelper(
            {
                currentPage: 1,
                limitItems: 6
            },
            req.query,
            countProducts
        )

        // Apply pagination to fuzzy search results
        const startIndex = objectPangination.skip
        const endIndex = startIndex + objectPangination.limitItems
        products = products.slice(startIndex, endIndex)

        // Lấy danh sách tài khoản tạo sản phẩm
        for (const product of products) {
            const user = await Account.findOne({ _id: product.createBy.account_id })
            if (user) {
                product.accountFullName = user.fullName
            }

            // Lấy danh sách tài khoản cập nhật sản phẩm
            const updatedBy = product.updatedBy[product.updatedBy.length - 1]
            if(updatedBy) {
                const userUpdated = await Account.findOne({ 
                    _id: updatedBy.account_id 
                })
                updatedBy.updatedFullName = userUpdated.fullName
            }
        }

        res.render('admin/pages/product/index', {
            title: 'Trang sản phẩm',
            products: products,
            filterStatus: filterStatus,
            keyword: objectSearch.keyword,
            pagination: objectPangination,
            searchType: 'fuzzy',
            totalFound: fuzzyResult.totalFound
        });
    } else {
        // Tìm kiếm truyền thống khi không có từ khóa
        if (objectSearch.regex) {
            find.title = objectSearch.regex
        }

        // Phân trang 
        const countProducts = await Product.countDocuments(find)

        let objectPangination = paginationHelper(
            {
                currentPage: 1,
                limitItems: 6
            },
            req.query,
            countProducts
        )

        products = await Product.find(find).limit(objectPangination.limitItems).skip(objectPangination.skip).sort(sort)

        // Lấy danh sách tài khoản tạo sản phẩm
        for (const product of products) {
            const user = await Account.findOne({ _id: product.createBy.account_id })
            if (user) {
                product.accountFullName = user.fullName
            }

            // Lấy danh sách tài khoản cập nhật sản phẩm
            const updatedBy = product.updatedBy[product.updatedBy.length - 1]
            if(updatedBy) {
                const userUpdated = await Account.findOne({ 
                    _id: updatedBy.account_id 
                })
                updatedBy.updatedFullName = userUpdated.fullName
            }
        }

        res.render('admin/pages/product/index', {
            title: 'Trang sản phẩm',
            products: products,
            filterStatus: filterStatus,
            keyword: objectSearch.keyword,
            pagination: objectPangination
        });
    }
}

// [PATCH] /admin/products/change-status/:status/:id
export async function changeStatus(req, res) {
    const permissions = res.locals.role.permissions
    if(!permissions.includes("products_edit")) {
        req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
        return res.redirect(`${prefixAdmin}/products`);
    }

    const update = {
        account_id: res.locals.user.id,
        updateAt: new Date()
    }

    const status = req.params.status
    const id = req.params.id

    const product = await Product.findById(id);
    
    await Product.updateOne({ _id: id }, { status: status, $push: { updatedBy: update } })

    req.flash('success', 'Cập nhật trạng thái thành công!');

    // res.location("back")
    const backURL = req.get("Referrer") || "/";
    res.redirect(backURL);
}

// [PATCH] /admin/products/change-multi
export async function changeMulti(req, res) {
    const type = req.body.type
    const ids = req.body.ids.split(", ")

    const update = {
        account_id: res.locals.user.id,
        updateAt: new Date()
    }

    switch (type) {
        case "active":
            const permissions = res.locals.role.permissions
            if (!permissions.includes("products_edit")) {
                req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
                return res.redirect(`${prefixAdmin}/products`);
            }

            await Product.updateMany({ _id: { $in: ids } }, {
                status: "active",
                $push: { updatedBy: update }
            })
            
            
            req.flash('success', `Cập nhật trạng thái của ${ids.length} sản phẩm thành công!`);
            break

        case "inactive":
            const permissionsInactive = res.locals.role.permissions
            if (!permissionsInactive.includes("products_edit")) {
                req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
                return res.redirect(`${prefixAdmin}/products`);
            }

            await Product.updateMany({ _id: { $in: ids } }, {
                status: "inactive",
                $push: { updatedBy: update }
            })
            
            
            req.flash('success', `Cập nhật trạng thái của ${ids.length} sản phẩm thành công!`);
            break

        case "delete-all":
            const permissionsDelete = res.locals.role.permissions
            if (!permissionsDelete.includes("products_delete")) {
                req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
                return res.redirect(`${prefixAdmin}/products`);
            }

            await Product.updateMany(
                { _id: { $in: ids } },
                {
                    deleted: true,
                    deletedBy: {
                        account_id: res.locals.user.id,
                        deleteAt: new Date()
                    }
                }
            )
            
            
            req.flash('success', `Đã xóa thành công ${ids.length} sản phẩm thành công!`);
            break

        case "change-position":
            const permissionsPosition = res.locals.role.permissions
            if (!permissionsPosition.includes("products_edit")) {
                req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
                return res.redirect(`${prefixAdmin}/products`);
            }

            for (const item of ids) {
                let [id, position] = item.split("-")
                position = parseInt(position)

                await Product.updateOne({ _id: id }, {
                    position: position,
                    $push: { updatedBy: update }
                })
            }
            req.flash('success', `Cập nhật trạng thái của ${ids.length} sản phẩm thành công!`);
            break

        default:
            break
    }

    const backURL = req.get("Referrer") || "/";
    res.redirect(backURL);

}

// [DELETE] /admin/products/change-status/:status/:id
export async function deleteItem(req, res) {
    const permissions = res.locals.role.permissions
    if (!permissions.includes("products_delete")) {
        req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
        return
    }

    const id = req.params.id

    try {
        await Product.updateOne(
            { _id: id },
            {
                deleted: true,
                deletedBy: {
                    account_id: res.locals.user.id,
                    deleteAt: new Date()
                }
            }
        )

        req.flash('success', 'Cập nhật trạng thái thành công!');
    } catch (error) {
        console.log(error);
        req.flash('error', 'Xóa thất bại!');
    }

    const backURL = req.get("Referrer") || "/";
    res.redirect(backURL);
}

// [GET] /admin/products/create
export async function create(req, res) {

    let find = {
        deleted: false
    }

    const category = await ProductCategory.find(find)
    const newCategory = createTree(category)

    res.render('admin/pages/product/create', {
        title: 'Trang tạo sản phẩm',
        category: newCategory
    })
}

// [POST] /admin/products/create
export async function createPost(req, res) {
    const permissions = res.locals.role.permissions
    if (!permissions.includes("products_create")) {
        req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
        return
    }

    req.body.price = parseFloat(req.body.price)
    req.body.discountPercentage = parseFloat(req.body.discountPercentage)
    req.body.stock = parseInt(req.body.stock)

    if (req.body.position == "") {
        const countProducts = await Product.countDocuments()
        req.body.position = countProducts + 1
    } else {
        req.body.position = parseInt(req.body.position)
    }

    req.body.createBy = {
        account_id: res.locals.user.id
    }

    const product = new Product(req.body)
    await product.save()

    res.redirect(`${prefixAdmin}/products`);
}

// [GET] /admin/products/edit/:id
export async function edit(req, res) {
    try {
        const find = {
            deleted: false,
            _id: req.params.id
        }
        const product = await Product.findOne(find)


        let findCategory = {
            deleted: false
        }
        const category = await ProductCategory.find(findCategory)
        const newCategory = createTree(category)

        res.render('admin/pages/product/edit', {
            title: 'Trang sửa sản phẩm',
            product: product,
            category: newCategory
        });
    } catch (error) {
        res.redirect(`${prefixAdmin}/products`);
    }
}

// [PATCH] /admin/products/edit/:id
export async function editPATCH(req, res) {
    const permissions = res.locals.role.permissions
    if (!permissions.includes("products_edit")) {
        req.flash('error', 'Bạn không có quyền thực hiện chức năng này!');
        return
    }
    
    const id = req.params.id

    req.body.price = parseFloat(req.body.price)
    req.body.discountPercentage = parseFloat(req.body.discountPercentage)
    req.body.stock = parseInt(req.body.stock)
    req.body.position = parseInt(req.body.position)

    try {
        // Get the current product to access the public_id
        const currentProduct = await Product.findOne({ _id: id });

        // If a new file is being uploaded and there's an existing public_id, delete the old image
        if (req.body.public_id && currentProduct.public_id) {
            await deleteFromCloudinary(currentProduct.public_id);
        }

        const update = {
            account_id: res.locals.user.id,
            updateAt: new Date()
        }

        await Product.updateOne(
            { _id: id },
            {
                ...req.body,
                $push: {
                    updatedBy: update
                }
            }
        )
        req.flash('success', 'Cập nhật thành công!');
    } catch (error) {
        console.log(error)
        req.flash('error', 'Cập nhật thất bại!');
    }

    res.redirect(`${prefixAdmin}/products`)
}

export async function detail(req, res) {
    try {
        const find = {
            deleted: false,
            _id: req.params.id
        }
        const product = await Product.findOne(find)

        // Lấy tất cả comment của sản phẩm
        const comments = await Comment.find({
            product_id: req.params.id,
            deleted: false
        }).sort({ createdAt: -1 })

        // Lấy thông tin user cho mỗi comment
        for (const comment of comments) {
            const user = await User.findOne({ _id: comment.user_id })
            if (user) {
                comment.userInfo = user
            }
        }

        res.render('admin/pages/product/detail', {
            title: 'Chi tiết sản phẩm',
            product: product,
            comments: comments
        });
    } catch (error) {
        res.redirect(`${prefixAdmin}/products`);
    }
}
