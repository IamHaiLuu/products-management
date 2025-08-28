import Comment from '../../models/comment.model.js';
import Product from '../../models/product.model.js';

// [POST] /comments/create
export async function createPost(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập để bình luận!');
            return res.redirect('back');
        }

        const { content, product_id, parent_id, rating } = req.body;

        // Dữ liệu đã được validate và sanitize ở middleware
        // Chỉ cần validate business logic

        const product = await Product.findOne({
            _id: product_id,
            deleted: false,
            status: "active"
        });

        if (!product) {
            req.flash('error', 'Sản phẩm không tồn tại!');
            return res.redirect('back');
        }

        // Nếu có parent_id, kiểm tra comment cha có tồn tại
        if (parent_id) {
            const parentComment = await Comment.findOne({
                _id: parent_id,
                deleted: false,
                status: "active"
            });

            if (!parentComment) {
                req.flash('error', 'Bình luận cha không tồn tại!');
                return res.redirect('back');
            }
        }

        const comment = new Comment({
            content: content,
            user_id: res.locals.user.id,
            product_id: product_id,
            parent_id: parent_id || "",
            rating: rating,
            status: "active"
        });

        await comment.save();

        req.flash('success', 'Bình luận của bạn đã được gửi thành công!');
        res.redirect('back');
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        res.redirect('back');
    }
}

// [PATCH] /comments/edit/:id
export async function editPatch(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập!');
            return res.redirect('back');
        }

        const { content, rating } = req.body;
        const commentId = req.params.id;

        // Dữ liệu đã được validate và sanitize ở middleware
        
        const comment = await Comment.findOne({
            _id: commentId,
            user_id: res.locals.user.id,
            deleted: false
        });

        if (!comment) {
            req.flash('error', 'Bình luận không tồn tại hoặc bạn không có quyền sửa!');
            return res.redirect('back');
        }

        // Kiểm tra thời gian tạo comment (chỉ cho phép sửa trong 24h)
        const createdTime = new Date(comment.createdAt);
        const currentTime = new Date();
        const timeDiff = currentTime - createdTime;
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            req.flash('error', 'Chỉ có thể sửa bình luận trong vòng 24 giờ!');
            return res.redirect('back');
        }

        await Comment.updateOne(
            { _id: commentId },
            { 
                content: content,
                rating: rating,
                $push: {
                    updatedBy: {
                        account_id: res.locals.user.id,
                        updateAt: new Date()
                    }
                }
            }
        );

        req.flash('success', 'Cập nhật bình luận thành công!');
        res.redirect('back');
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        res.redirect('back');
    }
}

// [DELETE] /comments/delete/:id
export async function deleteItem(req, res) {
    try {
        if (!res.locals.user) {
            req.flash('error', 'Bạn cần đăng nhập!');
            return res.redirect('back');
        }

        const commentId = req.params.id;

        // ID đã được validate ở middleware

        const comment = await Comment.findOne({
            _id: commentId,
            user_id: res.locals.user.id,
            deleted: false
        });

        if (!comment) {
            req.flash('error', 'Bình luận không tồn tại hoặc bạn không có quyền xóa!');
            return res.redirect('back');
        }

        // Kiểm tra xem có comment con không
        const hasReplies = await Comment.findOne({
            parent_id: commentId,
            deleted: false
        });

        if (hasReplies) {
            req.flash('error', 'Không thể xóa bình luận đã có phản hồi!');
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
        res.redirect('back');
    } catch (error) {
        console.log(error);
        req.flash('error', 'Có lỗi xảy ra, vui lòng thử lại!');
        res.redirect('back');
    }
}
