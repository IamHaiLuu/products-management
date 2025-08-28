import Chat from '../../models/chat.model.js'
import RoomChat from '../../models/room-chat.model.js'
import User from '../../models/user.model.js'
import { uploadToCloudinary } from '../../helpers/uploadToCloudinary.js'
import { markAllMessagesAsRead, getUnreadCount, isValidEmoji, canPinMessage } from '../../helpers/message.js'

// Track if socket handlers are already set up
let socketHandlersInitialized = false

export default async () => {
    // Only initialize socket handlers once
    if (socketHandlersInitialized) {
        return
    }
    
    socketHandlersInitialized = true

    _io.on('connection', (socket) => {
        
        // Join room khi user vào chat detail
        socket.on('CLIENT_JOIN_ROOM', (roomChatId) => {
            socket.join(roomChatId)
        })

        // Leave room khi user rời khỏi chat
        socket.on('CLIENT_LEAVE_ROOM', (roomChatId) => {
            socket.leave(roomChatId)
        })

        socket.on('Client_Send_Message', async (data) => {
            const roomChatId = data.roomChatId
            const userId = data.userId
            const fullName = data.fullName
            
            if (!userId || !fullName) {
                socket.emit('error', { message: 'User information missing' })
                return
            }
            
            // Kiểm tra quyền gửi tin nhắn trong room
            const room = await RoomChat.findOne({
                _id: roomChatId,
                "users.user_id": userId,
                deleted: false
            })

            if(!room) {
                return
            }
            
            let images = []
            for(const image of data.images) {
                const link = await uploadToCloudinary(image)
                images.push(link.url)  
            }
            
            const chatData = {
                user_id: userId,
                room_chat_id: roomChatId,
                content: data.content,
                images: images
            }

            // Nếu có reply, thêm thông tin reply
            if(data.replyTo) {
                chatData.replyTo = {
                    message_id: data.replyTo.message_id,
                    content: data.replyTo.content,
                    user_id: data.replyTo.user_id,
                    user_name: data.replyTo.user_name
                }
            }

            const chat = new Chat(chatData)
            await chat.save()

            // Populate user info cho response
            const responseData = {
                _id: chat._id,
                userId: userId,
                fullName: fullName,
                content: data.content,
                images: images,
                createdAt: chat.createdAt,
                replyTo: chatData.replyTo || null
            }

            _io.to(roomChatId).emit('Server_Return_Message', responseData)
        })

        socket.on('Client_Send_Typing', (data) => {
            const roomChatId = data.roomChatId
            const userId = data.userId
            const fullName = data.fullName
            
            if (!userId || !fullName) {
                return
            }
            
            socket.to(roomChatId).emit('Server_Return_Typing', {
                userId: userId,
                fullName: fullName,
                type: data.type
            })
        })

        // Realtime Friend Management Events

        // TÍNH NĂNG MỚI: Đánh dấu tin nhắn đã đọc
        socket.on('Client_Mark_Message_Seen', async (data) => {
            try {
                const { messageId, userId, roomChatId } = data
                
                if (!messageId || !userId || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền trong room
                const room = await RoomChat.findOne({
                    _id: roomChatId,
                    "users.user_id": userId,
                    deleted: false
                })

                if (!room) {
                    return
                }

                // Cập nhật seenBy cho tin nhắn
                const chat = await Chat.findById(messageId)
                if (chat && !chat.seenBy.some(seen => seen.user_id === userId)) {
                    await Chat.updateOne(
                        { _id: messageId },
                        { 
                            $push: { 
                                seenBy: {
                                    user_id: userId,
                                    seenAt: new Date()
                                }
                            }
                        }
                    )

                    // Thông báo cho tất cả users trong room
                    _io.to(roomChatId).emit('Server_Message_Seen', {
                        messageId: messageId,
                        userId: userId,
                        seenAt: new Date()
                    })
                }
            } catch (error) {
                console.log('Error marking message as seen:', error)
            }
        })

        // TÍNH NĂNG MỚI: Thêm reaction vào tin nhắn
        socket.on('Client_Add_Reaction', async (data) => {
            try {
                const { messageId, userId, emoji, roomChatId, fullName } = data
                
                if (!messageId || !userId || !emoji || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Validate emoji
                if (!isValidEmoji(emoji)) {
                    socket.emit('error', { message: 'Invalid emoji' })
                    return
                }

                // Kiểm tra quyền trong room
                const room = await RoomChat.findOne({
                    _id: roomChatId,
                    "users.user_id": userId,
                    deleted: false
                })

                if (!room) {
                    return
                }

                const chat = await Chat.findById(messageId)
                if (chat) {
                    // Kiểm tra user đã react với emoji này chưa
                    const existingReaction = chat.reactions.find(
                        r => r.user_id === userId && r.emoji === emoji
                    )

                    if (existingReaction) {
                        // Nếu đã react, thì remove reaction
                        await Chat.updateOne(
                            { _id: messageId },
                            { 
                                $pull: { 
                                    reactions: { user_id: userId, emoji: emoji }
                                }
                            }
                        )
                        
                        _io.to(roomChatId).emit('Server_Reaction_Removed', {
                            messageId: messageId,
                            userId: userId,
                            emoji: emoji,
                            fullName: fullName
                        })
                    } else {
                        // Nếu chưa react, thì add reaction
                        await Chat.updateOne(
                            { _id: messageId },
                            { 
                                $push: { 
                                    reactions: {
                                        user_id: userId,
                                        emoji: emoji,
                                        reactedAt: new Date()
                                    }
                                }
                            }
                        )
                        
                        _io.to(roomChatId).emit('Server_Reaction_Added', {
                            messageId: messageId,
                            userId: userId,
                            emoji: emoji,
                            fullName: fullName,
                            reactedAt: new Date()
                        })
                    }
                }
            } catch (error) {
                console.log('Error adding reaction:', error)
            }
        })

        // TÍNH NĂNG MỚI: Ghim tin nhắn
        socket.on('Client_Pin_Message', async (data) => {
            try {
                const { messageId, userId, roomChatId, fullName } = data
                
                if (!messageId || !userId || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền admin trong room
                if (!await canPinMessage(roomChatId, userId)) {
                    socket.emit('error', { message: 'No permission to pin messages' })
                    return
                }

                const chat = await Chat.findById(messageId)
                if (chat) {
                    const isPinned = chat.pinned
                    
                    await Chat.updateOne(
                        { _id: messageId },
                        { 
                            pinned: !isPinned,
                            pinnedAt: !isPinned ? new Date() : null,
                            pinnedBy: !isPinned ? userId : null
                        }
                    )

                    _io.to(roomChatId).emit('Server_Message_Pinned', {
                        messageId: messageId,
                        pinned: !isPinned,
                        pinnedBy: userId,
                        pinnedByName: fullName,
                        pinnedAt: !isPinned ? new Date() : null
                    })
                }
            } catch (error) {
                console.log('Error pinning message:', error)
            }
        })

        // TÍNH NĂNG MỚI: Chỉnh sửa tin nhắn
        socket.on('Client_Edit_Message', async (data) => {
            try {
                const { messageId, userId, newContent, roomChatId, fullName } = data
                
                if (!messageId || !userId || !newContent || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền trong room và tin nhắn thuộc về user
                const chat = await Chat.findOne({
                    _id: messageId,
                    user_id: userId,
                    room_chat_id: roomChatId
                })

                if (!chat) {
                    socket.emit('error', { message: 'Message not found or no permission' })
                    return
                }

                // Lưu nội dung cũ vào lịch sử
                const editHistoryEntry = {
                    content: chat.content,
                    editedAt: new Date()
                }

                await Chat.updateOne(
                    { _id: messageId },
                    { 
                        content: newContent,
                        edited: true,
                        $push: { editHistory: editHistoryEntry }
                    }
                )

                _io.to(roomChatId).emit('Server_Message_Edited', {
                    messageId: messageId,
                    newContent: newContent,
                    edited: true,
                    editedAt: new Date(),
                    userId: userId,
                    fullName: fullName
                })
            } catch (error) {
                console.log('Error editing message:', error)
            }
        })

        // TÍNH NĂNG MỚI: Lấy tin nhắn đã ghim
        socket.on('Client_Get_Pinned_Messages', async (data) => {
            try {
                const { roomChatId, userId } = data
                
                if (!roomChatId || !userId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền trong room
                const room = await RoomChat.findOne({
                    _id: roomChatId,
                    "users.user_id": userId,
                    deleted: false
                })

                if (!room) {
                    return
                }

                // Lấy tất cả tin nhắn đã ghim
                const pinnedMessages = await Chat.find({
                    room_chat_id: roomChatId,
                    pinned: true,
                    deleted: false
                }).sort({ pinnedAt: -1 }).limit(10)

                // Populate thông tin user cho mỗi tin nhắn
                const messagesWithUserInfo = await Promise.all(
                    pinnedMessages.map(async (msg) => {
                        const user = await User.findById(msg.user_id).select('fullName avatar')
                        const pinnedByUser = await User.findById(msg.pinnedBy).select('fullName')
                        
                        return {
                            _id: msg._id,
                            content: msg.content,
                            images: msg.images,
                            createdAt: msg.createdAt,
                            pinnedAt: msg.pinnedAt,
                            user: user || { fullName: 'Unknown User', avatar: '' },
                            pinnedBy: pinnedByUser || { fullName: 'Unknown User' },
                            reactions: msg.reactions,
                            seenBy: msg.seenBy
                        }
                    })
                )

                socket.emit('Server_Return_Pinned_Messages', {
                    roomChatId: roomChatId,
                    pinnedMessages: messagesWithUserInfo
                })
            } catch (error) {
                console.log('Error getting pinned messages:', error)
            }
        })

        // TÍNH NĂNG MỚI: Đánh dấu tất cả tin nhắn đã đọc khi vào room
        socket.on('Client_Mark_All_Read', async (data) => {
            try {
                const { roomChatId, userId } = data
                
                if (!roomChatId || !userId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền trong room
                const room = await RoomChat.findOne({
                    _id: roomChatId,
                    "users.user_id": userId,
                    deleted: false
                })

                if (!room) {
                    return
                }

                const markedCount = await markAllMessagesAsRead(roomChatId, userId)
                
                socket.emit('Server_All_Messages_Read', {
                    roomChatId: roomChatId,
                    markedCount: markedCount
                })

                // Thông báo cho các users khác biết user này đã đọc tất cả
                socket.to(roomChatId).emit('Server_User_Read_All', {
                    userId: userId,
                    roomChatId: roomChatId
                })
            } catch (error) {
                console.log('Error marking all as read:', error)
            }
        })

        // TÍNH NĂNG MỚI: Lấy số tin nhắn chưa đọc
        socket.on('Client_Get_Unread_Count', async (data) => {
            try {
                const { roomChatId, userId } = data
                
                if (!roomChatId || !userId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                const unreadCount = await getUnreadCount(roomChatId, userId)
                
                socket.emit('Server_Unread_Count', {
                    roomChatId: roomChatId,
                    unreadCount: unreadCount
                })
            } catch (error) {
                console.log('Error getting unread count:', error)
            }
        })

        // TÍNH NĂNG MỚI: Xóa tin nhắn (soft delete)
        socket.on('Client_Delete_Message', async (data) => {
            try {
                const { messageId, userId, roomChatId, fullName } = data
                
                if (!messageId || !userId || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra tin nhắn thuộc về user hoặc user có quyền admin
                const chat = await Chat.findOne({
                    _id: messageId,
                    room_chat_id: roomChatId
                })

                if (!chat) {
                    socket.emit('error', { message: 'Message not found' })
                    return
                }

                const isOwner = chat.user_id === userId
                const hasAdminPermission = await canPinMessage(roomChatId, userId)

                if (!isOwner && !hasAdminPermission) {
                    socket.emit('error', { message: 'No permission to delete message' })
                    return
                }

                await Chat.updateOne(
                    { _id: messageId },
                    { 
                        deleted: true,
                        deletedAt: new Date()
                    }
                )

                _io.to(roomChatId).emit('Server_Message_Deleted', {
                    messageId: messageId,
                    deletedBy: userId,
                    deletedByName: fullName,
                    deletedAt: new Date()
                })
            } catch (error) {
                console.log('Error deleting message:', error)
            }
        })

        // TÍNH NĂNG MỚI: Lấy lịch sử chỉnh sửa tin nhắn
        socket.on('Client_Get_Edit_History', async (data) => {
            try {
                const { messageId, userId, roomChatId } = data
                
                if (!messageId || !userId || !roomChatId) {
                    socket.emit('error', { message: 'Missing required data' })
                    return
                }

                // Kiểm tra quyền trong room
                const room = await RoomChat.findOne({
                    _id: roomChatId,
                    "users.user_id": userId,
                    deleted: false
                })

                if (!room) {
                    return
                }

                const chat = await Chat.findById(messageId).select('editHistory content edited')
                if (chat && chat.edited) {
                    socket.emit('Server_Edit_History', {
                        messageId: messageId,
                        currentContent: chat.content,
                        editHistory: chat.editHistory
                    })
                }
            } catch (error) {
                console.log('Error getting edit history:', error)
            }
        })

        // Realtime Friend Management Events

        // Gửi lời mời kết bạn
        socket.on('CLIENT_ADD_FRIEND', async (data) => {
            try {
                const userBId = data.userBId
                const userId = data.userId
                const fullName = data.fullName
                
                if (!userId || !fullName) {
                    socket.emit('SERVER_ADD_FRIEND_ERROR', {
                        code: 400,
                        message: 'User information missing!'
                    })
                    return
                }

                const existUserB = await User.findOne({
                    _id: userBId,
                    status: 'active',
                    deleted: false
                })

                if(existUserB) {
                    const existUserAInB = existUserB.acceptFriend.find(item => item == userId)

                    if(!existUserAInB) {
                        await User.updateOne(
                            { _id: userBId },
                            {
                                $push: { acceptFriend: userId }
                            }
                        )
                    }

                    const existUserBInA = await User.findOne({
                        _id: userId,
                        requestFriend: userBId
                    })

                    if(!existUserBInA) {
                        await User.updateOne(
                            { _id: userId },
                            {
                                $push: { requestFriend: userBId }
                            }
                        )
                    }

                    // Emit to sender
                    socket.emit('SERVER_ADD_FRIEND_SUCCESS', {
                        code: 200,
                        message: 'Gửi yêu cầu kết bạn thành công!',
                        userBId: userBId
                    })

                    // Emit to receiver để update realtime
                    socket.broadcast.emit('SERVER_RECEIVE_FRIEND_REQUEST', {
                        userAId: userId,
                        userAName: fullName
                    })

                } else {
                    socket.emit('SERVER_ADD_FRIEND_ERROR', {
                        code: 400,
                        message: 'Người dùng không tồn tại!'
                    })
                }
            } catch (error) {
                socket.emit('SERVER_ADD_FRIEND_ERROR', {
                    code: 400,
                    message: 'Lỗi!'
                })
            }
        })

        // Chấp nhận kết bạn
        socket.on('CLIENT_ACCEPT_FRIEND', async (data) => {
            try {
                const userBId = data.userBId
                const userId = data.userId
                const fullName = data.fullName
                
                if (!userId || !fullName) {
                    socket.emit('SERVER_ACCEPT_FRIEND_ERROR', {
                        code: 400,
                        message: 'User information missing!'
                    })
                    return
                }

                const existUserB = await User.findOne({
                    _id: userBId,
                    status: 'active',
                    deleted: false
                })

                if(existUserB) {
                    // Kiểm tra xem đã có room chat giữa 2 người này chưa
                    let existingRoom = await RoomChat.findOne({
                        typeRoom: "friend",
                        "users.user_id": { $all: [userId, userBId] },
                        deleted: false
                    })

                    let roomChatId;

                    if(existingRoom) {
                        // Nếu đã có room chat, sử dụng room đó
                        roomChatId = existingRoom._id
                        console.log('Sử dụng room chat đã tồn tại:', roomChatId)
                    } else {
                        // Nếu chưa có, tạo room chat mới
                        const roomChat = new RoomChat({
                            typeRoom: "friend",
                            users: [
                                {
                                    user_id: userId,
                                    role: "superAdmin"
                                },
                                {
                                    user_id: userBId,
                                    role: "superAdmin"
                                }
                            ]
                        })

                        await roomChat.save()
                        roomChatId = roomChat._id
                        console.log('Tạo room chat mới:', roomChatId)
                    }

                    // Kiểm tra xem người dùng đã có trong friendList chưa
                    const userA = await User.findById(userId)
                    const userB = await User.findById(userBId)

                    const friendExistInA = userA.friendList.some(friend => friend.user_id === userBId)
                    const friendExistInB = userB.friendList.some(friend => friend.user_id === userId)

                    // Cập nhật friendList cho user A nếu chưa có
                    if(!friendExistInA) {
                        await User.updateOne(
                            { _id: userId },
                            {
                                $push: {
                                    friendList: {
                                        user_id: userBId,
                                        room_chat_id: roomChatId
                                    }
                                },
                                $pull: { acceptFriend: userBId }
                            }
                        )
                    } else {
                        // Chỉ xóa khỏi acceptFriend nếu đã có trong friendList
                        await User.updateOne(
                            { _id: userId },
                            { $pull: { acceptFriend: userBId } }
                        )
                    }

                    // Cập nhật friendList cho user B nếu chưa có
                    if(!friendExistInB) {
                        await User.updateOne(
                            { _id: userBId },
                            {
                                $push: {
                                    friendList: {
                                        user_id: userId,
                                        room_chat_id: roomChatId
                                    }
                                },
                                $pull: { requestFriend: userId }
                            }
                        )
                    } else {
                        // Chỉ xóa khỏi requestFriend nếu đã có trong friendList
                        await User.updateOne(
                            { _id: userBId },
                            { $pull: { requestFriend: userId } }
                        )
                    }

                    // Emit to both users
                    socket.emit('SERVER_ACCEPT_FRIEND_SUCCESS', {
                        code: 200,
                        message: 'Chấp nhận kết bạn thành công!',
                        userBId: userBId,
                        roomChatId: roomChatId
                    })

                    socket.broadcast.emit('SERVER_FRIEND_ACCEPTED', {
                        userAId: userId,
                        userAName: fullName,
                        roomChatId: roomChatId
                    })

                } else {
                    socket.emit('SERVER_ACCEPT_FRIEND_ERROR', {
                        code: 400,
                        message: 'Người dùng không tồn tại!'
                    })
                }
            } catch (error) {
                socket.emit('SERVER_ACCEPT_FRIEND_ERROR', {
                    code: 400,
                    message: 'Lỗi!'
                })
            }
        })

        // Từ chối kết bạn
        socket.on('CLIENT_REFUSE_FRIEND', async (data) => {
            try {
                const userBId = data.userBId
                const userId = data.userId
                const fullName = data.fullName
                
                if (!userId || !fullName) {
                    socket.emit('SERVER_REFUSE_FRIEND_ERROR', {
                        code: 400,
                        message: 'User information missing!'
                    })
                    return
                }

                const existUserB = await User.findOne({
                    _id: userBId,
                    status: 'active',
                    deleted: false
                })

                if(existUserB) {
                    await User.updateOne(
                        { _id: userId },
                        {
                            $pull: { acceptFriend: userBId }
                        }
                    )

                    await User.updateOne(
                        { _id: userBId },
                        {
                            $pull: { requestFriend: userId }
                        }
                    )

                    socket.emit('SERVER_REFUSE_FRIEND_SUCCESS', {
                        code: 200,
                        message: 'Đã từ chối kết bạn!',
                        userBId: userBId
                    })

                    socket.broadcast.emit('SERVER_FRIEND_REFUSED', {
                        userAId: userId,
                        userAName: fullName
                    })

                } else {
                    socket.emit('SERVER_REFUSE_FRIEND_ERROR', {
                        code: 400,
                        message: 'Người dùng không tồn tại!'
                    })
                }
            } catch (error) {
                socket.emit('SERVER_REFUSE_FRIEND_ERROR', {
                    code: 400,
                    message: 'Lỗi!'
                })
            }
        })

        // Hủy yêu cầu kết bạn
        socket.on('CLIENT_CANCEL_FRIEND', async (data) => {
            try {
                const userBId = data.userBId
                const userId = data.userId
                const fullName = data.fullName
                
                if (!userId || !fullName) {
                    socket.emit('SERVER_CANCEL_FRIEND_ERROR', {
                        code: 400,
                        message: 'User information missing!'
                    })
                    return
                }

                const existUserB = await User.findOne({
                    _id: userBId,
                    status: 'active',
                    deleted: false
                })

                if(existUserB) {
                    await User.updateOne(
                        { _id: userId },
                        {
                            $pull: { requestFriend: userBId }
                        }
                    )

                    await User.updateOne(
                        { _id: userBId },
                        {
                            $pull: { acceptFriend: userId }
                        }
                    )

                    socket.emit('SERVER_CANCEL_FRIEND_SUCCESS', {
                        code: 200,
                        message: 'Đã hủy yêu cầu kết bạn!',
                        userBId: userBId
                    })

                    socket.broadcast.emit('SERVER_FRIEND_REQUEST_CANCELLED', {
                        userAId: userId,
                        userAName: fullName
                    })

                } else {
                    socket.emit('SERVER_CANCEL_FRIEND_ERROR', {
                        code: 400,
                        message: 'Người dùng không tồn tại!'
                    })
                }
            } catch (error) {
                socket.emit('SERVER_CANCEL_FRIEND_ERROR', {
                    code: 400,
                    message: 'Lỗi!'
                })
            }
        })

        // Xóa bạn bè
        socket.on('CLIENT_DELETE_FRIEND', async (data) => {
            try {
                const userBId = data.userBId
                const userId = data.userId
                const fullName = data.fullName
                
                if (!userId || !fullName) {
                    socket.emit('SERVER_DELETE_FRIEND_ERROR', {
                        code: 400,
                        message: 'User information missing!'
                    })
                    return
                }

                const existUserB = await User.findOne({
                    _id: userBId,
                    status: 'active',
                    deleted: false
                })

                if(existUserB) {
                    // Tìm room chat giữa 2 người
                    const userA = await User.findById(userId)
                    const roomChatInfo = userA.friendList.find(item => item.user_id == userBId)

                    if(roomChatInfo) {
                        // Xóa room chat
                        await RoomChat.updateOne(
                            { _id: roomChatInfo.room_chat_id },
                            { 
                                deleted: true,
                                deletedAt: new Date()
                            }
                        )
                    }

                    // Xóa khỏi friendList của cả 2 user
                    await User.updateOne(
                        { _id: userId },
                        {
                            $pull: { friendList: { user_id: userBId } }
                        }
                    )

                    await User.updateOne(
                        { _id: userBId },
                        {
                            $pull: { friendList: { user_id: userId } }
                        }
                    )

                    socket.emit('SERVER_DELETE_FRIEND_SUCCESS', {
                        code: 200,
                        message: 'Đã xóa bạn bè!',
                        userBId: userBId
                    })

                    socket.broadcast.emit('SERVER_FRIEND_DELETED', {
                        userAId: userId,
                        userAName: fullName
                    })

                } else {
                    socket.emit('SERVER_DELETE_FRIEND_ERROR', {
                        code: 400,
                        message: 'Người dùng không tồn tại!'
                    })
                }
            } catch (error) {
                socket.emit('SERVER_DELETE_FRIEND_ERROR', {
                    code: 400,
                    message: 'Lỗi!'
                })
            }
        })
    })
}