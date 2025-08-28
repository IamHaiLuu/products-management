import { Schema, model } from 'mongoose';

const ChatSchema = new Schema({
    user_id: String,
    room_chat_id: String,
    content: String,
    images: Array,
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    seenBy: [{
        user_id: String,
        seenAt: {
            type: Date,
            default: Date.now
        }
    }],
    reactions: [{
        user_id: String,
        emoji: String,
        reactedAt: {
            type: Date,
            default: Date.now
        }
    }],
    replyTo: {
        message_id: String,
        content: String,
        user_id: String,
        user_name: String
    },
    edited: {
        type: Boolean,
        default: false
    },
    editHistory: [{
        content: String,
        editedAt: {
            type: Date,
            default: Date.now
        }
    }],
    pinned: {
        type: Boolean,
        default: false
    },
    pinnedAt: Date,
    pinnedBy: String
}, {
    timestamps: true
});

const Chat = model('Chat', ChatSchema, 'chat');
export default Chat;