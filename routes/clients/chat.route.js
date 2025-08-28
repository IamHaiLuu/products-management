import { Router } from 'express'
const router = Router()

import * as controller from '../../controllers/clients/chat.controller.js'

// GET routes for rendering views
router.get('/', controller.index)

router.get('/not-friend', controller.notFriend)

router.get('/request', controller.request)

router.get('/accept', controller.accept)

router.get('/friends', controller.friends)

router.get('/:roomChatId', controller.chatDetail)

// API routes cho các tính năng nâng cao
router.get('/api/messages/:roomId', controller.getMessagesAPI)

router.get('/api/pinned/:roomId', controller.getPinnedMessagesAPI)

router.get('/api/unread-count/:roomId', controller.getUnreadCountAPI)

router.get('/api/edit-history/:messageId', controller.getEditHistoryAPI)

// All friend management actions (add, accept, refuse, cancel, delete) 
// are now handled via Socket.io realtime events in chat.socket.js

export default router