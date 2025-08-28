import Chat from '../../models/chat.model.js'
import User from '../../models/user.model.js'
import RoomChat from '../../models/room-chat.model.js'
import { getUnreadCount, canPinMessage } from '../../helpers/message.js'

/**
 * Helper function to get unique rooms and cleanup duplicates
 */
async function getUniqueRoomsForUser(userId) {
    // Lấy danh sách phòng chat của user
    let rooms = await RoomChat.find({
        "users.user_id": userId,
        typeRoom: "friend",
        deleted: false
    }).sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo (mới nhất trước)

    // Loại bỏ duplicate rooms (rooms có cùng friend)
    const uniqueRooms = []
    const seenFriends = new Set()
    const duplicateRoomIds = []

    for(const room of rooms) {
        const friendInfo = room.users.find(user => user.user_id != userId)
        if(friendInfo && !seenFriends.has(friendInfo.user_id)) {
            seenFriends.add(friendInfo.user_id)
            const friend = await User.findById(friendInfo.user_id).select('fullName avatar')
            room.friend = friend
            uniqueRooms.push(room)
        } else if(friendInfo && seenFriends.has(friendInfo.user_id)) {
            // Đánh dấu room trùng lặp để xóa (giữ lại room mới nhất)
            duplicateRoomIds.push(room._id)
        }
    }

    // Xóa các room trùng lặp trong background
    if(duplicateRoomIds.length > 0) {
        RoomChat.updateMany(
            { _id: { $in: duplicateRoomIds } },
            { 
                deleted: true,
                deletedAt: new Date()
            }
        ).catch(err => {
            console.error('Error deleting duplicate rooms:', err)
        })
        
        console.log(`🧹 Đã xóa ${duplicateRoomIds.length} room trùng lặp cho user ${userId}`)
    }

    return uniqueRooms
}

// [GET] /chat
export async function index(req, res) {
    const userId = res.locals.user.id
    
    // Sử dụng helper function để lấy unique rooms và cleanup duplicates
    const uniqueRooms = await getUniqueRoomsForUser(userId)

    res.render('client/pages/chat/index', {
        title: 'Chat',
        rooms: uniqueRooms
    })
}

// [GET] /users/not-friend
export async function notFriend(req, res) {
    const userId = res.locals.user.id
    const myUser = await User.findOne({ _id: userId })

    const requestFriend = myUser.requestFriend
    const acceptFriend = myUser.acceptFriend
    const friendList = myUser.friendList.map(item => item.user_id)

    const users = await User.find({
        $and: [
            { _id: { $ne: userId } },
            { _id: { $nin: requestFriend } },
            { _id: { $nin: acceptFriend } },
            { _id: { $nin: friendList } }
        ],
        status: 'active',
        deleted: false
    }).select('fullName avatar')

    res.render('client/pages/chat/not-friend', {
        title: 'Danh sách người dùng',
        users: users
    })
}

// [GET] /users/request
export async function request(req, res) {
    const userId = res.locals.user.id
    const myUser = await User.findOne({ _id: userId })

    const requestFriend = myUser.requestFriend

    const users = await User.find({
        _id: { $in: requestFriend },
        status: 'active',
        deleted: false
    }).select('id fullName avatar')

    res.render('client/pages/chat/request', {
        title: 'Lời mời đã gửi',
        users: users
    })
}

// [GET] /users/accept
export async function accept(req, res) {
    try {
        const userId = res.locals.user.id
        const myUser = await User.findOne({ _id: userId })

        if (!myUser) {
            req.flash("error", "Người dùng không tồn tại!")
            return res.redirect("/chat")
        }

        const acceptFriend = myUser.acceptFriend || []

        const users = await User.find({
            _id: { $in: acceptFriend },
            status: 'active',
            deleted: false
        }).select('id fullName avatar')

        res.render('client/pages/chat/accept', {
            title: 'Lời mời đã nhận',
            users: users
        })
    } catch (error) {
        console.error('Error in accept function:', error)
        req.flash("error", "Có lỗi xảy ra!")
        res.redirect("/chat")
    }
}

