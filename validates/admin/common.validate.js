import validator from 'validator';
import xss from 'xss';

// Cấu hình XSS filter nghiêm ngặt
const xssOptions = {
    whiteList: {}, // Không cho phép bất kỳ HTML tag nào
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    allowCommentTag: false,
    escapeHtml: function(html) {
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
};

// Danh sách các pattern nguy hiểm cần kiểm tra
const dangerousPatterns = [
    // Script injection
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /data:application\/javascript/gi,
    
    // Event handlers
    /on\w+\s*=/gi,
    
    // HTML elements nguy hiểm
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi,
    /<form/gi,
    
    // JavaScript functions
    /eval\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /Function\s*\(/gi,
    /window\./gi,
    /document\./gi,
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
    
    // SQL Injection patterns
    /union\s+select/gi,
    /insert\s+into/gi,
    /delete\s+from/gi,
    /update\s+set/gi,
    /drop\s+table/gi,
    /exec\s*\(/gi,
    
    // Command injection
    /system\s*\(/gi,
    /exec\s*\(/gi,
    /shell_exec/gi,
    /passthru/gi,
    /`.*`/g,
    
    // Path traversal
    /\.\.\//g,
    /\.\.[\\/]/g,
    
    // Null bytes
    /[\x00]/g,
    
    // LDAP injection
    /\(\|\(/g,
    /\)\(\|/g
];

/**
 * Làm sạch và validate input string
 * @param {string} input - Input cần validate
 * @param {number} maxLength - Độ dài tối đa
 * @param {object} options - Tùy chọn validate
 * @returns {object} {isValid: boolean, value: string, errors: array}
 */
export const sanitizeAndValidate = (input, maxLength = 255, options = {}) => {
    const errors = [];
    
    // Kiểm tra type
    if (typeof input !== 'string') {
        return { isValid: false, value: '', errors: ['Dữ liệu phải là chuỗi!'] };
    }
    
    // Loại bỏ khoảng trắng thừa
    let cleaned = input.trim();
    
    // Kiểm tra độ dài trước khi xử lý
    if (cleaned.length > maxLength) {
        errors.push(`Dữ liệu quá dài (tối đa ${maxLength} ký tự)!`);
        cleaned = cleaned.substring(0, maxLength);
    }
    
    // Kiểm tra ký tự null byte
    if (cleaned.includes('\x00')) {
        errors.push('Dữ liệu chứa ký tự không hợp lệ!');
        cleaned = cleaned.replace(/\x00/g, '');
    }
    
    // Làm sạch XSS
    cleaned = xss(cleaned, xssOptions);
    
    // Kiểm tra các pattern nguy hiểm
    if (checkDangerousPatterns(cleaned)) {
        errors.push('Dữ liệu chứa nội dung nguy hiểm!');
    }
    
    // Kiểm tra encoding
    try {
        const encoded = encodeURIComponent(cleaned);
        if (encoded.length > maxLength * 3) { // URL encoding có thể tăng độ dài
            errors.push('Dữ liệu chứa ký tự không hợp lệ!');
        }
    } catch (e) {
        errors.push('Dữ liệu chứa ký tự không hợp lệ!');
    }
    
    // Validate thêm theo options
    if (options.isEmail && !validator.isEmail(cleaned)) {
        errors.push('Email không đúng định dạng!');
    }
    
    if (options.isNumeric && !validator.isNumeric(cleaned)) {
        errors.push('Dữ liệu phải là số!');
    }
    
    if (options.isAlphanumeric && !validator.isAlphanumeric(cleaned.replace(/[_-\s]/g, ''))) {
        errors.push('Dữ liệu chỉ được chứa chữ và số!');
    }
    
    if (options.minLength && cleaned.length < options.minLength) {
        errors.push(`Dữ liệu phải có ít nhất ${options.minLength} ký tự!`);
    }
    
    return {
        isValid: errors.length === 0,
        value: cleaned,
        errors
    };
};

/**
 * Kiểm tra các pattern nguy hiểm
 * @param {string} input 
 * @returns {boolean}
 */
export const checkDangerousPatterns = (input) => {
    return dangerousPatterns.some(pattern => pattern.test(input));
};

/**
 * Validate email với các kiểm tra bổ sung
 * @param {string} email 
 * @returns {object}
 */
export const validateEmail = (email) => {
    const result = sanitizeAndValidate(email, 254, { isEmail: true });
    
    if (result.isValid) {
        const emailParts = result.value.split('@');
        if (emailParts.length === 2) {
            const [localPart, domain] = emailParts;
            
            // Kiểm tra local part
            if (localPart.length > 64) {
                result.errors.push('Phần tên email quá dài!');
                result.isValid = false;
            }
            
            // Kiểm tra domain
            if (domain.length > 63) {
                result.errors.push('Tên miền email quá dài!');
                result.isValid = false;
            }
            
            // Kiểm tra các domain nguy hiểm (có thể customize)
            const suspiciousDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
            if (suspiciousDomains.includes(domain.toLowerCase())) {
                result.errors.push('Email từ dịch vụ tạm thời không được phép!');
                result.isValid = false;
            }
        }
        
        // Chuyển về lowercase
        result.value = result.value.toLowerCase();
    }
    
    return result;
};

/**
 * Validate password với các quy tắc bảo mật
 * @param {string} password 
 * @param {object} options 
 * @returns {object}
 */
export const validatePassword = (password, options = {}) => {
    const minLength = options.minLength || 6;
    const maxLength = options.maxLength || 128;
    const requireSpecialChar = options.requireSpecialChar || false;
    const requireNumber = options.requireNumber || false;
    const requireUppercase = options.requireUppercase || false;
    
    const errors = [];
    
    if (typeof password !== 'string') {
        return { isValid: false, value: '', errors: ['Mật khẩu phải là chuỗi!'] };
    }
    
    // Kiểm tra độ dài
    if (password.length < minLength) {
        errors.push(`Mật khẩu phải có ít nhất ${minLength} ký tự!`);
    }
    
    if (password.length > maxLength) {
        errors.push(`Mật khẩu quá dài (tối đa ${maxLength} ký tự)!`);
    }
    
    // Kiểm tra ký tự đặc biệt
    if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt!');
    }
    
    // Kiểm tra số
    if (requireNumber && !/\d/.test(password)) {
        errors.push('Mật khẩu phải chứa ít nhất 1 chữ số!');
    }
    
    // Kiểm tra chữ hoa
    if (requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa!');
    }
    
    // Kiểm tra các pattern nguy hiểm
    if (checkDangerousPatterns(password)) {
        errors.push('Mật khẩu chứa ký tự không được phép!');
    }
    
    // Kiểm tra common passwords
    const commonPasswords = ['123456', 'password', 'admin', 'root', 'user', '12345678'];
    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Mật khẩu quá đơn giản!');
    }
    
    return {
        isValid: errors.length === 0,
        value: password, // Không sanitize password
        errors
    };
};

/**
 * Validate request headers và metadata
 * @param {object} req 
 * @returns {object}
 */
export const validateRequestMeta = (req) => {
    const errors = [];
    
    // Kiểm tra method
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        errors.push('HTTP method không được phép!');
    }
    
    // Kiểm tra Content-Length
    const contentLength = parseInt(req.get('Content-Length'));
    if (contentLength && contentLength > 10 * 1024 * 1024) { // 10MB
        errors.push('Request quá lớn!');
    }
    
    // Kiểm tra User-Agent
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length < 5 || userAgent.length > 512) {
        errors.push('User-Agent không hợp lệ!');
    }
    
    // Kiểm tra các header nguy hiểm
    const dangerousHeaders = ['x-forwarded-for', 'x-real-ip', 'referer'];
    for (const header of dangerousHeaders) {
        const value = req.get(header);
        if (value && checkDangerousPatterns(value)) {
            errors.push(`Header ${header} chứa nội dung nguy hiểm!`);
        }
    }
    
    // Kiểm tra Content-Type
    if (req.method === 'POST') {
        const contentType = req.get('Content-Type');
        if (!contentType || (!contentType.includes('application/x-www-form-urlencoded') && 
                           !contentType.includes('application/json') &&
                           !contentType.includes('multipart/form-data'))) {
            errors.push('Content-Type không hợp lệ!');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate và làm sạch body request
 * @param {object} body 
 * @param {array} allowedFields 
 * @param {number} maxFields 
 * @returns {object}
 */
export const validateRequestBody = (body, allowedFields = [], maxFields = 20) => {
    const errors = [];
    const cleanBody = {};
    
    // Kiểm tra số lượng field
    const bodyKeys = Object.keys(body || {});
    if (bodyKeys.length > maxFields) {
        errors.push('Quá nhiều dữ liệu được gửi lên!');
    }
    
    // Kiểm tra và làm sạch từng field
    for (const key of bodyKeys) {
        if (allowedFields.length > 0 && !allowedFields.includes(key)) {
            // Skip unexpected fields
            continue;
        }
        
        const keyValidation = sanitizeAndValidate(key, 50);
        if (!keyValidation.isValid) {
            errors.push(`Tên field '${key}' không hợp lệ!`);
            continue;
        }
        
        cleanBody[keyValidation.value] = body[key];
    }
    
    return {
        isValid: errors.length === 0,
        body: cleanBody,
        errors
    };
};

/**
 * Rate limiting helper
 * @param {string} key 
 * @param {number} limit 
 * @param {number} windowMs 
 * @returns {boolean}
 */
export const checkRateLimit = (key, limit = 5, windowMs = 60000) => {
    // Simple in-memory rate limiting
    if (!global.rateLimitStore) {
        global.rateLimitStore = new Map();
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!global.rateLimitStore.has(key)) {
        global.rateLimitStore.set(key, []);
    }
    
    const requests = global.rateLimitStore.get(key);
    
    // Loại bỏ các request cũ
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= limit) {
        return false; // Exceeded rate limit
    }
    
    validRequests.push(now);
    global.rateLimitStore.set(key, validRequests);
    
    return true; // Within rate limit
};

/**
 * Middleware để validate request chung
 */
export const commonValidationMiddleware = (req, res, next) => {
    try {
        // Validate request metadata
        const metaValidation = validateRequestMeta(req);
        if (!metaValidation.isValid) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        
        // Rate limiting
        const clientKey = req.ip || 'unknown';
        if (!checkRateLimit(`general_${clientKey}`, 100, 60000)) { // 100 requests per minute
            return res.status(429).json({ error: 'Too many requests' });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Validate MongoDB ObjectId
export function validateObjectId(id) {
    if (!id || typeof id !== 'string') {
        return { isValid: false, error: 'ID phải là chuỗi ký tự!' };
    }
    
    // Kiểm tra length
    if (id.length !== 24) {
        return { isValid: false, error: 'ID không có độ dài hợp lệ!' };
    }
    
    // Kiểm tra hex format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return { isValid: false, error: 'ID không có format hợp lệ!' };
    }
    
    return { isValid: true, value: id };
}

// Validate permissions array (base function)
export function validatePermissions(permissions, validPermissions = []) {
    if (!permissions) {
        return { isValid: true, value: [] };
    }
    
    if (!Array.isArray(permissions)) {
        return { isValid: false, error: 'Permissions phải là mảng!' };
    }
    
    const validatedPerms = [];
    const seen = new Set();
    
    for (const perm of permissions) {
        if (typeof perm !== 'string') continue;
        
        const sanitized = xss(perm.trim(), xssOptions);
        if (!sanitized || seen.has(sanitized)) continue;
        
        if (validPermissions.length > 0 && !validPermissions.includes(sanitized)) {
            return { isValid: false, error: `Permission "${sanitized}" không hợp lệ!` };
        }
        
        seen.add(sanitized);
        validatedPerms.push(sanitized);
    }
    
    return { isValid: true, value: validatedPerms };
}

export default {
    sanitizeAndValidate,
    checkDangerousPatterns,
    validateEmail,
    validatePassword,
    validateRequestMeta,
    validateRequestBody,
    checkRateLimit,
    validateObjectId,
    validatePermissions,
    commonValidationMiddleware
};
