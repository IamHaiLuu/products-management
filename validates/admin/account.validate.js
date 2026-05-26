import validator from 'validator'
import xss from 'xss'

// XSS Protection Configuration
const xssOptions = {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
}

// Security utilities
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return ''
    return xss(input.trim(), xssOptions)
}

const isValidLength = (str, min = 1, max = 255) => {
    return str && str.length >= min && str.length <= max
}

// Rate limiting tracker
const rateLimitTracker = new Map()

const checkRateLimit = (ip, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const now = Date.now()
    const windowStart = now - windowMs
    
    if (!rateLimitTracker.has(ip)) {
        rateLimitTracker.set(ip, [])
    }
    
    const attempts = rateLimitTracker.get(ip)
    const recentAttempts = attempts.filter(time => time > windowStart)
    
    if (recentAttempts.length >= maxAttempts) {
        return false
    }
    
    recentAttempts.push(now)
    rateLimitTracker.set(ip, recentAttempts)
    return true
}

// Common validation functions
const validateFullName = (fullName) => {
    const errors = []
    
    if (!fullName || typeof fullName !== 'string') {
        errors.push('Họ tên là bắt buộc')
        return { isValid: false, errors, sanitized: '' }
    }

    const sanitized = sanitizeInput(fullName)
    
    // Check if sanitization removed content (potential XSS)
    if (sanitized !== fullName.trim()) {
        errors.push('Họ tên chứa ký tự không hợp lệ')
    }

    // Length validation
    if (!isValidLength(sanitized, 2, 100)) {
        errors.push('Họ tên phải từ 2 đến 100 ký tự')
    }

    // Pattern validation (only letters and spaces, including Vietnamese)
    const namePattern = /^[a-zA-ZÀ-ỹ\s]+$/
    if (!namePattern.test(sanitized)) {
        errors.push('Họ tên chỉ được chứa chữ cái và dấu cách')
    }

    // Check for SQL injection patterns
    const sqlPatterns = /(union|select|insert|update|delete|drop|create|alter|exec|script)/i
    if (sqlPatterns.test(sanitized)) {
        errors.push('Họ tên chứa nội dung không hợp lệ')
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitized
    }
}

const validateEmail = (email) => {
    const errors = []
    
    if (!email || typeof email !== 'string') {
        errors.push('Email là bắt buộc')
        return { isValid: false, errors, sanitized: '' }
    }

    const sanitized = sanitizeInput(email.toLowerCase())
    
    // Check if sanitization removed content
    if (sanitized !== email.trim().toLowerCase()) {
        errors.push('Email chứa ký tự không hợp lệ')
    }

    // Length validation
    if (!isValidLength(sanitized, 1, 254)) {
        errors.push('Email không được vượt quá 254 ký tự')
    }

    // Email format validation using validator library
    if (!validator.isEmail(sanitized)) {
        errors.push('Định dạng email không hợp lệ')
    }

    // Domain validation (prevent disposable emails)
    const disposableDomains = ['10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.org']
    const domain = sanitized.split('@')[1]
    if (domain && disposableDomains.includes(domain.toLowerCase())) {
        errors.push('Không được sử dụng email tạm thời')
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitized
    }
}