// [GET] /users/friends
export async function friends(req, res) {
    const userId = res.locals.user.id
    const myUser = await User.findOne({ _id: userId })

    const friendList = myUser.friendList
    const friendIds = friendList.map(item => item.user_id)

    const users = await User.find({
        _id: { $in: friendIds },
        status: 'active',
        deleted: false
    }).select('id fullName avatar')

    res.render('client/pages/chat/friends', {
        title: 'Danh sách bạn bè',
        users: users
    })
}

// [GET] /chat/:roomChatId
export async function chatDetail(req, res) {
    try {
        const userId = res.locals.user.id
        const roomChatId = req.params.roomChatId

        // Kiểm tra quyền truy cập room
        const room = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        })

        if(!room) {
            req.flash("error", "Không có quyền truy cập phòng chat này!")
            return res.redirect("/chat")
        }

        // Lấy thông tin user khác trong room (với typeRoom = "friend")
        const friendInfo = room.users.find(user => user.user_id != userId)
        const friend = await User.findById(friendInfo.user_id).select('fullName avatar')

        // Lấy tin nhắn trong room với thông tin đầy đủ
        const chats = await Chat.find({
            room_chat_id: roomChatId,
            deleted: false
        }).sort({ createdAt: 1 })

        for(const chat of chats) {
            const user = await User.findById(chat.user_id).select('fullName avatar')
            chat.user = user
            
            // Xử lý dữ liệu images - đảm bảo chỉ là URL string
            if(chat.images && chat.images.length > 0) {
                chat.images = chat.images.map(image => {
                    // Nếu image là object (dữ liệu cũ), lấy URL
                    if(typeof image === 'object' && image.url) {
                        return image.url
                    }
                    // Nếu đã là string URL thì giữ nguyên
                    return image
                })
            }

            // Xử lý thông tin reactions
            if(chat.reactions && chat.reactions.length > 0) {
                const reactionsSummary = {}
                for(const reaction of chat.reactions) {
                    if(!reactionsSummary[reaction.emoji]) {
                        reactionsSummary[reaction.emoji] = {
                            count: 0,
                            users: []
                        }
                    }
                    const reactionUser = await User.findById(reaction.user_id).select('fullName avatar')
                    reactionsSummary[reaction.emoji].count++
                    reactionsSummary[reaction.emoji].users.push({
                        user_id: reaction.user_id,
                        user: reactionUser || { fullName: 'Unknown', avatar: '' },
                        reactedAt: reaction.reactedAt
                    })
                }
                chat.reactionsSummary = reactionsSummary
            }

            // Xử lý thông tin seen
            if(chat.seenBy && chat.seenBy.length > 0) {
                const seenUsers = []
                for(const seen of chat.seenBy) {
                    const seenUser = await User.findById(seen.user_id).select('fullName avatar')
                    seenUsers.push({
                        user_id: seen.user_id,
                        user: seenUser || { fullName: 'Unknown', avatar: '' },
                        seenAt: seen.seenAt
                    })
                }
                chat.seenUsers = seenUsers
            }

            // Xử lý thông tin reply
            if(chat.replyTo && chat.replyTo.message_id) {
                const originalMsg = await Chat.findById(chat.replyTo.message_id)
                if(originalMsg) {
                    const originalUser = await User.findById(originalMsg.user_id).select('fullName avatar')
                    chat.replyInfo = {
                        message_id: chat.replyTo.message_id,
                        content: chat.replyTo.content,
                        user: originalUser || { fullName: chat.replyTo.user_name, avatar: '' }
                    }
                }
            }
        }

        // Lấy số tin nhắn chưa đọc
        const unreadCount = await getUnreadCount(roomChatId, userId)

        res.render('client/pages/chat/detail', {
            title: `Chat với ${friend.fullName}`,
            chats: chats,
            roomChatId: roomChatId,
            friend: friend,
            unreadCount: unreadCount,
            canPin: await canPinMessage(roomChatId, userId)
        })

    } catch (error) {
        req.flash("error", "Lỗi!")
        res.redirect("/chat")
    }
}

