class AdvancedChat {
    constructor(socket, roomChatId, userId, fullName) {
        this.socket = socket
        this.roomChatId = roomChatId
        this.userId = userId
        this.fullName = fullName
        
        this.initEventListeners()
        this.setupSocketListeners()
    }

    initEventListeners() {
        // Reaction buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-reaction')) {
                this.addReaction(e.target.dataset.messageId, e.target.dataset.emoji)
            }
            
            // Pin message button
            if (e.target.classList.contains('pin-message-btn')) {
                this.pinMessage(e.target.dataset.messageId)
            }
            
            // Edit message button
            if (e.target.classList.contains('edit-message-btn')) {
                this.showEditForm(e.target.dataset.messageId)
            }
            
            // Reply button
            if (e.target.classList.contains('reply-btn')) {
                this.showReplyForm(e.target.dataset.messageId)
            }
            
            // Delete message button
            if (e.target.classList.contains('delete-message-btn')) {
                this.deleteMessage(e.target.dataset.messageId)
            }
        })

        // Mark messages as seen when scroll into view
        this.setupIntersectionObserver()
    }

    setupSocketListeners() {
        // Nhận tin nhắn mới
        this.socket.on('Server_Return_Message', (data) => {
            this.displayMessage(data)
            this.markMessageAsSeen(data._id)
        })

        // Cập nhật trạng thái seen
        this.socket.on('Server_Message_Seen', (data) => {
            this.updateSeenStatus(data.messageId, data.userId, data.seenAt)
        })

        // Cập nhật reaction
        this.socket.on('Server_Reaction_Added', (data) => {
            this.updateReaction(data.messageId, data.emoji, data.userId, data.fullName, 'add')
        })

        this.socket.on('Server_Reaction_Removed', (data) => {
            this.updateReaction(data.messageId, data.emoji, data.userId, data.fullName, 'remove')
        })

        // Cập nhật trạng thái pin
        this.socket.on('Server_Message_Pinned', (data) => {
            this.updatePinStatus(data.messageId, data.pinned, data.pinnedByName)
        })

        // Cập nhật tin nhắn đã edit
        this.socket.on('Server_Message_Edited', (data) => {
            this.updateEditedMessage(data.messageId, data.newContent, data.editedAt)
        })

        // Tin nhắn bị xóa
        this.socket.on('Server_Message_Deleted', (data) => {
            this.markMessageAsDeleted(data.messageId, data.deletedByName)
        })

        // Lấy tin nhắn đã ghim
        this.socket.on('Server_Return_Pinned_Messages', (data) => {
            this.displayPinnedMessages(data.pinnedMessages)
        })

        // Lịch sử chỉnh sửa
        this.socket.on('Server_Edit_History', (data) => {
            this.showEditHistory(data.messageId, data.editHistory)
        })
    }

    // Tính năng 1: Seen Messages
    markMessageAsSeen(messageId) {
        this.socket.emit('Client_Mark_Message_Seen', {
            messageId: messageId,
            userId: this.userId,
            roomChatId: this.roomChatId
        })
    }

    markAllMessagesAsRead() {
        this.socket.emit('Client_Mark_All_Read', {
            roomChatId: this.roomChatId,
            userId: this.userId
        })
    }

    updateSeenStatus(messageId, userId, seenAt) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            const seenIndicator = messageElement.querySelector('.seen-indicator')
            if (seenIndicator) {
                const seenUsers = JSON.parse(seenIndicator.dataset.seenUsers || '[]')
                if (!seenUsers.find(u => u.user_id === userId)) {
                    seenUsers.push({ user_id: userId, seenAt: seenAt })
                    seenIndicator.dataset.seenUsers = JSON.stringify(seenUsers)
                    this.updateSeenDisplay(seenIndicator, seenUsers)
                }
            }
        }
    }

    updateSeenDisplay(seenIndicator, seenUsers) {
        if (seenUsers.length === 0) {
            seenIndicator.innerHTML = ''
            return
        }

        if (seenUsers.length === 1) {
            seenIndicator.innerHTML = `<i class="fas fa-check text-blue-500"></i>`
        } else {
            seenIndicator.innerHTML = `<i class="fas fa-check-double text-blue-500"></i> ${seenUsers.length}`
        }
        
        // Tooltip với danh sách users đã đọc
        const tooltip = seenUsers.map(user => 
            `${user.fullName || 'Unknown'} - ${new Date(user.seenAt).toLocaleTimeString()}`
        ).join('\n')
        seenIndicator.title = `Đã đọc bởi:\n${tooltip}`
    }

    // Tính năng 2: Message Reactions  
    addReaction(messageId, emoji) {
        this.socket.emit('Client_Add_Reaction', {
            messageId: messageId,
            userId: this.userId,
            emoji: emoji,
            roomChatId: this.roomChatId,
            fullName: this.fullName
        })
    }

    updateReaction(messageId, emoji, userId, fullName, action) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            const reactionsContainer = messageElement.querySelector('.reactions-container')
            const emojiButton = reactionsContainer.querySelector(`[data-emoji="${emoji}"]`)

            if (action === 'add') {
                if (!emojiButton) {
                    this.createEmojiButton(reactionsContainer, emoji, userId, fullName)
                } else {
                    this.updateEmojiCount(emojiButton, userId, fullName, 'add')
                }
            } else if (action === 'remove' && emojiButton) {
                this.updateEmojiCount(emojiButton, userId, fullName, 'remove')
            }
        }
    }

    createEmojiButton(container, emoji, userId, fullName) {
        const button = document.createElement('button')
        button.className = 'emoji-count-btn bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 text-sm'
        button.dataset.emoji = emoji
        button.dataset.users = JSON.stringify([{ user_id: userId, fullName: fullName }])
        button.innerHTML = `${emoji} 1`
        button.onclick = () => this.addReaction(container.closest('[data-message-id]').dataset.messageId, emoji)
        container.appendChild(button)
    }

    updateEmojiCount(button, userId, fullName, action) {
        let users = JSON.parse(button.dataset.users || '[]')
        
        if (action === 'add') {
            if (!users.find(u => u.user_id === userId)) {
                users.push({ user_id: userId, fullName: fullName })
            }
        } else {
            users = users.filter(u => u.user_id !== userId)
        }

        if (users.length === 0) {
            button.remove()
        } else {
            button.dataset.users = JSON.stringify(users)
            button.innerHTML = `${button.dataset.emoji} ${users.length}`
            
            // Tooltip
            const tooltip = users.map(u => u.fullName).join(', ')
            button.title = tooltip
        }
    }

    // Tính năng 3: Pin Messages
    pinMessage(messageId) {
        this.socket.emit('Client_Pin_Message', {
            messageId: messageId,
            userId: this.userId,
            roomChatId: this.roomChatId,
            fullName: this.fullName
        })
    }

    updatePinStatus(messageId, pinned, pinnedByName) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            const pinIndicator = messageElement.querySelector('.pin-indicator')
            if (pinned) {
                if (!pinIndicator) {
                    const indicator = document.createElement('div')
                    indicator.className = 'pin-indicator flex items-center text-yellow-600 text-xs'
                    indicator.innerHTML = `<i class="fas fa-thumbtack mr-1"></i>Đã ghim bởi ${pinnedByName}`
                    messageElement.querySelector('.message-header').appendChild(indicator)
                }
                messageElement.classList.add('pinned-message')
            } else {
                if (pinIndicator) {
                    pinIndicator.remove()
                }
                messageElement.classList.remove('pinned-message')
            }
        }
    }

    getPinnedMessages() {
        this.socket.emit('Client_Get_Pinned_Messages', {
            roomChatId: this.roomChatId,
            userId: this.userId
        })
    }

    displayPinnedMessages(pinnedMessages) {
        const pinnedContainer = document.getElementById('pinned-messages-container')
        pinnedContainer.innerHTML = ''

        pinnedMessages.forEach(msg => {
            const messageElement = this.createPinnedMessageElement(msg)
            pinnedContainer.appendChild(messageElement)
        })

        // Show pinned messages panel
        document.getElementById('pinned-messages-panel').style.display = 'block'
    }

    // Tính năng 4: Reply Messages
    showReplyForm(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        const content = messageElement.querySelector('.message-content').textContent
        const userName = messageElement.querySelector('.user-name').textContent

        const replyForm = document.getElementById('reply-form')
        const replyPreview = document.getElementById('reply-preview')
        
        replyPreview.innerHTML = `
            <div class="bg-gray-100 p-2 rounded border-l-4 border-blue-500">
                <div class="text-sm text-gray-600">Trả lời ${userName}</div>
                <div class="text-sm">${content.substring(0, 100)}${content.length > 100 ? '...' : ''}</div>
            </div>
        `
        
        replyForm.dataset.replyTo = JSON.stringify({
            message_id: messageId,
            content: content,
            user_id: messageElement.dataset.userId,
            user_name: userName
        })
        
        replyForm.style.display = 'block'
        document.getElementById('message-input').focus()
    }

    sendMessage() {
        const input = document.getElementById('message-input')
        const content = input.value.trim()
        if (!content) return

        const replyForm = document.getElementById('reply-form')
        const replyData = replyForm.dataset.replyTo ? JSON.parse(replyForm.dataset.replyTo) : null

        const messageData = {
            roomChatId: this.roomChatId,
            userId: this.userId,
            fullName: this.fullName,
            content: content,
            images: [] // Handle images separately
        }

        if (replyData) {
            messageData.replyTo = replyData
        }

        this.socket.emit('Client_Send_Message', messageData)
        
        input.value = ''
        replyForm.style.display = 'none'
        replyForm.dataset.replyTo = ''
    }

    // Tính năng 5: Edit Messages
    showEditForm(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        const contentElement = messageElement.querySelector('.message-content')
        const originalContent = contentElement.textContent

        contentElement.innerHTML = `
            <div class="edit-form">
                <textarea class="w-full p-2 border rounded resize-none" rows="2">${originalContent}</textarea>
                <div class="mt-2">
                    <button class="save-edit bg-blue-500 text-white px-3 py-1 rounded mr-2" data-message-id="${messageId}">Lưu</button>
                    <button class="cancel-edit bg-gray-500 text-white px-3 py-1 rounded" data-original="${originalContent}">Hủy</button>
                </div>
            </div>
        `

        // Event listeners for edit form
        const saveBtn = contentElement.querySelector('.save-edit')
        const cancelBtn = contentElement.querySelector('.cancel-edit')
        const textarea = contentElement.querySelector('textarea')

        saveBtn.onclick = () => {
            const newContent = textarea.value.trim()
            if (newContent && newContent !== originalContent) {
                this.editMessage(messageId, newContent)
            } else {
                this.cancelEdit(contentElement, originalContent)
            }
        }

        cancelBtn.onclick = () => {
            this.cancelEdit(contentElement, originalContent)
        }

        textarea.focus()
        textarea.select()
    }

    editMessage(messageId, newContent) {
        this.socket.emit('Client_Edit_Message', {
            messageId: messageId,
            userId: this.userId,
            newContent: newContent,
            roomChatId: this.roomChatId,
            fullName: this.fullName
        })
    }

    updateEditedMessage(messageId, newContent, editedAt) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content')
            contentElement.innerHTML = `
                ${newContent}
                <div class="text-xs text-gray-500 mt-1">
                    <i class="fas fa-edit mr-1"></i>Đã chỉnh sửa ${new Date(editedAt).toLocaleTimeString()}
                </div>
            `
        }
    }

    cancelEdit(contentElement, originalContent) {
        contentElement.innerHTML = originalContent
    }

    getEditHistory(messageId) {
        this.socket.emit('Client_Get_Edit_History', {
            messageId: messageId,
            userId: this.userId,
            roomChatId: this.roomChatId
        })
    }

    showEditHistory(messageId, editHistory) {
        // Create modal to show edit history
        const modal = this.createEditHistoryModal(messageId, editHistory)
        document.body.appendChild(modal)
    }

    // Tính năng 6: Delete Messages
    deleteMessage(messageId) {
        if (confirm('Bạn có chắc chắn muốn xóa tin nhắn này?')) {
            this.socket.emit('Client_Delete_Message', {
                messageId: messageId,
                userId: this.userId,
                roomChatId: this.roomChatId,
                fullName: this.fullName
            })
        }
    }

    markMessageAsDeleted(messageId, deletedByName) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            messageElement.classList.add('deleted-message')
            messageElement.querySelector('.message-content').innerHTML = `
                <div class="text-gray-500 italic">
                    <i class="fas fa-trash mr-1"></i>Tin nhắn đã được xóa bởi ${deletedByName}
                </div>
            `
        }
    }

    // Utility Functions
    setupIntersectionObserver() {
        const options = {
            root: document.getElementById('messages-container'),
            rootMargin: '0px',
            threshold: 0.5
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageId = entry.target.dataset.messageId
                    const userId = entry.target.dataset.userId
                    
                    // Only mark as seen if it's not our own message
                    if (userId !== this.userId) {
                        this.markMessageAsSeen(messageId)
                    }
                }
            })
        }, options)

        // Observe all message elements
        document.querySelectorAll('[data-message-id]').forEach(msg => {
            observer.observe(msg)
        })
    }

    displayMessage(data) {
        const messagesContainer = document.getElementById('messages-container')
        const messageElement = this.createMessageElement(data)
        messagesContainer.appendChild(messageElement)
        messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    createMessageElement(data) {
        const messageElement = document.createElement('div')
        messageElement.className = `message-item ${data.userId === this.userId ? 'own-message' : ''}`
        messageElement.dataset.messageId = data._id
        messageElement.dataset.userId = data.userId

        messageElement.innerHTML = `
            <div class="message-header flex justify-between items-center">
                <div class="user-info">
                    <span class="user-name font-semibold">${data.fullName}</span>
                    <span class="timestamp text-xs text-gray-500">${new Date(data.createdAt).toLocaleTimeString()}</span>
                </div>
                <div class="message-actions">
                    ${this.createMessageActions(data)}
                </div>
            </div>
            
            ${data.replyTo ? this.createReplyPreview(data.replyTo) : ''}
            
            <div class="message-content">${data.content}</div>
            
            ${data.images && data.images.length > 0 ? this.createImagesDisplay(data.images) : ''}
            
            <div class="reactions-container flex flex-wrap gap-1 mt-2"></div>
            
            <div class="message-footer flex justify-between items-center mt-1">
                <div class="emoji-picker">
                    ${this.createEmojiPicker(data._id)}
                </div>
                <div class="seen-indicator" data-seen-users="[]"></div>
            </div>
        `

        return messageElement
    }

    createMessageActions(data) {
        const isOwner = data.userId === this.userId
        const canPin = this.userCanPin // Set this based on user permissions

        return `
            <div class="dropdown relative">
                <button class="dropdown-toggle text-gray-500 hover:text-gray-700">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden">
                    <button class="reply-btn w-full text-left px-4 py-2 hover:bg-gray-100" data-message-id="${data._id}">
                        <i class="fas fa-reply mr-2"></i>Trả lời
                    </button>
                    ${isOwner ? `
                        <button class="edit-message-btn w-full text-left px-4 py-2 hover:bg-gray-100" data-message-id="${data._id}">
                            <i class="fas fa-edit mr-2"></i>Chỉnh sửa
                        </button>
                        <button class="delete-message-btn w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600" data-message-id="${data._id}">
                            <i class="fas fa-trash mr-2"></i>Xóa
                        </button>
                    ` : ''}
                    ${canPin ? `
                        <button class="pin-message-btn w-full text-left px-4 py-2 hover:bg-gray-100" data-message-id="${data._id}">
                            <i class="fas fa-thumbtack mr-2"></i>Ghim
                        </button>
                    ` : ''}
                </div>
            </div>
        `
    }

    createEmojiPicker(messageId) {
        const emojis = ['👍', '👎', '❤️', '😂', '😢', '😮', '😡', '👏', '🔥', '💯', '🎉', '😍', '🤔', '😊', '😎', '🙏']
        return emojis.map(emoji => 
            `<button class="emoji-reaction hover:bg-gray-100 p-1 rounded" data-message-id="${messageId}" data-emoji="${emoji}">${emoji}</button>`
        ).join('')
    }

    createReplyPreview(replyTo) {
        return `
            <div class="reply-preview bg-gray-100 p-2 rounded border-l-4 border-blue-500 mb-2">
                <div class="text-sm text-gray-600">${replyTo.user_name}</div>
                <div class="text-sm">${replyTo.content.substring(0, 100)}${replyTo.content.length > 100 ? '...' : ''}</div>
            </div>
        `
    }

    createImagesDisplay(images) {
        return `
            <div class="images-container mt-2">
                ${images.map(img => `<img src="${img}" class="max-w-xs rounded cursor-pointer" onclick="this.requestFullscreen()">`).join('')}
            </div>
        `
    }

    // Get unread count via API
    async getUnreadCount() {
        try {
            const response = await fetch(`/api/chat/unread-count/${this.roomChatId}`)
            const data = await response.json()
            return data.data.unreadCount
        } catch (error) {
            console.error('Error getting unread count:', error)
            return 0
        }
    }

    // Get messages with pagination
    async getMessages(page = 1, limit = 20) {
        try {
            const response = await fetch(`/api/chat/messages/${this.roomChatId}?page=${page}&limit=${limit}`)
            const data = await response.json()
            return data.data
        } catch (error) {
            console.error('Error getting messages:', error)
            return null
        }
    }
}

// Usage:
// const chat = new AdvancedChat(socket, roomChatId, userId, fullName)
// chat.markAllMessagesAsRead()
// chat.getPinnedMessages()