const validatePassword = (password, isRequired = true) => {
    const errors = []
    
    if (!password || typeof password !== 'string') {
        if (isRequired) {
            errors.push('Mật khẩu là bắt buộc')
        }
        return { isValid: !isRequired, errors }
    }

    // Length validation
    if (!isValidLength(password, 8, 128)) {
        errors.push('Mật khẩu phải từ 8 đến 128 ký tự')
    }

    // Strong password pattern
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
    if (!strongPasswordPattern.test(password)) {
        errors.push('Mật khẩu phải chứa ít nhất: 1 chữ thường, 1 chữ hoa, 1 số và 1 ký tự đặc biệt')
    }

    // Check for common weak passwords
    const weakPasswords = ['12345678', 'password', 'qwerty123', 'abc123456', 'password123']
    if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('Mật khẩu quá yếu, vui lòng chọn mật khẩu khác')
    }

    // Check for repeated characters
    if (/(.)\1{3,}/.test(password)) {
        errors.push('Mật khẩu không được chứa nhiều ký tự lặp lại')
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

const validateId = (id) => {
    const errors = []
    
    if (!id || typeof id !== 'string') {
        errors.push('ID là bắt buộc')
        return { isValid: false, errors, sanitized: '' }
    }

    const sanitized = sanitizeInput(id)
    
    // MongoDB ObjectId pattern validation
    const objectIdPattern = /^[0-9a-fA-F]{24}$/
    if (!objectIdPattern.test(sanitized)) {
        errors.push('ID không hợp lệ')
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitized
    }
}

const validateStatus = (status) => {
    const errors = []
    
    if (!status || typeof status !== 'string') {
        errors.push('Trạng thái là bắt buộc')
        return { isValid: false, errors, sanitized: '' }
    }

    const sanitized = sanitizeInput(status)
    
    // Only allow specific status values
    const allowedStatuses = ['active', 'inactive']
    if (!allowedStatuses.includes(sanitized)) {
        errors.push('Trạng thái không hợp lệ')
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitized
    }
}

// ==================== ROUTE-SPECIFIC VALIDATORS ====================

/**
 * Validator for GET / route (index) - mainly for query parameters
 */
export async function validateIndex(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting for listing requests
        if (!checkRateLimit(clientIp, 20, 60000)) { // 20 requests per minute
            req.flash('error', 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
            return res.status(429).redirect('/admin')
        }

        const errors = []

        // Validate query parameters if present
        if (req.query.page) {
            const page = parseInt(req.query.page)
            if (isNaN(page) || page < 1 || page > 1000) {
                errors.push('Số trang không hợp lệ')
            }
        }

        if (req.query.limit) {
            const limit = parseInt(req.query.limit)
            if (isNaN(limit) || limit < 1 || limit > 100) {
                errors.push('Giới hạn hiển thị không hợp lệ')
            }
        }

        if (req.query.keyword) {
            const sanitizedKeyword = sanitizeInput(req.query.keyword)
            if (sanitizedKeyword.length > 255) {
                errors.push('Từ khóa tìm kiếm quá dài')
            }
            req.query.keyword = sanitizedKeyword
        }

        if (errors.length > 0) {
            req.flash('error', errors.join('. '))
            return res.redirect('/admin/account')
        }

        next()
    } catch (error) {
        console.error('Index validation error:', error)
        req.flash('error', 'Có lỗi xảy ra')
        return res.redirect('/admin')
    }
}

/**
 * Validator for GET /create route
 */
export async function validateCreate(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting
        if (!checkRateLimit(clientIp, 10, 60000)) { // 10 requests per minute
            req.flash('error', 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
            return res.status(429).redirect('/admin/account')
        }

        // No specific validation needed for GET request, just rate limiting
        next()
    } catch (error) {
        console.error('Create validation error:', error)
        req.flash('error', 'Có lỗi xảy ra')
        return res.redirect('/admin/account')
    }
}

/**
 * Validator for POST /create route (account creation)
 */
export async function validateCreatePost(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Strict rate limiting for account creation
        if (!checkRateLimit(clientIp, 3, 600000)) { // 3 attempts per 10 minutes
            req.flash('error', 'Quá nhiều yêu cầu tạo tài khoản. Vui lòng thử lại sau 10 phút.')
            return res.status(429).redirect('/admin/account/create')
        }

        const errors = []

        // Validate full name
        const fullNameResult = validateFullName(req.body.fullName)
        if (!fullNameResult.isValid) {
            errors.push(...fullNameResult.errors)
        } else {
            req.body.fullName = fullNameResult.sanitized
        }

        // Validate email
        const emailResult = validateEmail(req.body.email)
        if (!emailResult.isValid) {
            errors.push(...emailResult.errors)
        } else {
            req.body.email = emailResult.sanitized
        }

        // Validate password (required for creation)
        const passwordResult = validatePassword(req.body.password, true)
        if (!passwordResult.isValid) {
            errors.push(...passwordResult.errors)
        }

        // Validate optional fields
        if (req.body.phone) {
            const sanitizedPhone = sanitizeInput(req.body.phone.replace(/\s/g, ''))
            const phonePattern = /^(\+84|0)[0-9]{9,10}$/
            if (!phonePattern.test(sanitizedPhone)) {
                errors.push('Số điện thoại không đúng định dạng')
            } else {
                req.body.phone = sanitizedPhone
            }
        }

        if (req.body.role_id) {
            const roleResult = validateId(req.body.role_id)
            if (!roleResult.isValid) {
                errors.push('Role ID không hợp lệ')
            } else {
                req.body.role_id = roleResult.sanitized
            }
        }

        // Check for only allowed fields for account creation
        const allowedFields = ['fullName', 'email', 'password', 'phone', 'role_id']
        const bodyKeys = Object.keys(req.body)
        const unexpectedFields = bodyKeys.filter(key => !allowedFields.includes(key))
        
        if (unexpectedFields.length > 0) {
            errors.push('Dữ liệu chứa trường không hợp lệ: ' + unexpectedFields.join(', '))
        }

        if (errors.length > 0) {
            req.flash('error', errors.join('. '))
            return res.status(400).redirect('/admin/account/create')
        }

        console.log(`Account creation validation passed for IP: ${clientIp}, Email: ${req.body.email}`)
        next()
    } catch (error) {
        console.error('Create post validation error:', error)
        req.flash('error', 'Có lỗi xảy ra trong quá trình xác thực dữ liệu')
        return res.status(500).redirect('/admin/account/create')
    }
}