// API ENDPOINTS CHO CÁC TÍNH NĂNG MỚI

// [GET] /api/chat/messages/:roomId - Lấy tin nhắn với phân trang
export async function getMessagesAPI(req, res) {
    try {
        const roomChatId = req.params.roomId
        const userId = res.locals.user.id
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 20

        // Kiểm tra quyền trong room
        const room = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        })

        if (!room) {
            return res.status(403).json({
                code: 403,
                message: "Không có quyền truy cập room này!"
            })
        }

        const skip = (page - 1) * limit

        // Lấy tin nhắn từ database
        const messages = await Chat.find({
            room_chat_id: roomChatId,
            deleted: false
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)

        // Populate thông tin cho từng tin nhắn
        const messagesWithInfo = await Promise.all(
            messages.map(async (msg) => {
                const user = await User.findById(msg.user_id).select('fullName avatar')
                
                // Thông tin seen
                const seenUsers = await Promise.all(
                    msg.seenBy.map(async (seen) => {
                        const seenUser = await User.findById(seen.user_id).select('fullName avatar')
                        return {
                            user_id: seen.user_id,
                            seenAt: seen.seenAt,
                            user: seenUser || { fullName: 'Unknown User', avatar: '' }
                        }
                    })
                )

                // Thông tin reactions
                const reactionsWithUsers = await Promise.all(
                    msg.reactions.map(async (reaction) => {
                        const reactionUser = await User.findById(reaction.user_id).select('fullName avatar')
                        return {
                            user_id: reaction.user_id,
                            emoji: reaction.emoji,
                            reactedAt: reaction.reactedAt,
                            user: reactionUser || { fullName: 'Unknown User', avatar: '' }
                        }
                    })
                )

                // Nhóm reactions theo emoji
                const reactionsSummary = {}
                reactionsWithUsers.forEach(reaction => {
                    if (!reactionsSummary[reaction.emoji]) {
                        reactionsSummary[reaction.emoji] = {
                            count: 0,
                            users: []
                        }
                    }
                    reactionsSummary[reaction.emoji].count++
                    reactionsSummary[reaction.emoji].users.push({
                        user_id: reaction.user_id,
                        user: reaction.user,
                        reactedAt: reaction.reactedAt
                    })
                })

                // Thông tin reply
                let replyInfo = null
                if (msg.replyTo && msg.replyTo.message_id) {
                    const originalMsg = await Chat.findById(msg.replyTo.message_id)
                    if (originalMsg) {
                        const originalUser = await User.findById(originalMsg.user_id).select('fullName avatar')
                        replyInfo = {
                            message_id: msg.replyTo.message_id,
                            content: msg.replyTo.content,
                            user: originalUser || { fullName: msg.replyTo.user_name, avatar: '' }
                        }
                    }
                }

                return {
                    _id: msg._id,
                    content: msg.content,
                    images: msg.images,
                    user_id: msg.user_id,
                    user: user || { fullName: 'Unknown User', avatar: '' },
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt,
                    edited: msg.edited || false,
                    pinned: msg.pinned || false,
                    pinnedAt: msg.pinnedAt,
                    seenBy: seenUsers,
                    reactions: reactionsWithUsers,
                    reactionsSummary: reactionsSummary,
                    replyTo: replyInfo
                }
            })
        )

        const totalMessages = await Chat.countDocuments({
            room_chat_id: roomChatId,
            deleted: false
        })

        const unreadCount = await getUnreadCount(roomChatId, userId)

        res.json({
            code: 200,
            message: "Lấy tin nhắn thành công!",
            data: {
                messages: messagesWithInfo.reverse(),
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: limit
                },
                unreadCount: unreadCount
            }
        })

    } catch (error) {
        console.log("Error in getMessagesAPI:", error)
        res.status(500).json({
            code: 500,
            message: "Lỗi server!"
        })
    }
}

