// ==================== src/services/userService.js ====================
// Сервис для работы с пользователями

const { prepare } = require('../database/db');
const { ROLES, ROLE_NAMES } = require('../config/constants');

/**
 * Получить пользователя по VK ID
 */
function getUserByVkId(vkId) {
    return prepare("SELECT * FROM users WHERE vk_id = ?").get(vkId);
}

/**
 * Создать нового пользователя
 */
function createUser(vkId, role) {
    const insert = prepare(`INSERT INTO users (vk_id, role, is_active) VALUES (?, ?, 1)`);
    const result = insert.run(vkId, role);
    return getUserByVkId(vkId);
}

/**
 * Обновить профиль пользователя
 */
function updateUserProfile(vkId, cityId, schoolId, className, childName) {
    const update = prepare(`
        UPDATE users 
        SET city_id = ?, school_id = ?, class_name = ?, child_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE vk_id = ?
    `);
    update.run(cityId, schoolId, className || null, childName || null, vkId);
    return getUserByVkId(vkId);
}

/**
 * Проверить, заполнен ли профиль
 */
function isProfileComplete(user) {
    return !!(user && user.city_id && user.school_id);
}

/**
 * Получить название роли для отображения
 */
function getRoleDisplay(role) {
    return ROLE_NAMES[role] || role;
}

/**
 * Определить роль по тексту кнопки
 */
function detectRoleByText(text) {
    if (text.includes("Родитель") || text.includes("Ученик")) return ROLES.PARENT;
    if (text.includes("Классный руководитель") || text.includes("учитель")) return ROLES.TEACHER;
    if (text.includes("Кухня")) return ROLES.KITCHEN;
    return null;
}

/**
 * Проверить, является ли пользователь кухней
 */
function isKitchen(user) {
    return user && user.role === ROLES.KITCHEN;
}

/**
 * Проверить, является ли пользователь учителем
 */
function isTeacher(user) {
    return user && user.role === ROLES.TEACHER;
}

/**
 * Проверить, является ли пользователь родителем
 */
function isParent(user) {
    return user && user.role === ROLES.PARENT;
}

module.exports = {
    getUserByVkId,
    createUser,
    updateUserProfile,
    isProfileComplete,
    getRoleDisplay,
    detectRoleByText,
    isKitchen,
    isTeacher,
    isParent
};