/**
 * Validator for GET /edit/:id route
 */
export async function validateEdit(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting
        if (!checkRateLimit(clientIp, 10, 60000)) { // 10 requests per minute
            req.flash('error', 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
            return res.status(429).redirect('/admin/account')
        }

        const errors = []

        // Validate ID parameter
        const idResult = validateId(req.params.id)
        if (!idResult.isValid) {
            errors.push(...idResult.errors)
        } else {
            req.params.id = idResult.sanitized
        }

        if (errors.length > 0) {
            req.flash('error', errors.join('. '))
            return res.status(400).redirect('/admin/account')
        }

        next()
    } catch (error) {
        console.error('Edit validation error:', error)
        req.flash('error', 'Có lỗi xảy ra')
        return res.redirect('/admin/account')
    }
}

/**
 * Validator for PATCH /edit/:id route (account update)
 */
export async function validateEditPatch(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting for updates
        if (!checkRateLimit(clientIp, 5, 300000)) { // 5 attempts per 5 minutes
            req.flash('error', 'Quá nhiều yêu cầu cập nhật. Vui lòng thử lại sau 5 phút.')
            return res.status(429).redirect(`/admin/account/edit/${req.params.id}`)
        }

        const errors = []

        // Validate ID parameter
        const idResult = validateId(req.params.id)
        if (!idResult.isValid) {
            errors.push(...idResult.errors)
        } else {
            req.params.id = idResult.sanitized
        }

        // Validate full name (required for update)
        const fullNameResult = validateFullName(req.body.fullName)
        if (!fullNameResult.isValid) {
            errors.push(...fullNameResult.errors)
        } else {
            req.body.fullName = fullNameResult.sanitized
        }

        // Validate email (required for update)
        const emailResult = validateEmail(req.body.email)
        if (!emailResult.isValid) {
            errors.push(...emailResult.errors)
        } else {
            req.body.email = emailResult.sanitized
        }

        // Password is optional for update
        if (req.body.password && req.body.password.trim() !== '') {
            const passwordResult = validatePassword(req.body.password, false)
            if (!passwordResult.isValid) {
                errors.push(...passwordResult.errors)
            }
        }

        // Validate optional fields
        if (req.body.phone) {
            const sanitizedPhone = sanitizeInput(req.body.phone.replace(/\s/g, ''))
            const phonePattern = /^(\+84|0)[0-9]{9,10}$/
            if (!phonePattern.test(sanitizedPhone)) {
                errors.push('Số điện thoại không đúng định dạng')
            } else {
                req.body.phone = sanitizedPhone
            }
        }

        if (req.body.role_id) {
            const roleResult = validateId(req.body.role_id)
            if (!roleResult.isValid) {
                errors.push('Role ID không hợp lệ')
            } else {
                req.body.role_id = roleResult.sanitized
            }
        }

        // Check for only allowed fields for account update
        const allowedFields = ['fullName', 'email', 'password', 'phone', 'role_id', 'avatar', 'status']
        const bodyKeys = Object.keys(req.body)
        const unexpectedFields = bodyKeys.filter(key => !allowedFields.includes(key))
        
        if (unexpectedFields.length > 0) {
            errors.push('Dữ liệu chứa trường không hợp lệ: ' + unexpectedFields.join(', '))
        }

        if (errors.length > 0) {
            req.flash('error', errors.join('. '))
            return res.status(400).redirect(`/admin/accounts/edit/${req.params.id}`)
        }

        console.log(`Account update validation passed for IP: ${clientIp}, ID: ${req.params.id}`)
        next()
    } catch (error) {
        console.error('Edit patch validation error:', error)
        req.flash('error', 'Có lỗi xảy ra trong quá trình xác thực dữ liệu')
        return res.status(500).redirect(`/admin/accounts/edit/${req.params.id}`)
    }
}

/**
 * Validator for DELETE /delete/:id route
 */