// [GET] /api/chat/pinned/:roomId - Lấy tin nhắn đã ghim
export async function getPinnedMessagesAPI(req, res) {
    try {
        const roomChatId = req.params.roomId
        const userId = res.locals.user.id

        const room = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        })

        if (!room) {
            return res.status(403).json({
                code: 403,
                message: "Không có quyền truy cập room này!"
            })
        }

        const pinnedMessages = await Chat.find({
            room_chat_id: roomChatId,
            pinned: true,
            deleted: false
        }).sort({ pinnedAt: -1 })

        const messagesWithInfo = await Promise.all(
            pinnedMessages.map(async (msg) => {
                const user = await User.findById(msg.user_id).select('fullName avatar')
                const pinnedByUser = await User.findById(msg.pinnedBy).select('fullName avatar')
                
                return {
                    _id: msg._id,
                    content: msg.content,
                    images: msg.images,
                    createdAt: msg.createdAt,
                    pinnedAt: msg.pinnedAt,
                    user: user || { fullName: 'Unknown User', avatar: '' },
                    pinnedBy: {
                        user_id: msg.pinnedBy,
                        user: pinnedByUser || { fullName: 'Unknown User', avatar: '' }
                    },
                    reactions: msg.reactions,
                    seenBy: msg.seenBy
                }
            })
        )

        res.json({
            code: 200,
            message: "Lấy tin nhắn đã ghim thành công!",
            data: {
                pinnedMessages: messagesWithInfo,
                count: messagesWithInfo.length
            }
        })

    } catch (error) {
        console.log("Error in getPinnedMessagesAPI:", error)
        res.status(500).json({
            code: 500,
            message: "Lỗi server!"
        })
    }
}

// [GET] /api/chat/unread-count/:roomId - Lấy số tin nhắn chưa đọc
export async function getUnreadCountAPI(req, res) {
    try {
        const roomChatId = req.params.roomId
        const userId = res.locals.user.id

        const room = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        })

        if (!room) {
            return res.status(403).json({
                code: 403,
                message: "Không có quyền truy cập room này!"
            })
        }

        const unreadCount = await getUnreadCount(roomChatId, userId)

        res.json({
            code: 200,
            message: "Lấy số tin nhắn chưa đọc thành công!",
            data: {
                roomChatId: roomChatId,
                unreadCount: unreadCount
            }
        })

    } catch (error) {
        console.log("Error in getUnreadCountAPI:", error)
        res.status(500).json({
            code: 500,
            message: "Lỗi server!"
        })
    }
}

// [GET] /api/chat/edit-history/:messageId - Lấy lịch sử chỉnh sửa
export async function getEditHistoryAPI(req, res) {
    try {
        const messageId = req.params.messageId
        const userId = res.locals.user.id

        const message = await Chat.findById(messageId)
        if (!message) {
            return res.status(404).json({
                code: 404,
                message: "Không tìm thấy tin nhắn!"
            })
        }

        const room = await RoomChat.findOne({
            _id: message.room_chat_id,
            "users.user_id": userId,
            deleted: false
        })

        if (!room) {
            return res.status(403).json({
                code: 403,
                message: "Không có quyền truy cập room này!"
            })
        }

        res.json({
            code: 200,
            message: "Lấy lịch sử chỉnh sửa thành công!",
            data: {
                messageId: messageId,
                currentContent: message.content,
                edited: message.edited || false,
                editHistory: message.editHistory || []
            }
        })

    } catch (error) {
        console.log("Error in getEditHistoryAPI:", error)
        res.status(500).json({
            code: 500,
            message: "Lỗi server!"
        })
    }
}
