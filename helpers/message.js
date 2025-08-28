import Chat from '../models/chat.model.js'
import User from '../models/user.model.js'

// Đánh dấu tất cả tin nhắn trong room là đã đọc cho user
export const markAllMessagesAsRead = async (roomChatId, userId) => {
    try {
        // Lấy tất cả tin nhắn chưa được user đọc
        const unreadMessages = await Chat.find({
            room_chat_id: roomChatId,
            user_id: { $ne: userId }, // Không phải tin nhắn của chính user
            'seenBy.user_id': { $ne: userId }, // Chưa được user đọc
            deleted: false
        })

        // Đánh dấu đã đọc cho tất cả
        for (const message of unreadMessages) {
            await Chat.updateOne(
                { _id: message._id },
                {
                    $push: {
                        seenBy: {
                            user_id: userId,
                            seenAt: new Date()
                        }
                    }
                }
            )
        }

        return unreadMessages.length
    } catch (error) {
        console.log('Error marking all messages as read:', error)
        return 0
    }
}

// Lấy số tin nhắn chưa đọc trong room
export const getUnreadCount = async (roomChatId, userId) => {
    try {
        const count = await Chat.countDocuments({
            room_chat_id: roomChatId,
            user_id: { $ne: userId },
            'seenBy.user_id': { $ne: userId },
            deleted: false
        })
        return count
    } catch (error) {
        console.log('Error getting unread count:', error)
        return 0
    }
}

// Lấy danh sách reactions được nhóm theo emoji
export const getReactionsSummary = (reactions) => {
    const summary = {}
    
    reactions.forEach(reaction => {
        if (!summary[reaction.emoji]) {
            summary[reaction.emoji] = {
                count: 0,
                users: []
            }
        }
        summary[reaction.emoji].count++
        summary[reaction.emoji].users.push({
            user_id: reaction.user_id,
            reactedAt: reaction.reactedAt
        })
    })
    
    return summary
}

// Kiểm tra xem user có quyền ghim tin nhắn không
export const canPinMessage = async (roomChatId, userId) => {
    try {
        const RoomChat = (await import('../models/room-chat.model.js')).default
        const room = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        })

        if (!room) return false

        const userRole = room.users.find(u => u.user_id === userId)?.role
        return userRole === 'superAdmin' || userRole === 'admin'
    } catch (error) {
        console.log('Error checking pin permission:', error)
        return false
    }
}

// Lấy tin nhắn với thông tin đầy đủ (user, reactions, seen status)
export const getMessageWithFullInfo = async (messageId) => {
    try {
        const message = await Chat.findById(messageId)
        if (!message) return null

        const user = await User.findById(message.user_id).select('fullName avatar')
        
        // Lấy thông tin users đã seen
        const seenUsers = await Promise.all(
            message.seenBy.map(async (seen) => {
                const user = await User.findById(seen.user_id).select('fullName avatar')
                return {
                    ...seen.toObject(),
                    user: user || { fullName: 'Unknown User', avatar: '' }
                }
            })
        )

        // Lấy thông tin users đã react
        const reactionsWithUsers = await Promise.all(
            message.reactions.map(async (reaction) => {
                const user = await User.findById(reaction.user_id).select('fullName avatar')
                return {
                    ...reaction.toObject(),
                    user: user || { fullName: 'Unknown User', avatar: '' }
                }
            })
        )

        return {
            ...message.toObject(),
            user: user || { fullName: 'Unknown User', avatar: '' },
            seenBy: seenUsers,
            reactions: reactionsWithUsers,
            reactionsSummary: getReactionsSummary(message.reactions)
        }
    } catch (error) {
        console.log('Error getting message with full info:', error)
        return null
    }
}

// Validate emoji (danh sách emoji được phép sử dụng)
export const isValidEmoji = (emoji) => {
    const allowedEmojis = [
        '👍', '👎', '❤️', '😂', '😢', '😮', '😡', '👏', 
        '🔥', '💯', '🎉', '😍', '🤔', '😊', '😎', '🙏'
    ]
    return allowedEmojis.includes(emoji)
}