export async function validateDelete(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Strict rate limiting for deletion
        if (!checkRateLimit(clientIp, 2, 300000)) { // 2 attempts per 5 minutes
            return res.status(429).json({ 
                success: false, 
                message: 'Quá nhiều yêu cầu xóa. Vui lòng thử lại sau 5 phút.' 
            })
        }

        const errors = []

        // Validate ID parameter
        const idResult = validateId(req.params.id)
        if (!idResult.isValid) {
            errors.push(...idResult.errors)
        } else {
            req.params.id = idResult.sanitized
        }

        if (errors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: errors.join('. ') 
            })
        }

        console.log(`Account delete validation passed for IP: ${clientIp}, ID: ${req.params.id}`)
        next()
    } catch (error) {
        console.error('Delete validation error:', error)
        return res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra trong quá trình xác thực dữ liệu' 
        })
    }
}

/**
 * Validator for PATCH /change-status/:status/:id route
 */
export async function validateChangeStatus(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting for status changes
        if (!checkRateLimit(clientIp, 10, 60000)) { // 10 attempts per minute
            return res.status(429).json({ 
                success: false, 
                message: 'Quá nhiều yêu cầu thay đổi trạng thái. Vui lòng thử lại sau.' 
            })
        }

        const errors = []

        // Validate ID parameter
        const idResult = validateId(req.params.id)
        if (!idResult.isValid) {
            errors.push(...idResult.errors)
        } else {
            req.params.id = idResult.sanitized
        }

        // Validate status parameter
        const statusResult = validateStatus(req.params.status)
        if (!statusResult.isValid) {
            errors.push(...statusResult.errors)
        } else {
            req.params.status = statusResult.sanitized
        }

        if (errors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: errors.join('. ') 
            })
        }

        console.log(`Status change validation passed for IP: ${clientIp}, ID: ${req.params.id}, Status: ${req.params.status}`)
        next()
    } catch (error) {
        console.error('Change status validation error:', error)
        return res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra trong quá trình xác thực dữ liệu' 
        })
    }
}

/**
 * Validator for GET /detail/:id route
 */
export async function validateDetail(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress
        
        // Rate limiting
        if (!checkRateLimit(clientIp, 15, 60000)) { // 15 requests per minute
            req.flash('error', 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
            return res.status(429).redirect('/admin/account')
        }

        const errors = []

        // Validate ID parameter
        const idResult = validateId(req.params.id)
        if (!idResult.isValid) {
            errors.push(...idResult.errors)
        } else {
            req.params.id = idResult.sanitized
        }

        if (errors.length > 0) {
            req.flash('error', errors.join('. '))
            return res.status(400).redirect('/admin/account')
        }

        next()
    } catch (error) {
        console.error('Detail validation error:', error)
        req.flash('error', 'Có lỗi xảy ra')
        return res.redirect('/admin/account')
    }
}

/**
 * File upload validation
 */
export function validateFileUpload(req, res, next) {
    try {
        if (req.file) {
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            const maxSize = 5 * 1024 * 1024 // 5MB

            // Check file type
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                req.flash('error', 'Chỉ được upload file ảnh (JPEG, PNG, GIF, WebP)')
                const backURL = req.get("Referrer") || "/admin/account"
                return res.status(400).redirect(backURL)
            }

            // Check file size
            if (req.file.size > maxSize) {
                req.flash('error', 'File ảnh không được vượt quá 5MB')
                const backURL = req.get("Referrer") || "/admin/account"
                return res.status(400).redirect(backURL)
            }

            // Check for potential malicious file extensions
            const fileName = req.file.originalname.toLowerCase()
            const dangerousExtensions = ['.php', '.jsp', '.asp', '.exe', '.bat', '.sh', '.js', '.html']
            if (dangerousExtensions.some(ext => fileName.includes(ext))) {
                req.flash('error', 'File không được chứa phần mở rộng nguy hiểm')
                const backURL = req.get("Referrer") || "/admin/account"
                return res.status(400).redirect(backURL)
            }

            // Sanitize filename
            const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
            req.file.originalname = sanitizedFilename
        }

        next()
    } catch (error) {
        console.error('File upload validation error:', error)
        req.flash('error', 'Có lỗi xảy ra trong quá trình kiểm tra file')
        const backURL = req.get("Referrer") || "/admin/account"
        return res.status(500).redirect(backURL)
    }
}

// Legacy exports for backward compatibility
export async function createPost(req, res, next) {
    return validateCreatePost(req, res, next)
}

export async function editPatch(req, res, next) {
    return validateEditPatch(req, res, next)
}
