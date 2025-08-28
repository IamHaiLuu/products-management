import Product from '../../models/product.model.js';
import ProductCategory from '../../models/product-category.model.js';
import User from '../../models/user.model.js';
import Comment from '../../models/comment.model.js';

import { priceNew, priceNewProduct } from '../../helpers/product.js';
import { getSubCategory } from '../../helpers/products-category.js';
import paginationHelper from "../../helpers/pagination.js";
import { calculateAverageRating, getRatingDistribution } from "../../helpers/rating.js";

// [GET] /products
export async function index(req, res) {
    try {
        const find = {
            status: 'active',
            deleted: false
        }

        // Phân trang 
        const countProducts = await Product.countDocuments(find)

        let objectPangination = paginationHelper(
            {
                currentPage: 1,
                limitItems: 12
            },
            req.query,
            countProducts
        )

        const products = await Product.find(find)
            .limit(objectPangination.limitItems)
            .skip(objectPangination.skip)
            .sort({ position: "desc" })

        const newProducts = priceNew(products)

        res.render('client/pages/products/index', {
            title: 'Trang sản phẩm',
            products: newProducts,
            pagination: objectPangination
        })
    } catch (error) {
        console.error('Error in products index:', error);
        res.status(500).render('client/pages/error/500', {
            title: 'Lỗi server'
        });
    }
}

// [GET] /products/:slug
export async function detail(req, res) {
    try {
        const productSlug = req.params.slugProduct;
        
        const find = {
            deleted: false,
            slug: productSlug,
            status: 'active'
        }
        const product = await Product.findOne(find);
        
        if (!product) {
            return res.render('client/pages/error/404', {
                title: 'Sản phẩm không tồn tại'
            });
        }

        // Lấy category info
        if (product.product_category_id) {
            const category = await ProductCategory.findOne({
                deleted: false,
                _id: product.product_category_id,
                status: 'active'
            });
            product.category = category;
        }

        product.priceNew = priceNewProduct(product);

        // Lấy comments
        const comments = await Comment.find({
            product_id: product._id,
            deleted: false,
            status: 'active'
        }).sort({ createdAt: -1 });

        const commentTree = [];
        const commentMap = new Map();

        // Lấy thông tin user cho từng comment
        for (const comment of comments) {
            const user = await User.findOne({ 
                _id: comment.user_id,
                status: 'active',
                deleted: false 
            });
            if (user) {
                comment.user = user;
            }
            
            commentMap.set(comment._id.toString(), comment);
            
            if (!comment.parent_id) {
                comment.replies = [];
                commentTree.push(comment);
            }
        }

        // Xây dựng cây comment
        for (const comment of comments) {
            if (comment.parent_id && commentMap.has(comment.parent_id)) {
                const parentComment = commentMap.get(comment.parent_id);
                if (!parentComment.replies) {
                    parentComment.replies = [];
                }
                parentComment.replies.push(comment);
            }
        }

        // Tính rating
        const ratingInfo = await calculateAverageRating(product._id);
        const ratingDistribution = await getRatingDistribution(product._id);
        
        product.averageRating = ratingInfo.averageRating;
        product.totalReviews = ratingInfo.totalReviews;
        product.ratingDistribution = ratingDistribution;

        res.render('client/pages/products/detail', {
            title: 'Chi tiết sản phẩm',
            product: product,
            comments: commentTree
        });
    } catch (error) {
        console.error('Error in product detail:', error);
        res.redirect(`/products`);
    }
}

// [GET] /products/:slugCategory
export async function category(req, res) {
    try {
        const categorySlug = req.params.slugCategory;
        
        const category = await ProductCategory.findOne({
            deleted: false,
            slug: categorySlug,
            status: 'active'
        });

        if (!category) {
            return res.render('client/pages/error/404', {
                title: 'Danh mục không tồn tại'
            });
        }

        const listCategorie = await getSubCategory(category.id);
        const listCategorieId = listCategorie.map(item => item.id);

        const find = {
            deleted: false,
            status: 'active',
            product_category_id: { $in: [category.id, ...listCategorieId] }
        }

        // Phân trang 
        const countProducts = await Product.countDocuments(find);

        let objectPangination = paginationHelper(
            {
                currentPage: 1,
                limitItems: 8
            },
            req.query,
            countProducts
        );

        const products = await Product.find(find)
            .limit(objectPangination.limitItems)
            .skip(objectPangination.skip)
            .sort({ position: "desc" });

        const newProducts = priceNew(products);

        res.render('client/pages/products/index', {
            title: category.title,
            products: newProducts,
            pagination: objectPangination
        });
    } catch (error) {
        console.error('Error in category products:', error);
        res.status(500).render('client/pages/error/500', {
            title: 'Lỗi server'
        });
    }
}

// [POST] /products/comment/add
export async function addComment(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập để bình luận!');
            return res.redirect('back');
        }

        const { product_id, content, rating } = req.body;

        if (!content || !product_id) {
            req.flash('error', 'Vui lòng nhập đầy đủ thông tin!');
            return res.redirect('back');
        }

        if (rating && (rating < 1 || rating > 5)) {
            req.flash('error', 'Đánh giá phải từ 1 đến 5 sao!');
            return res.redirect('back');
        }

        const product = await Product.findOne({
            _id: product_id,
            deleted: false,
            status: "active"
        });

        if (!product) {
            req.flash('error', 'Sản phẩm không tồn tại!');
            return res.redirect('back');
        }

        const comment = new Comment({
            content: content,
            user_id: res.locals.user.id,
            product_id: product_id,
            rating: rating ? parseInt(rating) : null,
            status: "active"
        });

        await comment.save();

        req.flash('success', 'Bình luận của bạn đã được gửi thành công!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    }
}

// [PATCH] /products/comment/edit/:commentId
export async function editComment(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập!');
            return res.redirect('back');
        }

        const { commentId } = req.params;
        const { content, rating } = req.body;

        if (!content) {
            req.flash('error', 'Vui lòng nhập nội dung bình luận!');
            return res.redirect('back');
        }

        if (rating && (rating < 1 || rating > 5)) {
            req.flash('error', 'Đánh giá phải từ 1 đến 5 sao!');
            return res.redirect('back');
        }

        const comment = await Comment.findOne({
            _id: commentId,
            user_id: res.locals.user.id,
            deleted: false
        });

        if (!comment) {
            req.flash('error', 'Bình luận không tồn tại hoặc bạn không có quyền sửa!');
            return res.redirect('back');
        }

        await Comment.updateOne(
            { _id: commentId },
            { 
                content: content,
                rating: rating ? parseInt(rating) : null
            }
        );

        req.flash('success', 'Cập nhật bình luận thành công!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    }
}

// [DELETE] /products/comment/delete/:commentId
export async function deleteComment(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập!');
            return res.redirect('back');
        }

        const { commentId } = req.params;

        const comment = await Comment.findOne({
            _id: commentId,
            user_id: res.locals.user.id,
            deleted: false
        });

        if (!comment) {
            req.flash('error', 'Bình luận không tồn tại hoặc bạn không có quyền xóa!');
            return res.redirect('back');
        }

        await Comment.updateOne(
            { _id: commentId },
            { 
                deleted: true,
                deletedBy: {
                    account_id: res.locals.user.id,
                    deleteAt: new Date()
                }
            }
        );

        req.flash('success', 'Xóa bình luận thành công!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        const backURL = req.get("Referrer") || "/";
        res.redirect(backURL);
    }
}